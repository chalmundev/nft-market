use std::collections::HashMap;

use near_sdk::{
	// log,
	require,
	env, ext_contract, near_bindgen, assert_one_yocto,
	Gas, Balance, AccountId, BorshStorageKey, PanicOnDefault,
	Promise, PromiseResult, PromiseOrValue, promise_result_as_success, 
	borsh::{self, BorshDeserialize, BorshSerialize},
	serde::{Serialize, Deserialize},
	serde_json::from_str,
	collections::{Vector, LookupMap, UnorderedMap, UnorderedSet},
	json_types::{U128},
};

use crate::offer::*;
use crate::nft_traits::*;
use crate::internal::*;
use crate::self_callbacks::*;

mod enumeration;
mod nft_traits;
mod internal;
mod nft_callbacks;
mod offer;
mod self_callbacks;

//GAS constants to attach to calls
const GAS_FOR_ROYALTIES: Gas = Gas(115_000_000_000_000);
const GAS_FOR_NFT_TRANSFER: Gas = Gas(15_000_000_000_000);

pub const DEFAULT_OFFER_TOKEN: &str = "near";
pub const MIN_OUTBID_AMOUNT: Balance = 99_000_000_000_000_000_000_000; // 5kb (bid > 0.1N)
pub const DEFAULT_OFFER_STORAGE_AMOUNT: Balance = 50_000_000_000_000_000_000_000; // 5kb (0.05N)
pub const CALLBACK_GAS: Gas = Gas(30_000_000_000_000); // 30 Tgas
pub const DELIMETER: char = '|';
//constant used to attach 0 NEAR to a call
const NO_DEPOSIT: Balance = 0;

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
	market_royalty: u64,
	market_holdings: u128,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, market_royalty: u64) -> Self {
        Self {
			owner_id,
			offer_id: 0,
			offer_by_id: UnorderedMap::new(StorageKey::OfferById),
			offers_by_maker_id: LookupMap::new(StorageKey::OfferByMakerId),
			offers_by_taker_id: LookupMap::new(StorageKey::OfferByTakerId),
			offer_by_contract_token_id: LookupMap::new(StorageKey::OfferByContractTokenId),
			market_holdings: 0,
			market_royalty
        }
    }

	//change the royalty percentage that the market receives.
	pub fn change_market_royalty(&mut self, market_royalty: u64) {
        self.assert_owner();
        self.market_royalty = market_royalty;
    }

	//withdraw any excess market holdings to an external account.
	pub fn withdraw_market_holdings(&mut self, receiving_account: AccountId) {
        self.assert_owner();
		if self.market_holdings > 0 {
			Promise::new(receiving_account)
			.transfer(self.market_holdings)
			.then(ext_self::on_withdraw_holdings(
				env::current_account_id(),
				NO_DEPOSIT,
				CALLBACK_GAS,
			));
		}
    }

	//views
	//check the market holdings
	pub fn view_market_holdings(&self) -> u128 {
        self.market_holdings
    }
}
