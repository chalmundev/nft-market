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
				require!(self.offer_storage_available(&owner_id) > 0, "must add offer storage");

				self.internal_add_offer(Offer{
					maker_id: owner_id.clone(),
					taker_id: owner_id,
					contract_id: contract_id,
					token_id: token_id,
					amount,
					updated_at: env::block_timestamp(),
					approval_id: Some(approval_id),
				});
				return;
			}
			env::panic_str("no offer");
		}
		let offer_id = offer_id_option.unwrap();
		let mut offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));
		require!(offer.taker_id == owner_id, "not nft owner");
        
		//need to reset the approval ID in both the auto transfer case and the not auto transfer case. This is because process offer
        //takes the approval ID from the offer to use in nft_transfer_payout.
		offer.approval_id = Some(approval_id);

		// owner made offer of higher amount - replace offer
		if let Some(amount) = amount {
			if offer.amount.0 < amount.0 {
                //refund previous maker if they're not the owner
                if offer.taker_id != offer.maker_id {
                    Promise::new(offer.maker_id).transfer(offer.amount.0);
                }

				offer.maker_id = owner_id;
				offer.amount = amount;
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
			}
		}

		self.offer_by_id.insert(&offer_id, &offer);

        if auto_transfer.unwrap_or(false) == true {
            self.internal_accept_offer(offer_id, offer);
		}
    }
}
