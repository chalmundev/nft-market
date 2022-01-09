mod utils;
mod nft_callback;
mod external;
mod self_callback;
mod enumeration;

use crate::self_callback::*;
use crate::external::*;
use crate::utils::*;

use near_sdk::{
	// log,
	require,
	env, ext_contract, near_bindgen, Gas, Balance, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseOrValue,
	borsh::{self, BorshDeserialize, BorshSerialize},
	serde::{Serialize, Deserialize},
	serde_json::from_str,
	collections::{Vector, LookupMap, UnorderedMap, UnorderedSet},
	json_types::{U128},
	assert_one_yocto,
	promise_result_as_success,
};

pub const DEFAULT_OFFER_TOKEN: &str = "near";
pub const MIN_OUTBID_AMOUNT: Balance = 99_000_000_000_000_000_000_000; // 5kb (bid > 0.1N)
pub const DEFAULT_OFFER_STORAGE_AMOUNT: Balance = 50_000_000_000_000_000_000_000; // 5kb (0.05N)
pub const CALLBACK_GAS: Gas = Gas(30_000_000_000_000); // 30 Tgas
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
    amount: U128,
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
    pub fn make_offer(
		&mut self,
		contract_id: AccountId,
		token_id: String,
	) {
		let maker_id = env::predecessor_account_id();
		let contract_token_id = get_contract_token_id(&contract_id, &token_id);
		let offer_amount = U128(env::attached_deposit() - DEFAULT_OFFER_STORAGE_AMOUNT);

		let offer_id = self.offer_by_contract_token_id.get(&contract_token_id);

		if let Some(offer_id) = offer_id {
			// existing offer
			let offer = self.offer_by_id.get(&offer_id).unwrap();
			require!(offer.maker_id != maker_id, "can't outbid self");
			require!(offer_amount.0 > offer.amount.0 + MIN_OUTBID_AMOUNT, "must bid higher by 0.1 N");

			Promise::new(offer.maker_id)
				.transfer(offer.amount.0)
				.then(ext_self::outbid_callback(
					offer_id,
					maker_id,
					env::current_account_id(),
					offer_amount.0,
					CALLBACK_GAS,
				));
		} else {
			// new offer
			ext_contract::nft_token(
				token_id,
				contract_id.clone(),
				0,
				env::prepaid_gas() - CALLBACK_GAS - CALLBACK_GAS,
			).then(ext_self::offer_callback(
				maker_id,
				contract_id,
				env::current_account_id(),
				offer_amount.0,
				CALLBACK_GAS,
			));

		}

    }

	#[payable]
    pub fn remove_offer(
		&mut self,
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
