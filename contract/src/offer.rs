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
		amount: Option<U128>,
	) {
		let maker_id = env::predecessor_account_id();
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_amount = U128(env::attached_deposit() - DEFAULT_OFFER_STORAGE_AMOUNT);
		require!(offer_amount.0 > MIN_OUTBID_AMOUNT, "must be higher than min bid ???");

		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		if let Some(offer_id) = offer_id {
			// offer exists
			let mut offer = self.offer_by_id.get(&offer_id).unwrap();

			// existing offer is not by the token owner
			if offer.maker_id != offer.taker_id {
				require!(offer.maker_id != maker_id, "can't outbid self");
				require!(offer_amount.0 > offer.amount.0 + MIN_OUTBID_AMOUNT, "must bid higher by ???");
			} else {
				// offer is by the token owner
				if maker_id == offer.maker_id {
					// make_offer caller is offer maker
					offer.amount = amount.unwrap_or_else(|| env::panic_str("must specify offer amount"));
					self.offer_by_id.insert(&offer_id, &offer);
					return;
				} else {
					// make_offer caller is NOT offer maker
					if offer.approval_id.is_some() && offer_amount.0 == offer.amount.0 {
						// auto sell???
					}
				}
			}

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
			).then(ext_self::new_offer_callback(
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

		//make sure there's an approval ID.
		let approval_id = offer.approval_id.unwrap_or_else(|| env::panic_str("Cannot accept an offer that has no approval ID"));

		//increment market holding amount
        let market_amount = self.market_royalty as u128 * offer.amount.0 / 10_000u128;
		self.market_balance += market_amount;
		let payout_amount = U128(offer.amount.0.checked_sub(market_amount).unwrap_or_else(|| env::panic_str("Market holding amount too high."))); 
		
		//initiate a cross contract call to the nft contract. This will transfer the token to the buyer and return
		//a payout object used for the market to distribute funds to the appropriate accounts.
		ext_contract::nft_transfer_payout(
			offer.maker_id.clone(), //maker of the offer (person to transfer the NFT to)
			offer.token_id, //token ID to transfer
			approval_id, //market contract's approval ID in order to transfer the token on behalf of the owner
			"payout from market".to_string(), //memo (to include some context)
			/*
				the price that the token was offered for. This will be used in conjunction with the royalty percentages
				for the token in order to determine how much money should go to which account. 
			*/
			payout_amount,
			10, //the maximum amount of accounts the market can payout at once (this is limited by GAS)
			offer.contract_id, //contract to initiate the cross contract call to
			1, //yoctoNEAR to attach to the call
			GAS_FOR_NFT_TRANSFER, //GAS to attach to the call
		)
		//after the transfer payout has been initiated, we resolve the promise by calling our own resolve_offer function. 
		//resolve offer will take the payout object returned from the nft_transfer_payout and actually pay the accounts
		.then(ext_self::resolve_offer(
			offer_id,
			offer.maker_id,
			offer.taker_id, //pass the offer_id
			payout_amount,
			market_amount,
			env::current_account_id(), //we are invoking this function on the current contract
			NO_DEPOSIT, //don't attach any deposit
			GAS_FOR_ROYALTIES, //GAS attached to the call to payout royalties
		));
    }
}