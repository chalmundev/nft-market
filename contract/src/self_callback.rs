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
	);
    fn resolve_purchase(
        &mut self,
        buyer_id: AccountId,
        price: U128,
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
	pub fn outbid_callback(&mut self,
		offer_id: u64,
		maker_id:AccountId,
	) {
		let mut offer = self.offer_by_id.get(&offer_id).unwrap();

		offer.maker_id = maker_id;
		offer.amount = U128(env::attached_deposit());

		self.offer_by_id.insert(&offer_id, &offer);
	}

	/*
        private method used to resolve the promise when calling nft_transfer_payout. This will take the payout object and 
        check to see if it's authentic and there's no problems. If everything is fine, it will pay the accounts. If there's a problem,
        it will refund the buyer for the price. 
    */
    #[private]
    pub fn resolve_purchase(
        &mut self,
        maker_id: AccountId,
        price: U128,
    ) -> U128 {
        // checking for payout information returned from the nft_transfer_payout method
        let payout_option = promise_result_as_success().and_then(|value| {
            //if we set the payout_option to None, that means something went wrong and we should refund the buyer
            near_sdk::serde_json::from_slice::<Payout>(&value)
                //converts the result to an optional value
                .ok()
                //returns None if the none. Otherwise executes the following logic
                .and_then(|payout_object| {
                    //we'll check if length of the payout object is > 10 or it's empty. In either case, we return None
                    if payout_object.payout.len() > 10 || payout_object.payout.is_empty() {
                        env::log_str("Cannot have more than 10 royalties");
                        None
                    
                    //if the payout object is the correct length, we move forward
                    } else {
                        //we'll keep track of how much the nft contract wants us to payout. Starting at the full price payed by the buyer
                        let mut remainder = price.0;
                        
                        //loop through the payout and subtract the values from the remainder. 
                        for &value in payout_object.payout.values() {
                            //checked sub checks for overflow or any errors and returns None if there are problems
                            remainder = remainder.checked_sub(value.0)?;
                        }
                        //Check to see if the NFT contract sent back a faulty payout that requires us to pay more or too little. 
                        //The remainder will be 0 if the payout summed to the total price. The remainder will be 1 if the royalties
                        //we something like 3333 + 3333 + 3333. 
                        if remainder == 0 || remainder == 1 {
                            //set the payout_option to be the payout because nothing went wrong
                            Some(payout_object.payout)
                        } else {
                            //if the remainder was anything but 1 or 0, we return None
                            None
                        }
                    }
                })
        });

        // if the payout option was some payout, we set this payout variable equal to that some payout
        let payout = if let Some(payout_option) = payout_option {
            payout_option
        //if the payout option was None, we refund the buyer for the price they payed and return
        } else {
            Promise::new(maker_id).transfer(u128::from(price));
            // leave function and return the price that was refunded
            return price;
        };

        // NEAR payouts
        for (receiver_id, amount) in payout {
            Promise::new(receiver_id).transfer(amount.0);
        }

        //return the price payout out
        price
    }
}
