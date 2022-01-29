import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatNearAmount, view } from '../state/near';

const PAGE_SIZE = 30;

export const RouteOffers = ({ dispatch, update, account, offers, supply, index }) => {
	if (!account) return null;

	const { account_id } = account;

	const navigate = useNavigate();

	const type = /maker/.test(window.location.href) ? 'maker' : 'taker';

	const onMount = async () => {
		if (offers[type].length > 0) {
			return
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

		await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id,
				from_index,
				limit,
			},
			key: 'data.offers.' + type
		}));
		update('loading', false);
	};

	const [, offerArr = []] = offers[type];

	const rows = [], numCols = Math.ceil(window.innerWidth / 500);
	for (let i = 0; i < offerArr.length; i += numCols) {
		rows.push(offerArr.slice(i, i + numCols));
	}

	if (rows.length === 0) {
		return <p>You have not {type === 'maker' ? 'made' : 'received'} any offers yet.</p>;
	}

	return (
		<div>

			<p>Page {index + 1}</p>

			{
				rows.map((row, i) => <div className="grid" key={i}>
					{
						row.map(({ token_id, amount }) => <div key={token_id}>
							<p>{token_id}</p>
							<p>{formatNearAmount(amount, 4)}</p>
						</div>)
					}
				</div>)
			}

			<div className='button-row'>
				{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
				{(index + 1) * PAGE_SIZE < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}
			</div>

		</div>
	);
};
