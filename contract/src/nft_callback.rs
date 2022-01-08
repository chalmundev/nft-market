use crate::*;

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
		let offer = self.offer_by_contract_token_id.get(&contract_token_id).unwrap_or_else(|| env::panic_str("no offer"));

		

		PromiseOrValue::Value("return".to_string())
    }
}
