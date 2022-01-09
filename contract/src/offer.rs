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
    pub created_at: u64,
	pub approval_id: Option<u64>,
	pub has_failed_promise: bool,
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
		let offer_amount = U128(env::attached_deposit() - DEFAULT_OFFER_STORAGE_AMOUNT);
		require!(offer_amount.0 > MIN_OUTBID_AMOUNT, "must be higher than min bid ???");

		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		if let Some(offer_id) = offer_id {
			// existing offer
			let mut offer = self.offer_by_id.get(&offer_id).unwrap();
			require!(offer.maker_id != maker_id, "can't outbid self");
			require!(offer_amount.0 > offer.amount.0 + MIN_OUTBID_AMOUNT, "must bid higher by ???");

			// save values in case we need to revert state in callback
			let prev_maker_id = offer.maker_id.clone();
			let prev_offer_amount = offer.amount.clone();
			// valid offer, money in contract, update state
			offer.maker_id = maker_id.clone();
			offer.amount = U128(offer_amount.0);
			self.offer_by_id.insert(&offer_id, &offer);

			// pay back prev offer maker + storage
			Promise::new(offer.maker_id)
				.transfer(offer.amount.0 + DEFAULT_OFFER_STORAGE_AMOUNT)
				.then(ext_self::outbid_callback(
					offer_id,
					maker_id,
					prev_maker_id,
					prev_offer_amount,
					env::current_account_id(),
					offer_amount.0,
					CALLBACK_GAS,
				));
		} else {
			// new offer
			ext_contract::nft_token(
				token_id,
				contract_id.clone(),
				0,
				env::prepaid_gas() - CALLBACK_GAS - CALLBACK_GAS,
			).then(ext_self::offer_callback(
				maker_id,
				contract_id,
				env::current_account_id(),
				offer_amount.0,
				CALLBACK_GAS,
			));

		}

    }

	#[payable]
    pub fn remove_offer(
		&mut self,
		offer_id: u64
	) {
        //assert one yocto for security reasons
		assert_one_yocto();

        //get the initial storage
		let initial_storage_usage = env::storage_usage();

        //get the supposed maker and double check that they are the actual offer's maker
        let maker_id = env::predecessor_account_id();
		let offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));

		require!(offer.maker_id == maker_id, "not maker");

        //remove the offer based on its ID and offer object.
        self.internal_remove_offer(offer_id, &offer);

        //refund the user if they attached more storage than necesary. This will panic if they didn't attach enough.
        refund_storage(initial_storage_usage - env::storage_usage());
    }
}