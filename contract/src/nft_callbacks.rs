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

		let offer_event = |offer: &Offer| {
			env::log_str(&EventLog {
				event: EventLogVariant::UpdateOffer(OfferLog {
					contract_id: offer.contract_id.clone(),	
					token_id: offer.token_id.clone(),
					maker_id: offer.maker_id.clone(),
					taker_id: offer.taker_id.clone(),
					amount: offer.amount,
					updated_at: offer.updated_at,
				})
			}.to_string());
		};

		let offer_id_option = self.offer_by_contract_token_id.get(&contract_token_id);
		if offer_id_option.is_none() {
			// add a new offer where maker_id == taker_id (special case)
			// TODO can malicious NFT contract spoof owner_id and mess things up?
			if let Some(amount) = amount {
				require!(self.offer_storage_available(&owner_id) > 0, "must add offer storage");

				let offer = Offer{
					maker_id: owner_id.clone(),
					taker_id: owner_id,
					contract_id: contract_id,
					token_id: token_id,
					amount,
					updated_at: env::block_timestamp(),
					approval_id: Some(approval_id),
				};

				offer_event(&offer);

				self.internal_add_offer(offer);
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

		// accept offer case
		if amount.is_none() {
			self.offer_by_id.insert(&offer_id, &offer);

			if auto_transfer.unwrap_or(false) == true {
				self.internal_accept_offer(offer_id, offer);
			}
			return;
		}

		// owner outbid case (can counter higher or lower and the existing offer will be replaced with a priced offer)

		let amount = amount.unwrap();
		
		// save values in case we need to revert state in outbid_callback
		let prev_maker_id = offer.maker_id;
		let prev_offer_amount = offer.amount;
		let prev_updated_at = offer.updated_at;
		// valid offer, money in contract, update state
		offer.maker_id = owner_id;
		offer.amount = amount;
		offer.updated_at = env::block_timestamp();
		self.offer_by_id.insert(&offer_id, &offer);

		// this is an outbid scenario so we need to swap the offer makers
		self.internal_swap_offer_maker(offer_id, &prev_maker_id, &offer.maker_id);

		// refund previous maker if they're not the owner
		// this fires UpdateOffer so returning is ok after promise
		if offer.taker_id != offer.maker_id {
			// pay back prev offer maker + storage, if promise fails we'll revert state in outbid_callback
			Promise::new(prev_maker_id.clone())
			.transfer(prev_offer_amount.0 + self.offer_storage_amount)
			.then(ext_self::outbid_callback(
				offer_id,
				offer.maker_id,
				prev_maker_id,
				prev_offer_amount,
				prev_updated_at,
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
			return;
		}

		offer_event(&offer);
    }
}
