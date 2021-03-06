use crate::*;

#[near_bindgen]
impl Contract {

    // Get list of all offers
    pub fn get_offers(&self, from_index: Option<U128>, limit: Option<u64>) -> (Vec<u64>, Vec<Offer>) {
        (
            unordered_map_key_pagination(&self.offer_by_id, from_index, limit),
            unordered_map_val_pagination(&self.offer_by_id, from_index, limit)
        )
    }

	// get offers by maker_id
    pub fn get_offers_by_maker_id(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> (u64, Vec<Offer>) {
		let set_option = self.offers_by_maker_id.get(&account_id);
		if set_option.is_none() {
			return (0, vec![]);
		}
		let set = set_option.unwrap();
		(set.len(), self.id_to_offer(paginate(set.as_vector(), from_index, limit)))
    }
	
	// get offers by maker_id
    pub fn get_offers_by_taker_id(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> (u64, Vec<Offer>) {
        let set_option = self.offers_by_taker_id.get(&account_id);
		if set_option.is_none() {
			return (0, vec![]);
		}
		let set = set_option.unwrap();
		(set.len(), self.id_to_offer(paginate(set.as_vector(), from_index, limit)))
    }

    // Get information about a specific offer
    pub fn get_offer(&self, contract_id: &AccountId, token_id: &String) -> (u64, Offer) {
		let offer_id = self.offer_by_contract_token_id.get(&get_contract_token_id(contract_id, token_id)).expect("No offer for the token and contract ID");
        (
			offer_id,
			self.offer_by_id.get(&offer_id).unwrap()
		)
    }

}
