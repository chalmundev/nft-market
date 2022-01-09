use crate::*;

#[ext_contract(ext_contract)]
trait ExtContract {
    fn nft_token(
        &mut self,
        token_id: String,
    ) -> Token;
    // fn nft_transfer_payout(
    //     &mut self,
    //     receiver_id: AccountId,
    //     token_id: TokenId,
    //     approval_id: u64,
    //     msg: Option<String>,
    //     balance: U128,
    // );
}