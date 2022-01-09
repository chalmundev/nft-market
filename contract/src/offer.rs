use crate::*;

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

		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		if let Some(offer_id) = offer_id {
			// existing offer
			let mut offer = self.offer_by_id.get(&offer_id).unwrap();
			require!(offer.maker_id != maker_id, "can't outbid self");
			require!(offer_amount.0 > offer.amount.0 + MIN_OUTBID_AMOUNT, "must bid higher by 0.1 N");

			// save values in case we need to revert state in callback
			let prev_maker_id = offer.maker_id.clone();
			let prev_offer_amount = offer.amount.clone();
			// valid offer, money in contract, update state
			offer.maker_id = maker_id.clone();
			offer.amount = U128(env::attached_deposit());
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

        //remove the offer based on its ID
		self.internal_remove_offer(offer_id);

        //refund the user if they attached more storage than necesary. This will panic if they didn't attach enough.
        refund_storage(initial_storage_usage - env::storage_usage());
    }

    //private function used when an offer is purchased. 
    //this will remove the offer, transfer and get the payout from the nft contract, and then distribute royalties
    #[private]
    pub fn process_purchase(
        &mut self,
        nft_contract_id: AccountId,
        token_id: String,
        price: U128,
        maker_id: AccountId,
    ) -> Promise {
        let contract_and_token_id = get_contract_token_id(&nft_contract_id, &token_id);
        let offer_id = self.offer_by_contract_token_id.get(&contract_and_token_id).expect("no offer for the given contract and token ID");
        //get the offer object by removing the offer based on its ID
        let offer = self.internal_remove_offer(offer_id);

        //initiate a cross contract call to the nft contract. This will transfer the token to the buyer and return
        //a payout object used for the market to distribute funds to the appropriate accounts.
        ext_contract::nft_transfer_payout(
            maker_id.clone(), //purchaser (person to transfer the NFT to)
            token_id, //token ID to transfer
            offer.approval_id.expect("offer doesn't have an approval ID"), //market contract's approval ID in order to transfer the token on behalf of the owner
            "payout from market".to_string(), //memo (to include some context)
            /*
                the price that the token was purchased for. This will be used in conjunction with the royalty percentages
                for the token in order to determine how much money should go to which account. 
            */
            price,
			10, //the maximum amount of accounts the market can payout at once (this is limited by GAS)
            nft_contract_id, //contract to initiate the cross contract call to
            1, //yoctoNEAR to attach to the call
            GAS_FOR_NFT_TRANSFER, //GAS to attach to the call
        )
        //after the transfer payout has been initiated, we resolve the promise by calling our own resolve_purchase function. 
        //resolve purchase will take the payout object returned from the nft_transfer_payout and actually pay the accounts
        .then(ext_self::resolve_purchase(
            maker_id, //the buyer and price are passed in incase something goes wrong and we need to refund the buyer
            price,
            env::current_account_id(), //we are invoking this function on the current contract
            NO_DEPOSIT, //don't attach any deposit
            GAS_FOR_ROYALTIES, //GAS attached to the call to payout royalties
        ))
    }
}