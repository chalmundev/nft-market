mod utils;
mod nft_callback;
mod enumeration;

use crate::utils::*;

use near_sdk::{
	// log,
	require,
	env, near_bindgen, Balance, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseOrValue,
	borsh::{self, BorshDeserialize, BorshSerialize},
	serde::{Serialize, Deserialize},
	serde_json::from_str,
	collections::{Vector, LookupMap, UnorderedMap, UnorderedSet},
	json_types::{U128},
	assert_one_yocto,
};

pub const DEFAULT_OFFER_TOKEN: &str = "near";
pub const DELIMETER: char = '|';

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
	OfferById,
	OfferByMakerId,
    OfferByMakerIdInner { maker_id: AccountId },
	OfferByTakerId,
    OfferByTakerIdInner { taker_id: AccountId },
	OfferByContractTokenId,
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
	offer_by_contract_token_id: LookupMap<String, u64>,
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
			offer_by_contract_token_id: LookupMap::new(StorageKey::OfferByContractTokenId),
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

		// Get the offer ID.
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);

		let existing_offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		// If taker approved the token already, panic.
		if existing_offer_id.is_some() {
			let existing_approval_id = self.offer_by_id.get(&existing_offer_id.unwrap()).unwrap().approval_id;
			if existing_approval_id.is_some() {
				env::panic_str("Token owner has accepted an existing offer. Try again later.")
			}
		}

		let offer = Offer{
			maker_id: maker_id.clone(),
			taker_id: taker_id.clone(),
			contract_id: contract_id.clone(),
			token_id,
			offer_amount,
			offer_token: offer_token.unwrap_or_else(|| DEFAULT_OFFER_TOKEN.into()),
			created_at: env::block_timestamp(),
			approval_id: None,
		};

		self.offer_id += 1;
		self.offer_by_id.insert(&self.offer_id, &offer);

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
	
		let contract_token_id = get_contract_token_id(&offer.contract_id, &offer.token_id);
		self.offer_by_contract_token_id.insert(
			&contract_token_id.clone(),
			&self.offer_id
		);

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

		self.offers_by_maker_id.insert(
			&maker_id,
			&map_set_remove(
				&self.offers_by_maker_id,
				&maker_id,
				offer_id,
			)
		);

		self.offers_by_taker_id.insert(
			&maker_id,
			&map_set_remove(
				&self.offers_by_taker_id,
				&offer.taker_id,
				offer_id,
			)
		);

		let contract_token_id = get_contract_token_id(&offer.contract_id, &offer.token_id);
		self.offer_by_contract_token_id.remove(&contract_token_id);

		refund_storage(initial_storage_usage - env::storage_usage());
    }
}