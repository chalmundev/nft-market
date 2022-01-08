use crate::*;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OfferArgs {
    pub auto_transfer: Option<bool>
}
pub trait NonFungibleTokenApprovalReceiver {
    fn nft_on_approve(
        &mut self, 
        token_id: String, 
        owner_id: AccountId, 
        approval_id: u64, 
        msg: String
    ) -> PromiseOrValue<String>;
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
    ) -> PromiseOrValue<String> {
        let contract_id = env::predecessor_account_id();

		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id).unwrap_or_else(|| env::panic_str("no offer"));
		let mut offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));

		require!(offer.taker_id == owner_id, "not nft owner");

		let OfferArgs { auto_transfer } = from_str(&msg).unwrap_or_else(|_| env::panic_str("invalid offer args"));

		if auto_transfer.is_some() {
			
		} else {
			offer.approval_id = Some(approval_id);
			self.offer_by_id.insert(&offer_id, &offer);
		}

		PromiseOrValue::Value("return".to_string())
    }
}
