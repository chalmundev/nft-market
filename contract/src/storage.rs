use crate::*;

#[near_bindgen]
impl Contract {
	#[payable]
	pub fn pay_offer_storage(&mut self, owner_id: Option<AccountId>, num: Option<u64>) {
		let num = num.unwrap_or_else(|| 1);
		require!(env::attached_deposit() == num as u128 * self.offer_storage_amount, "attach deposit to pay for storage");
		let owner_id = owner_id.unwrap_or_else(|| env::predecessor_account_id());
		self.offer_storage_by_owner_id.insert(&owner_id, &(
			self.offer_storage_by_owner_id.get(&owner_id).unwrap_or_else(|| 0) + num
		));
    }

	pub(crate) fn internal_withdraw_one_storage(&mut self, owner_id: &AccountId) {
		let offer_storage_count = self.offer_storage_by_owner_id.get(&owner_id).unwrap_or_else(|| 0);
		if offer_storage_count == 0 {
			return;
		}
		self.offer_storage_by_owner_id.insert(&owner_id, &(offer_storage_count - 1));
		Promise::new(owner_id.clone()).transfer(self.offer_storage_amount);
	}

	pub fn withdraw_offer_storage(&mut self) {
		let owner_id = env::predecessor_account_id();
		let mut offer_count = 0;
		let offers_by_maker_id = self.offers_by_maker_id.get(&owner_id);
		if offers_by_maker_id.is_some() {
			offer_count = offers_by_maker_id.unwrap().len();
		}
		let offer_storage_count = self.offer_storage_by_owner_id.get(&owner_id).unwrap_or_else(|| 0);
		let diff = offer_storage_count.checked_sub(offer_count).unwrap_or_else(|| 0);
		if diff > 0 {
			if offer_count == 0 && offer_storage_count == 0 {
				self.offer_storage_by_owner_id.remove(&owner_id);
			} else {
				self.offer_storage_by_owner_id.insert(&owner_id, &offer_count);
			}
			// TODO add callback to revert self.offer_storage_by_owner_id if refund fails
			Promise::new(owner_id.clone()).transfer(diff as u128 * self.offer_storage_amount)
			.then(ext_self::on_withdraw_offer_storage(
				owner_id,
				offer_storage_count,
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }

	/// view

	pub fn offer_storage_available(&self, owner_id: &AccountId) -> u64 {
		let mut offer_count = 0;
		let offers_by_maker_id = self.offers_by_maker_id.get(owner_id);
		if offers_by_maker_id.is_some() {
			offer_count = offers_by_maker_id.unwrap().len();
		}
		let offer_storage_count = self.offer_storage_by_owner_id.get(owner_id).unwrap_or_else(|| 0);
		offer_storage_count.checked_sub(offer_count).unwrap_or_else(|| 0)
    }

	pub fn offer_storage_amount(&self) -> U128 {
		U128(self.offer_storage_amount)
	}
}