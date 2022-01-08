mod utils;

use crate::utils::*;

use near_sdk::{
	// log,
	require,
	env, near_bindgen, Balance, AccountId, BorshStorageKey, PanicOnDefault, Promise,
	borsh::{self, BorshDeserialize, BorshSerialize},
	serde::{Serialize, Deserialize},
	collections::{Vector, LookupMap, UnorderedMap, UnorderedSet},
	json_types::{U128},
	assert_one_yocto,
};

pub const DEFAULT_OFFER_TOKEN: &str = "near";

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
	OfferById,
	OfferByMakerId,
    OfferByMakerIdInner { maker_id: AccountId },
	OfferByTakerId,
    OfferByTakerIdInner { taker_id: AccountId },
}

#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Offer {
    maker_id: AccountId,
    taker_id: AccountId,
	contract_id: AccountId,
    token_id: String,
    offer_amount: U128,
    offer_token: String,
    created_at: u64,
	approval_id: Option<u64>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
	owner_id: AccountId,
	offer_id: u64,
	offer_by_id: UnorderedMap<u64, Offer>,
	offers_by_maker_id: LookupMap<AccountId, UnorderedSet<u64>>,
	offers_by_taker_id: LookupMap<AccountId, UnorderedSet<u64>>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
			owner_id,
			offer_id: 0,
			offer_by_id: UnorderedMap::new(StorageKey::OfferById),
			offers_by_maker_id: LookupMap::new(StorageKey::OfferByMakerId),
			offers_by_taker_id: LookupMap::new(StorageKey::OfferByTakerId),
        }
    }
	
    #[payable]
    pub fn make_offer(&mut self,
		taker_id: AccountId,
		contract_id: AccountId,
		token_id: String,
		offer_amount: U128,
		offer_token: Option<String>
	) {
		let initial_storage_usage = env::storage_usage();

		let maker_id = env::predecessor_account_id();

		let offer = Offer{
			maker_id: maker_id.clone(),
			taker_id: taker_id.clone(),
			contract_id,
			token_id,
			offer_amount,
			offer_token: offer_token.unwrap_or_else(|| DEFAULT_OFFER_TOKEN.into()),
			created_at: env::block_timestamp(),
			approval_id: None,
		};

		self.offer_id += 1;
		self.offer_by_id.insert(&self.offer_id, &offer);

		let mut offers_by_maker_id = self.offers_by_maker_id.get(&maker_id).unwrap_or_else(|| {
			UnorderedSet::new(StorageKey::OfferByMakerIdInner { maker_id: maker_id.clone() })
		});
		offers_by_maker_id.insert(&self.offer_id);
		self.offers_by_maker_id.insert(&maker_id, &offers_by_maker_id);

		let mut offers_by_taker_id = self.offers_by_taker_id.get(&taker_id).unwrap_or_else(|| {
			UnorderedSet::new(StorageKey::OfferByTakerIdInner { taker_id: taker_id.clone() })
		});
		offers_by_taker_id.insert(&self.offer_id);
		self.offers_by_taker_id.insert(&taker_id, &offers_by_taker_id);

		refund_deposit(env::storage_usage() - initial_storage_usage, Some(offer_amount.into()));
    }

	#[payable]
    pub fn remove_offer(&mut self,
		offer_id: u64
	) {
		assert_one_yocto();

		let initial_storage_usage = env::storage_usage();

		let maker_id = env::predecessor_account_id();

		let offer = self.offer_by_id.get(&offer_id).unwrap_or_else(|| env::panic_str("no offer"));

		require!(offer.maker_id == maker_id, "not maker");

		self.offer_by_id.remove(&offer_id);

		let mut offers_by_maker_id = self.offers_by_maker_id.get(&maker_id).unwrap_or_else(|| env::panic_str("no offer"));
		offers_by_maker_id.remove(&offer_id);
		self.offers_by_maker_id.insert(&maker_id, &offers_by_maker_id);

		let mut offers_by_taker_id = self.offers_by_taker_id.get(&offer.taker_id).unwrap_or_else(|| env::panic_str("no offer"));
		offers_by_taker_id.remove(&offer_id);
		self.offers_by_taker_id.insert(&offer.taker_id, &offers_by_taker_id);

		refund_storage(initial_storage_usage - env::storage_usage());
    }
    
	/// views

    pub fn get_offers(&self, from_index: Option<U128>, limit: Option<u64>) -> (Vec<u64>, Vec<Offer>) {
		(
			unordered_map_key_pagination(&self.offer_by_id, from_index, limit),
			unordered_map_val_pagination(&self.offer_by_id, from_index, limit)
		)
    }
}