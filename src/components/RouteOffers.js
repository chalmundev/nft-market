import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatNearAmount, view, fetchBatchTokens } from '../state/near';
import { Rows } from './Rows';

const PAGE_SIZE = 30;

export const RouteOffers = ({ dispatch, update, account, offers, supply, index, cache }) => {
	if (!account) return null;

	const { account_id } = account;

	const navigate = useNavigate();

	const isMaker = /maker/.test(window.location.href);
	const isTaker = !isMaker;
	const type = isMaker ? 'maker' : 'taker'

	const onMount = async () => {
		if (offers[type].length > 0) {
			return;
		}
		update('loading', true);
		const [_supply] = await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id,
				from_index: '0',
				limit: 1,
			},
		}));
		await handlePage(index, _supply);
		update('data.supply', _supply);
		return () => {
			update('data', { index: 0, offers: { [type]: [] } });
		};
	};
	useEffect(onMount, [type]);

	const handlePage = async (_index = 0, _supply = supply) => {
		if (index !== _index) {
			update('data.index', _index);
		}
		
		let from_index = (_supply - PAGE_SIZE * (_index+1));
		let limit = PAGE_SIZE;
		if (from_index < 0) {
			from_index = 0;
			limit = _supply % PAGE_SIZE;
		}
		from_index = from_index.toString();

		const [, offers] = await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id,
				from_index,
				limit,
			},
			key: 'data.offers.' + type
		}));

		await dispatch(fetchBatchTokens(offers.map(({ contract_id, token_id}) => ({ contract_id, token_id}))))

		update('loading', false);
	};

	const [, offerArr = []] = offers[type];

	if (offerArr.length === 0) {
		return <p>You have not {isMaker ? 'made' : 'received'} offers yet.</p>;
	}

	return (
		<div>
			<h3>{isMaker ? 'My Offers' : 'My Tokens'}</h3>

			<p>Page {index + 1}</p>

			<div className='button-row'>
				{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
				{(index + 1) * PAGE_SIZE < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}
			</div>

			<Rows {...{
				arr: offerArr,
				Item: ({ contract_id, token_id, amount, maker_id }) => <div onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
					{
						cache[contract_id]?.[token_id] && <>
						<img src={cache[contract_id][token_id].metadata.media} />
						</>
					}
					{ isTaker && <p>From: { maker_id === account?.account_id ? 'You' : maker_id}</p>}
					<p>{token_id}</p>
					<p>{formatNearAmount(amount, 4)}</p>
				</div>
			}} />

		</div>
	);
};
