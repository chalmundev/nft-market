use crate::*;

pub(crate) fn get_contract_token_id(contract_id: &AccountId, token_id: &str) -> String{
	format!("{}{}{}", contract_id, DELIMETER, token_id)
}

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

// pub(crate) fn unordered_set_pagination<V>(
//     set: &UnorderedSet<V>,
//     from_index: Option<U128>,
//     limit: Option<u64>,
// ) -> Vec<V> where V: BorshSerialize + BorshDeserialize {
// 	paginate(set.as_vector(), from_index, limit)
// }

/// set management

pub(crate) fn map_set_insert<K, V> (
    map: &LookupMap<K, UnorderedSet<V>>,
	map_key: &K,
	storage_key: StorageKey,
	val: V,
) -> UnorderedSet<V> where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	let mut offers_by_maker_id = map.get(map_key).unwrap_or_else(|| {
		UnorderedSet::new(storage_key)
	});
	offers_by_maker_id.insert(&val);
	offers_by_maker_id
}

pub(crate) fn map_set_remove<K, V> (
    map: &LookupMap<K, UnorderedSet<V>>,
	map_key: &K,
	val: V,
) -> UnorderedSet<V> where K: BorshSerialize + BorshDeserialize, V: BorshSerialize + BorshDeserialize {
	let mut offers_by_maker_id = map.get(map_key).unwrap_or_else(|| env::panic_str("no set in map"));
	offers_by_maker_id.remove(&val);
	offers_by_maker_id
}

pub(crate) fn is_promise_success() -> bool {
    require!(env::promise_results_count() == 1, "promise failed");
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

impl Contract {
    // Removes the offer from the contract state
    pub(crate) fn internal_add_offer(&mut self, offer: &Offer) {
        self.offer_id += 1;

		let maker_id = offer.maker_id.clone();
		let taker_id = offer.taker_id.clone();
		let contract_id = offer.contract_id.clone();
		let token_id = offer.token_id.clone();

		self.offer_by_id.insert(&self.offer_id, offer);

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

    // Removes the offer from the contract state
    pub(crate) fn internal_remove_offer(&mut self, offer_id: u64, offer: &Offer) {
        //remove the offer from its ID
        self.offer_by_id.remove(&offer_id);
    
        //remove the offer ID from the maker
        self.offers_by_maker_id.insert(
            &offer.maker_id,
            &map_set_remove(
                &self.offers_by_maker_id,
                &offer.maker_id,
                offer_id,
            )
        );
    
        //remove the offer ID from the taker
        self.offers_by_taker_id.insert(
            &offer.taker_id,
            &map_set_remove(
                &self.offers_by_taker_id,
                &offer.taker_id,
                offer_id,
            )
        );
    
        //remove the offer from the contract and token ID
        let contract_token_id = get_contract_token_id(&offer.contract_id, &offer.token_id);
        self.offer_by_contract_token_id.remove(&contract_token_id);
    }

	pub(crate) fn internal_accept_offer(
		&mut self,
		offer_id: u64,
		offer: &Offer
	) {
		//make sure there's an approval ID.
		let approval_id = offer.approval_id.unwrap_or_else(|| env::panic_str("Cannot accept an offer that has no approval ID"));

        //increment market holding amount
        let market_amount = self.market_royalty as u128 * offer.amount.0 / 10_000u128;
		self.market_balance += market_amount;
		let payout_amount = U128(offer.amount.0.checked_sub(market_amount).unwrap_or_else(|| env::panic_str("Market holding amount too high.")));

		let maker_id = offer.maker_id.clone();
		let taker_id = offer.taker_id.clone();
		let contract_id = offer.contract_id.clone();
		let token_id = offer.token_id.clone();
		
		//initiate a cross contract call to the nft contract. This will transfer the token to the buyer and return
		//a payout object used for the market to distribute funds to the appropriate accounts.
		ext_contract::nft_transfer_payout(
			offer.maker_id.clone(), //maker of the offer (person to transfer the NFT to)
			token_id, //token ID to transfer
			approval_id, //market contract's approval ID in order to transfer the token on behalf of the owner
			"payout from market".to_string(), //memo (to include some context)
			/*
				the price that the token was offered for. This will be used in conjunction with the royalty percentages
				for the token in order to determine how much money should go to which account. 
			*/
			payout_amount,
			10, //the maximum amount of accounts the market can payout at once (this is limited by GAS)
			contract_id, //contract to initiate the cross contract call to
			1, //yoctoNEAR to attach to the call
			GAS_FOR_NFT_TRANSFER, //GAS to attach to the call
		)
		//after the transfer payout has been initiated, we resolve the promise by calling our own resolve_offer function. 
		//resolve offer will take the payout object returned from the nft_transfer_payout and actually pay the accounts
		.then(ext_self::resolve_offer(
			offer_id,
			maker_id,
			taker_id, //pass the offer_id
			payout_amount,
			market_amount,
			env::current_account_id(), //we are invoking this function on the current contract
			NO_DEPOSIT, //don't attach any deposit
			GAS_FOR_ROYALTIES, //GAS attached to the call to payout royalties
		));
    }
}

// deprecated???



// pub(crate) fn refund_storage(storage_freed: u64) {
//     let refund = env::storage_byte_cost() * storage_freed as u128 - 1;
   
//     if refund > 1 {
//         Promise::new(env::predecessor_account_id()).transfer(refund);
//     }
// }

// pub(crate) fn refund_deposit(storage_used: u64, keep_amount: Option<Balance>) {
// 	let required_cost = env::storage_byte_cost() * Balance::from(storage_used);
// 	let mut attached_deposit = env::attached_deposit();

// 	if let Some(keep_amount) = keep_amount {
// 		attached_deposit = attached_deposit.checked_sub(keep_amount).unwrap_or_else(|| env::panic_str("keep amount too large"));
// 	}

// 	require!(
// 		required_cost <= attached_deposit,
// 		"not enough N to cover storage",
// 	);

// 	let refund = attached_deposit - required_cost;
// 	// log!("refund_deposit amount {}", refund);
// 	if refund > 1 {
// 		Promise::new(env::predecessor_account_id()).transfer(refund);
// 	}
// }