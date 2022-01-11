use crate::*;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OfferArgs {
    pub amount: Option<U128>,
    pub auto_transfer: Option<bool>,
}
pub trait NonFungibleTokenApprovalReceiver {
    fn nft_on_approve(
        &mut self, 
        token_id: String, 
        owner_id: AccountId, 
        approval_id: u64, 
        msg: String
    );
}

#[near_bindgen]
impl NonFungibleTokenApprovalReceiver for Contract {
    #[payable]
    fn nft_on_approve(
        &mut self,
        token_id: String,
        owner_id: AccountId,
        approval_id: u64,
        msg: String,
    ) {
        let contract_id = env::predecessor_account_id();
        let signer_id = env::signer_account_id();

        require!(contract_id != signer_id, "nft_on_approve must be called via a cross-contract call. Signer cannot equal predecessor");

		let contract_token_id = get_contract_token_id(&contract_id, &token_id);

		let OfferArgs { 
			amount,
			auto_transfer
		} = from_str(&msg).unwrap_or_else(|_| env::panic_str("invalid offer args"));

		let offer_id_option = self.offer_by_contract_token_id.get(&contract_token_id);
		if offer_id_option.is_none() {
			// add a new offer where maker_id == taker_id (special case)
			// TODO can malicious NFT contract spoof owner_id and mess things up?
			if let Some(amount) = amount {
				self.internal_add_offer(&Offer{
					maker_id: owner_id.clone(),
					taker_id: owner_id,
					contract_id: contract_id,
					token_id: token_id,
					amount,
					created_at: env::block_timestamp(),
					approval_id: Some(approval_id),
					has_failed_promise: false,
				});
				return;
			}
			env::panic_str("no offer");
		}
		let offer_id = offer_id_option.unwrap();
		let mut offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));
		require!(offer.taker_id == owner_id, "not nft owner");
        
		// owner made offer of higher amount - replace offer
		if let Some(amount) = amount {
			if offer.amount.0 < amount.0 {
				offer.maker_id = owner_id;
				offer.amount = amount;
				return;
			}
		}

		//need to reset the approval ID in both the auto transfer case and the not auto transfer case. This is because process offer
        //takes the approval ID from the offer to use in nft_transfer_payout.
        offer.approval_id = Some(approval_id);
		self.offer_by_id.insert(&offer_id, &offer);

        if auto_transfer.unwrap_or(false) == true {
            let market_amount = self.market_royalty as u128 * offer.amount.0 / 10_000u128;
            self.market_balance += market_amount; 

            let amount_to_payout = U128(offer.amount.0.checked_sub(market_amount).unwrap_or_else(|| env::panic_str("Market holding amount too high."))); 
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
                amount_to_payout,
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
                amount_to_payout,
                market_amount,
                env::current_account_id(), //we are invoking this function on the current contract
                NO_DEPOSIT, //don't attach any deposit
                GAS_FOR_ROYALTIES, //GAS attached to the call to payout royalties
            ));
		}
    }
}
