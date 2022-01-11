use crate::*;

#[near_bindgen]
impl Contract {
	//change the royalty percentage that the market receives.
	pub fn change_market_royalty(&mut self, market_royalty: u32) {
        self.assert_owner();
        self.market_royalty = market_royalty;
    }

	//withdraw any excess market holdings to an external account.
	pub fn withdraw_market_holdings(&mut self, receiving_account: AccountId) {
        self.assert_owner();
		if self.market_holdings > 0 {
			Promise::new(receiving_account)
			.transfer(self.market_holdings)
			.then(ext_self::on_withdraw_holdings(
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }
}