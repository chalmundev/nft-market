use crate::*;

#[near_bindgen]
impl Contract {
	
	// TODO add from_index and limit, iter.skip.take.collect then loop
	pub fn remove_offers(&mut self) {
        self.assert_owner();
        let offer_vec = self.offer_by_id.to_vec();
		for (offer_id, offer) in offer_vec {
			// TODO remove for production
			// if offer.has_failed_promise {
				self.internal_remove_offer(offer_id, &offer);
			// }
		}
    }

	//change the royalty percentage that the market receives.
	pub fn change_market_royalty(&mut self, market_royalty: u32) {
        self.assert_owner();
        self.market_royalty = market_royalty;
    }

	//withdraw any excess market balance to an external account.
	pub fn withdraw_market_balance(&mut self, receiving_account: AccountId) {
        self.assert_owner();
		if self.market_balance > 0 {
			self.market_balance = 0;
			Promise::new(receiving_account)
			.transfer(self.market_balance)
			.then(ext_self::on_withdraw_balance(
				self.market_balance,
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }

    pub(crate) fn assert_owner(&self) {
        assert_eq!(
            &env::predecessor_account_id(),
            &self.owner_id,
            "Owner's method"
        );
    }
}