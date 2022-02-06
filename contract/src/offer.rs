use crate::*;

#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Offer {
    pub maker_id: AccountId,
    pub taker_id: AccountId,
	pub contract_id: AccountId,
    pub token_id: String,
    pub amount: U128,
    pub updated_at: u64,
	pub approval_id: Option<u64>,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn make_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String,
	) {
		let maker_id = env::predecessor_account_id();
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_amount = U128(env::attached_deposit() - self.offer_storage_amount);
		require!(offer_amount.0 > self.min_bid_amount, format!("{}{}", "must be higher than ", self.min_bid_amount));
		self.internal_increment_storage(&maker_id, Some(1));

		let offer_id_option = self.offer_by_contract_token_id.get(&contract_token_id);

		if offer_id_option.is_none() {
			// new offer (log update_offer in internal_add_offer)
			ext_contract::nft_token(
				token_id,
				contract_id.clone(),
				0,
				env::prepaid_gas() - CALLBACK_GAS - CALLBACK_GAS,
			).then(ext_self::new_offer_callback(
				maker_id,
				contract_id,
				env::current_account_id(),
				offer_amount.0,
				CALLBACK_GAS,
			));
			return;
		}

		//offer exists
		let offer_id = offer_id_option.unwrap();
		let mut offer = self.offer_by_id.get(&offer_id).unwrap();

		// existing offer is by the token owner, cannot underbid, token must sell or panic

		if offer.maker_id == offer.taker_id {
			require!(maker_id != offer.taker_id, "Can't bid on your token");
			require!(offer_amount.0 >= offer.amount.0, "Must be equal or greater than the owner's offer amount");
			
			let prev_maker_id = offer.maker_id.clone();
			// maker offer is acceptable by taker, don't log update_offer
			offer.amount = offer_amount;
			offer.maker_id = maker_id;
			offer.updated_at = env::block_timestamp();
			self.offer_by_id.insert(&offer_id, &offer);
			// swap the offers_by_maker_id
			self.internal_swap_offer_maker(offer_id, &prev_maker_id, &offer.maker_id);
			// accept offer
			self.internal_accept_offer(offer_id, offer);
			return;
		}

		// outbid a non-token owner scenario
		
		require!(offer_amount.0 > offer.amount.0 + self.min_bid_amount, format!("{}{}", "Bid must be higher than ", offer.amount.0 + self.min_bid_amount));

		// save values in case we need to revert state in outbid_callback
		let prev_maker_id = offer.maker_id;
		let prev_offer_amount = offer.amount;
		let prev_updated_at = offer.updated_at;
		// valid offer, money in contract, update state
		offer.maker_id = maker_id.clone();
		offer.amount = offer_amount;
		offer.updated_at = env::block_timestamp();
		self.offer_by_id.insert(&offer_id, &offer);

		// this is an outbid scenario so we need to swap the offer makers
		self.internal_swap_offer_maker(offer_id, &prev_maker_id, &offer.maker_id);

		// pay back prev offer maker + storage, if promise fails we'll revert state in outbid_callback
		Promise::new(prev_maker_id.clone())
			.transfer(prev_offer_amount.0 + self.offer_storage_amount)
			.then(ext_self::outbid_callback(
				offer_id,
				maker_id,
				prev_maker_id,
				prev_offer_amount,
				prev_updated_at,
				env::current_account_id(),
				offer_amount.0,
				CALLBACK_GAS,
			));
    }

	/// TODO - insert some owner settable time period where the offer cannot be removed so we don't have "bid griefing"
	
	#[payable]
    pub fn remove_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String,
	) {
        //assert one yocto for security reasons
		assert_one_yocto();
		
        //get the supposed maker and double check that they are the actual offer's maker
        let maker_id = env::predecessor_account_id();
		let (offer_id, offer) = self.get_offer(&contract_id, &token_id);

		require!(offer.maker_id == maker_id, "not offer maker");
		
		// token owner can remove offers anytime
		if offer.maker_id != offer.taker_id {
			require!(offer.updated_at < env::block_timestamp() - self.outbid_timeout, "Cannot remove new offers for 24hrs");
			// remove and pay back offer maker
			self.internal_remove_offer(offer_id, &offer, true);
			return;
		}
		// token owner does not get refund (no money was locked)
        self.internal_remove_offer(offer_id, &offer, false);
    }

	//accepts an offer. Only the taker ID can call this. Offer must have approval ID.
	#[payable]
    pub fn accept_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String,
	) {
        //assert one yocto for security reasons
		assert_one_yocto();

		//get offer id and object
		let (offer_id, offer) = self.get_offer(&contract_id, &token_id);

		require!(env::predecessor_account_id() == offer.taker_id, "Only token owner can accept offer");
		require!(offer.maker_id != offer.taker_id, "Token owner cannot accept their own offer");

		self.internal_accept_offer(offer_id, offer);
    }
}