use crate::*;

#[near_bindgen]
impl Contract {
	#[payable]
	pub fn pay_offer_storage(&mut self, owner_id: Option<AccountId>) {
		let attached_deposit = env::attached_deposit();
		require!(attached_deposit >= DEFAULT_OFFER_STORAGE_AMOUNT, "must attach at least 1 storage amount");
		self.internal_increase_offer_storage(
			&owner_id.unwrap_or_else(|| env::predecessor_account_id()),
			Some(u64::try_from(env::attached_deposit() / DEFAULT_OFFER_STORAGE_AMOUNT).unwrap())
		);
    }

	pub(crate) fn internal_increase_offer_storage(&mut self, owner_id: &AccountId, num: Option<u64>) {
		self.offer_storage_by_owner_id.insert(&owner_id, &(
			self.offer_storage_by_owner_id.get(&owner_id).unwrap_or_else(|| 0) + num.unwrap_or_else(|| 1)
		));
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
			Promise::new(owner_id.clone()).transfer(diff as u128 * DEFAULT_OFFER_STORAGE_AMOUNT)
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
}