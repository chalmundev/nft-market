use crate::*;

#[ext_contract(ext_self)]
pub trait SelfContract {
	fn offer_callback(&mut self,
		maker_id: AccountId,
		contract_id: AccountId,
	);
    fn outbid_callback(&mut self,
		offer_id: u64,
		maker_id: AccountId,
		prev_maker_id:AccountId,
		prev_offer_amount:U128,
	);
    fn resolve_offer(
        &mut self,
        offer_id: u64,
        maker_id: AccountId,
        taker_id: AccountId,
        amount: U128,
    ) -> Promise;
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub token_id: String,
    pub owner_id: AccountId,
}

#[near_bindgen]
impl Contract {

    #[payable]
    #[private]
	pub fn offer_callback(&mut self,
		maker_id: AccountId,
		contract_id: AccountId,
	) {
		// check promise result
		let result = promise_result_as_success().unwrap_or_else(|| env::panic_str("not a valid token"));
		let Token{ token_id, owner_id: taker_id } = near_sdk::serde_json::from_slice::<Token>(&result).unwrap_or_else(|_| env::panic_str("not a valid token"));
		
		let amount = U128(env::attached_deposit());
		self.offer_id += 1;

		self.offer_by_id.insert(&self.offer_id, &Offer{
			maker_id: maker_id.clone(),
			taker_id: taker_id.clone(),
			contract_id: contract_id.clone(),
			token_id: token_id.clone(),
			amount,
			created_at: env::block_timestamp(),
			approval_id: None,
		});

		self.offers_by_maker_id.insert(
			&maker_id, 
			&map_set_insert(
				&self.offers_by_maker_id, 
				&maker_id, 
				StorageKey::OfferByMakerIdInner { maker_id: maker_id.clone() },
				self.offer_id
			)
		);
	
		self.offers_by_taker_id.insert(
			&taker_id, 
			&map_set_insert(
				&self.offers_by_taker_id, 
				&taker_id, 
				StorageKey::OfferByTakerIdInner { taker_id: taker_id.clone() },
				self.offer_id
			)
		);
	
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		self.offer_by_contract_token_id.insert(
			&contract_token_id.clone(),
			&self.offer_id
		);


	}

    #[payable]
    #[private]
	pub fn outbid_callback(&mut self,
		offer_id: u64,
		maker_id:AccountId,
		prev_maker_id:AccountId,
		prev_offer_amount:U128,
	) {
		if is_promise_success() {
			return
		}
		// pay back promise failed, pay back the new offer maker
		Promise::new(maker_id).transfer(env::attached_deposit() + DEFAULT_OFFER_STORAGE_AMOUNT);

		// revert state
		let mut offer = self.offer_by_id.get(&offer_id).unwrap();
		offer.maker_id = prev_maker_id;
		offer.amount = prev_offer_amount;
		self.offer_by_id.insert(&offer_id, &offer);
	}

	/*
        private method used to resolve the promise when calling nft_transfer_payout. This will take the payout object and 
        check to see if it's authentic and there's no problems. If everything is fine, it will pay the accounts. If there's a problem,
        it will refund the buyer for the price. 
    */
    #[private]
    pub fn resolve_offer(
        &mut self,
        offer_id: u64,
        maker_id: AccountId,
        taker_id: AccountId,
        amount: U128,
    ) -> U128 {
        let mut valid_payout_object = true; 
        let offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("No offer associated with the offer ID"));
        self.internal_remove_offer(offer_id, offer.clone());

        // check promise result
		let result = promise_result_as_success().unwrap_or_else(|| {
            //TODO: decrement market holdings
            Promise::new(maker_id).transfer(offer.amount.0);
            env::panic_str("NFT not successfully transferred. Refunding maker.")
        });

		let Payout{ mut payout } = near_sdk::serde_json::from_slice::<Payout>(&result).unwrap_or_else(|_| {
            valid_payout_object = false;
            env::log_str("not a valid payout object. Sending taker full offer amount.");
            Payout{payout: HashMap::new()}
        });
		

        //we'll check if length of the payout object is > 10 or it's empty. In either case, we return None
        if payout.len() > 10 || payout.is_empty() {
            valid_payout_object = false;
            env::log_str(  "Cannot have more than 10 royalties. Sending taker full offer amount.");
        }
        
        //start with the remainder equal to the offer amount.
        let mut remainder = amount.0;
        
        //loop through the payout and subtract the values from the remainder. 
        for &value in payout.values() { //TODO: log and boolean
            //checked sub checks for overflow or any errors and returns None if there are problems
            remainder = remainder.checked_sub(value.0).unwrap_or_else(|| {
                valid_payout_object = false;
                if valid_payout_object != false {
                    env::log_str("Payout object resulted in a payout larger than offer amount. Sending taker full offer amount.");
                }
                0
            });
        }

        //if invalid payout object, send the maker
        if valid_payout_object == false {
            payout = HashMap::from([(taker_id, amount)]);
        }
        
        // NEAR payouts
        for (receiver_id, payout_amount) in payout {
            Promise::new(receiver_id).transfer(payout_amount.0);
        }

        //return the amount payed out
        amount
    }
}
