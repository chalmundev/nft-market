use std::collections::HashMap;

use near_sdk::{
	// log,
	require,
	env, ext_contract, near_bindgen, assert_one_yocto,
	Gas, Balance, AccountId, BorshStorageKey, PanicOnDefault,
	Promise, PromiseResult, promise_result_as_success, 
	collections::{Vector, LookupMap, UnorderedMap, UnorderedSet},
	borsh::{self, BorshDeserialize, BorshSerialize},
	serde::{Serialize, Deserialize},
	serde_json::from_str,
	json_types::{U128},
};

use crate::offer::*;
use crate::nft_traits::*;
use crate::internal::*;
use crate::self_callbacks::*;
pub use crate::events::*;

mod owner;
mod events;
mod storage;
mod views;
mod enumeration;
mod nft_traits;
mod internal;
mod nft_callbacks;
mod offer;
mod self_callbacks;

/// TODO verify gas amounts for cases like auto_transfer (unlikely to be able to use 115 Tgas, so what's the max royalties we can handle???)
pub const GAS_FOR_ROYALTIES: Gas = Gas(115_000_000_000_000);
pub const GAS_FOR_NFT_TRANSFER: Gas = Gas(15_000_000_000_000);

/// TODO where is this used and how can we measure and optimize?
pub const CALLBACK_GAS: Gas = Gas(30_000_000_000_000);

pub const DELIMETER: char = '|';
pub const NO_DEPOSIT: Balance = 0;

//Creating custom types to use within the contract. This makes things more readable. 
pub type TokenId = String;
//defines the payout type we'll be parsing from the NFT contract as a part of the royalty standard.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
} 

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
	OfferById,
	OfferByMakerId,
    OfferByMakerIdInner { maker_id: AccountId },
	OfferByTakerId,
    OfferByTakerIdInner { taker_id: AccountId },
	OfferByContractTokenId,
	OfferStorageByOwnerId,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
	owner_id: AccountId,
	outbid_timeout: u64,
	offer_storage_amount: Balance,
	min_bid_amount: Balance,
	market_balance: Balance,
	market_royalty: u32,
	offer_id: u64,
	offer_by_id: UnorderedMap<u64, Offer>,
	offers_by_maker_id: LookupMap<AccountId, UnorderedSet<u64>>,
	offers_by_taker_id: LookupMap<AccountId, UnorderedSet<u64>>,
	offer_by_contract_token_id: LookupMap<String, u64>,
	offer_storage_by_owner_id: LookupMap<AccountId, u64>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, market_royalty: u32) -> Self {
        Self {
			owner_id,
			outbid_timeout: 86_400_000_000_000, // 24hr
			offer_storage_amount: 20_000_000_000_000_000_000_000, // 2kb 0.02 N
			min_bid_amount: 99_999_999_999_999_999_999_999, // bids > 0.1 N
			market_balance: 0,
			market_royalty,
			offer_id: 0,
			offer_by_id: UnorderedMap::new(StorageKey::OfferById),
			offers_by_maker_id: LookupMap::new(StorageKey::OfferByMakerId),
			offers_by_taker_id: LookupMap::new(StorageKey::OfferByTakerId),
			offer_by_contract_token_id: LookupMap::new(StorageKey::OfferByContractTokenId),
			offer_storage_by_owner_id: LookupMap::new(StorageKey::OfferStorageByOwnerId),
        }
    }
}
