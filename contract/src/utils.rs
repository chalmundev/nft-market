use crate::*;

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

pub(crate) fn refund_deposit(storage_used: u64, keep_amount: Option<Balance>) {
    let required_cost = env::storage_byte_cost() * Balance::from(storage_used);
    let mut attached_deposit = env::attached_deposit();

	if let Some(keep_amount) = keep_amount {
		attached_deposit = attached_deposit.checked_sub(keep_amount).unwrap_or_else(|| env::panic_str("keep amount too large"));
	}

    require!(
        required_cost <= attached_deposit,
        "not enough N to cover storage",
    );

    let refund = attached_deposit - required_cost;
	// log!("refund_deposit amount {}", refund);
    if refund > 1 {
        Promise::new(env::predecessor_account_id()).transfer(refund);
    }
}

pub(crate) fn refund_storage(storage_freed: u64) {
    let refund = env::storage_byte_cost() * storage_freed as u128 - 1;
   
    if refund > 1 {
        Promise::new(env::predecessor_account_id()).transfer(refund);
    }
}