use crate::*;

#[near_bindgen]
impl Contract {
	//change the royalty percentage that the market receives.
	pub fn change_market_royalty(&mut self, market_royalty: u32) {
        self.assert_owner();
        self.market_royalty = market_royalty;
    }

	//withdraw any excess market balance to an external account.
	pub fn withdraw_market_balance(&mut self, receiving_account: AccountId) {
        self.assert_owner();
		if self.market_balance > 0 {
			Promise::new(receiving_account)
			.transfer(self.market_balance)
			.then(ext_self::on_withdraw_balance(
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }
}