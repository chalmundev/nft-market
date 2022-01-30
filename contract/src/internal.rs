use crate::*;

pub(crate) fn get_contract_token_id(contract_id: &AccountId, token_id: &str) -> String{
	format!("{}{}{}", contract_id, DELIMETER, token_id)
}

pub(crate) fn is_promise_success() -> bool {
    require!(env::promise_results_count() == 1, "promise failed");
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

/// enumeration

pub(crate) fn paginate<V>(
	values: &Vector<V>,
	from_index: Option<U128>,
    limit: Option<u64>,
) -> Vec<V> where V: BorshSerialize + BorshDeserialize {
	let len = values.len();
	if len == 0 {
		return vec![];
	}
	let limit = limit.map(|v| v as usize).unwrap_or(usize::MAX);
	assert_ne!(limit, 0, "limit 0");
	let start_index: u128 = from_index.map(From::from).unwrap_or_default();
	assert!(
		len as u128 > start_index,
		"start_index gt len"
	);
	values
		.iter()
		.skip(start_index as usize)
		.take(limit)
		.map(|v| v)
		.collect()
}

pub(crate) fn unordered_map_val_pagination<K, V>(
    map: &UnorderedMap<K, V>,
    from_index: Option<U128>,
    limit: Option<u64>,
) -> Vec<V> where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	paginate(map.values_as_vector(), from_index, limit)
}

pub(crate) fn unordered_map_key_pagination<K, V>(
    map: &UnorderedMap<K, V>,
    from_index: Option<U128>,
    limit: Option<u64>,
) -> Vec<K> where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	paginate(map.keys_as_vector(), from_index, limit)
}

/// set management

pub(crate) fn map_set_insert<K, V> (
    map: &mut LookupMap<K, UnorderedSet<V>>,
	map_key: &K,
	storage_key: StorageKey,
	val: V,
) where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	let mut set = map.get(map_key).unwrap_or_else(|| {
		UnorderedSet::new(storage_key)
	});
	set.insert(&val);
	map.insert(&map_key, &set);
}

pub(crate) fn map_set_remove<K, V> (
    map: &mut LookupMap<K, UnorderedSet<V>>,
	map_key: &K,
	val: V,
) where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	let mut set = map.get(map_key);
	if let Some(set) = set.as_mut() {
		set.remove(&val);
		if set.len() == 0 {
			map.remove(&map_key);
			return;
		}
		map.insert(&map_key, &set);
	}
}

impl Contract {

	pub(crate) fn id_to_offer(&self, set: Vec<u64>) -> Vec<Offer> {
		set.iter()
			.map(|offer_id| self.offer_by_id.get(&offer_id).unwrap())
			.collect()
	}
    // Add the offer to the contract state
    pub(crate) fn internal_add_offer(&mut self, offer: Offer) {
        self.offer_id += 1;

		self.offer_by_id.insert(&self.offer_id, &offer);

		map_set_insert(
			&mut self.offers_by_maker_id, 
			&offer.maker_id, 
			StorageKey::OfferByMakerIdInner { maker_id: offer.maker_id.clone() },
			self.offer_id
		);
	
		map_set_insert(
			&mut self.offers_by_taker_id, 
			&offer.taker_id, 
			StorageKey::OfferByTakerIdInner { taker_id: offer.taker_id.clone() },
			self.offer_id
		);
	
		let contract_token_id = get_contract_token_id(&offer.contract_id, &offer.token_id);
		self.offer_by_contract_token_id.insert(
			&contract_token_id.clone(),
			&self.offer_id
		);
    }

	// Removes the offer from the contract state
    pub(crate) fn internal_swap_offer_maker(&mut self, offer_id: u64, prev_maker_id: &AccountId, new_maker_id: &AccountId) {
        map_set_remove(
			&mut self.offers_by_maker_id,
			&prev_maker_id,
			offer_id,
		);
		
        map_set_insert(
			&mut self.offers_by_maker_id, 
			&new_maker_id, 
			StorageKey::OfferByMakerIdInner { maker_id: new_maker_id.clone() },
			self.offer_id
		);
    }

    // Removes the offer from the contract state
    pub(crate) fn internal_remove_offer(&mut self, offer_id: u64, offer: &Offer) {
        //remove the offer from its ID
        self.offer_by_id.remove(&offer_id);
    
        //remove the offer ID from the maker
        map_set_remove(
			&mut self.offers_by_maker_id,
			&offer.maker_id,
			offer_id,
		);
		
        //remove the offer ID from the taker
        map_set_remove(
			&mut self.offers_by_taker_id,
			&offer.taker_id,
			offer_id,
		);
    
        //remove the offer from the contract and token ID
        let contract_token_id = get_contract_token_id(&offer.contract_id, &offer.token_id);
        self.offer_by_contract_token_id.remove(&contract_token_id);

		if offer.maker_id == offer.taker_id {
			return self.internal_withdraw_one_storage(&offer.maker_id);
		}
		
		// refund the offer maker the offer amount + the amount they added for storage
		Promise::new(offer.maker_id.clone()).transfer(offer.amount.0 + DEFAULT_OFFER_STORAGE_AMOUNT);
    }

	pub(crate) fn internal_accept_offer(
		&mut self,
		offer_id: u64,
		offer: Offer
	) {
		if offer.taker_id == offer.maker_id {
			env::panic_str("cannot accept your own offer");
		}
		// make sure there's an approval ID.
		let approval_id = offer.approval_id.unwrap_or_else(|| env::panic_str("Cannot accept an offer that has no approval ID"));

		// get market holding amount
        let market_amount = self.market_royalty as u128 * offer.amount.0 / 10_000u128;
		// subtract from payout amount
		let payout_amount = U128(offer.amount.0.checked_sub(market_amount).unwrap_or_else(|| env::panic_str("Market holding amount too high.")));

		self.internal_remove_offer(offer_id, &offer);
		
		//initiate a cross contract call to the nft contract. This will transfer the token to the buyer and return
		//a payout object used for the market to distribute funds to the appropriate accounts.
		ext_contract::nft_transfer_payout(
			offer.maker_id.clone(), //maker of the offer (person to transfer the NFT to)
			offer.token_id.clone(), //token ID to transfer
			approval_id, //market contract's approval ID in order to transfer the token on behalf of the owner
			"payout from market".to_string(), //memo (to include some context)
			/*
				the price that the token was offered for. This will be used in conjunction with the royalty percentages
				for the token in order to determine how much money should go to which account. 
			*/
			payout_amount,
			10, //the maximum amount of accounts the market can payout at once (this is limited by GAS)
			offer.contract_id.clone(), //contract to initiate the cross contract call to
			1, //yoctoNEAR to attach to the call
			GAS_FOR_NFT_TRANSFER, //GAS to attach to the call
		)
		//after the transfer payout has been initiated, we resolve the promise by calling our own resolve_offer function. 
		//resolve offer will take the payout object returned from the nft_transfer_payout and actually pay the accounts
		.then(ext_self::resolve_offer(
			offer.maker_id,
			offer.taker_id,
			offer.token_id,
			offer.contract_id,
			offer.amount,
			offer.updated_at,
			payout_amount,
			market_amount,
			env::current_account_id(), //we are invoking this function on the current contract
			NO_DEPOSIT, //don't attach any deposit
			GAS_FOR_ROYALTIES, //GAS attached to the call to payout royalties
		));
	}
}
