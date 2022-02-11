use crate::*;

#[near_bindgen]
impl Contract {

	pub fn remove_offer_owner(
		&mut self,
		contract_id: AccountId,
		token_id: String,
	) {
        self.assert_owner();
		let (offer_id, offer) = self.get_offer(&contract_id, &token_id);
        self.internal_remove_offer_state(offer_id, &offer);
    }
	
	// TODO add from_index and limit, iter.skip.take.collect then loop
	// TODO need to have one for offers_by_maker/taker_id ...
	pub fn remove_offers(&mut self) {
        self.assert_owner();
        self.offer_by_id.clear();
		// for (offer_id, offer) in offer_vec {
		// 	// TODO remove for production
		// 	// if offer.has_failed_promise {
		// 		self.internal_remove_offer(offer_id, &offer);
		// 	// }
		// }
    }

	pub fn remove_offers_by_maker_id(&mut self, account_id: AccountId) {
        self.assert_owner();
		let mut set = self.offers_by_maker_id.get(&account_id).unwrap_or_else(|| env::panic_str("no set"));
		set.clear();
		self.offers_by_maker_id.remove(&account_id);
    }

	pub fn remove_offers_by_taker_id(&mut self, account_id: AccountId) {
        self.assert_owner();
		let mut set = self.offers_by_taker_id.get(&account_id).unwrap_or_else(|| env::panic_str("no set"));
		set.clear();
		self.offers_by_taker_id.remove(&account_id);
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
			let previous_balance = self.market_balance;
			self.market_balance = 0;
			Promise::new(receiving_account)
			.transfer(previous_balance)
			.then(ext_self::on_withdraw_balance(
				previous_balance,
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }

    pub(crate) fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Owner's method");
    }
}