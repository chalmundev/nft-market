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
	pub has_failed_promise: bool,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn make_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String,
		amount: Option<U128>,
	) {
		let maker_id = env::predecessor_account_id();
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_amount = U128(env::attached_deposit() - DEFAULT_OFFER_STORAGE_AMOUNT);
		self.internal_increase_offer_storage(&maker_id, None);
		require!(offer_amount.0 > MIN_OUTBID_AMOUNT, "must be higher than min bid ???");

		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		if let Some(offer_id) = offer_id {
			// offer exists
			let mut offer = self.offer_by_id.get(&offer_id).unwrap();

			// existing offer is not by the token owner - check offer reqs
			if offer.maker_id != offer.taker_id {
				require!(offer.maker_id != maker_id, "can't outbid self");
				require!(offer.taker_id != maker_id, "owner can't outbid");
				require!(offer_amount.0 > offer.amount.0 + MIN_OUTBID_AMOUNT, "must bid higher by ???");
				// continue execution below - alice outbids bob
			} else {
				// offer made by token owner on offer created by token owner (price adjustment)
				if maker_id == offer.maker_id {
					// make_offer caller is offer maker
					offer.amount = amount.unwrap_or_else(|| env::panic_str("must specify offer amount"));
					offer.updated_at = env::block_timestamp();
					self.offer_by_id.insert(&offer_id, &offer);

					env::log_str(&EventLog {
						event: EventLogVariant::UpdateOffer(OfferLog {
							contract_id: offer.contract_id,	
							token_id: offer.token_id,
							maker_id: offer.maker_id,
							taker_id: offer.taker_id,
							amount: offer.amount,
							updated_at: offer.updated_at,
						})
					}.to_string());

					return;
				} else {
					// current offer created by token owner, new offer is not token owner
					if offer.approval_id.is_some() {
						if offer.amount.0 != OPEN_OFFER_AMOUNT {
							if offer_amount.0 >= offer.amount.0 {
								offer.amount = offer_amount;
								offer.maker_id = maker_id;
								self.internal_accept_offer(offer_id, &offer);
								return;
							}
							env::panic_str("bid not greater than offer amount");
						}
						// continue execution below - alice outbids token owner because offer.amount == OPEN_OFFER_AMOUNT (open for bids)
					}
				}
			}

			// save values in case we need to revert state in callback
			let prev_maker_id = offer.maker_id.clone();
			let prev_offer_amount = offer.amount.clone();
			let prev_updated_at = offer.updated_at.clone();
			// valid offer, money in contract, update state
			offer.maker_id = maker_id.clone();
			offer.amount = offer_amount;
			offer.updated_at = env::block_timestamp();
			self.offer_by_id.insert(&offer_id, &offer);

			// first non-owner bid
			if prev_offer_amount.0 == OPEN_OFFER_AMOUNT {
				env::log_str(&EventLog {
					event: EventLogVariant::UpdateOffer(OfferLog {
						contract_id: offer.contract_id,	
						token_id: offer.token_id,
						maker_id: offer.maker_id,
						taker_id: offer.taker_id,
						amount: offer.amount,
						updated_at: offer.updated_at,
					})
				}.to_string());
				return;
			}
			// pay back prev offer maker + storage
			Promise::new(prev_maker_id.clone())
				.transfer(prev_offer_amount.0 + DEFAULT_OFFER_STORAGE_AMOUNT)
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
			return;
		}

		// new offer
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
    }

	#[payable]
    pub fn remove_offer(
		&mut self,
		offer_id: u64
	) {
        //assert one yocto for security reasons
		assert_one_yocto();

        //get the supposed maker and double check that they are the actual offer's maker
        let maker_id = env::predecessor_account_id();
		let offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));

		require!(offer.maker_id == maker_id, "not maker");

        //remove the offer based on its ID and offer object.
        self.internal_remove_offer(offer_id, &offer);

		// pay back storage to current offer maker
		Promise::new(offer.maker_id).transfer(DEFAULT_OFFER_STORAGE_AMOUNT);
    }

	//accepts an offer. Only the taker ID can call this. Offer must have approval ID.
	#[payable]
    pub fn accept_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String
	) {
        //assert one yocto for security reasons
		assert_one_yocto();

		//get offer object
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id).unwrap_or_else(|| env::panic_str("no offer ID for contract and token ID"));
		let offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer for offer ID"));

		self.internal_accept_offer(offer_id, &offer);
    }
}