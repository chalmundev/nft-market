use crate::*;

#[ext_contract(ext_contract)]
trait ExtContract {
    fn nft_token(
        &mut self,
        token_id: String,
    ) -> Token;
    fn nft_transfer_payout(
        &mut self,
        receiver_id: AccountId, //offerer (person to transfer the NFT to)
        token_id: TokenId, //token ID to transfer
        approval_id: u64, //market contract's approval ID in order to transfer the token on behalf of the owner
        memo: String, //memo (to include some context)
        /*
            the price that the token was offered for. This will be used in conjunction with the royalty percentages
            for the token in order to determine how much money should go to which account. 
        */
        balance: U128,
        //the maximum amount of accounts the market can payout at once (this is limited by GAS)
		max_len_payout: u32,
    );
}