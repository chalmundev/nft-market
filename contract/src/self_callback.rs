use crate::*;

#[ext_contract(ext_self)]
pub trait SelfContract {
	fn offer_callback(&mut self,
		maker_id: AccountId,
		contract_id: AccountId,
	);
    fn outbid_callback(&mut self,
		offer_id: u64,
		maker_id: AccountId,
	);
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub token_id: String,
    pub owner_id: AccountId,
}

#[near_bindgen]
impl Contract {

    #[payable]
	pub fn offer_callback(&mut self,
		maker_id: AccountId,
		contract_id: AccountId,
	) {
		// check promise result
		let result = promise_result_as_success().unwrap_or_else(|| env::panic_str("not a valid token"));
		let Token{ token_id, owner_id: taker_id } = near_sdk::serde_json::from_slice::<Token>(&result).unwrap_or_else(|_| env::panic_str("not a valid token"));
		
		let amount = U128(env::attached_deposit());
		self.offer_id += 1;

		self.offer_by_id.insert(&self.offer_id, &Offer{
			maker_id: maker_id.clone(),
			taker_id: taker_id.clone(),
			contract_id: contract_id.clone(),
			token_id: token_id.clone(),
			amount,
			created_at: env::block_timestamp(),
			approval_id: None,
		});

		self.offers_by_maker_id.insert(
			&maker_id, 
			&map_set_insert(
				&self.offers_by_maker_id, 
				&maker_id, 
				StorageKey::OfferByMakerIdInner { maker_id: maker_id.clone() },
				self.offer_id
			)
		);
	
		self.offers_by_taker_id.insert(
			&taker_id, 
			&map_set_insert(
				&self.offers_by_taker_id, 
				&taker_id, 
				StorageKey::OfferByTakerIdInner { taker_id: taker_id.clone() },
				self.offer_id
			)
		);
	
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		self.offer_by_contract_token_id.insert(
			&contract_token_id.clone(),
			&self.offer_id
		);


	}

    #[payable]
	pub fn outbid_callback(&mut self,
		offer_id: u64,
		maker_id:AccountId,
	) {
		let mut offer = self.offer_by_id.get(&offer_id).unwrap();

		offer.maker_id = maker_id;
		offer.amount = U128(env::attached_deposit());

		self.offer_by_id.insert(&offer_id, &offer);
	}
}
