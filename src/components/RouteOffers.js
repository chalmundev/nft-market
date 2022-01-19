import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatNearAmount, view } from '../state/near';

const PAGE_LIMIT = 10;

export const RouteOffers = ({ dispatch, update, account, type, offers, index }) => {
	if (!account) return null

	const { account_id } = account

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	const onMount = async () => {
		await handlePage(index)
	};
	useEffect(onMount, []);

	const handlePage = async (_index) => {
		console.log(index, _index)
		if (index !== _index) {
			update('data.index', _index)
		}
		await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id
			},
			key: 'data.offers.' + type
		}))
	};

	const [supply, offerArr] = offers[type]

	const rows = [], numCols = Math.ceil(window.innerWidth / 500)
	for (let i = 0; i < offerArr.length; i += numCols) {
		rows.push(offerArr.slice(i, i + numCols))
	}

	console.log(rows)

	if (rows.length === 0) {
		return <p>You have not {type === 'maker' ? 'made' : 'received'} any offers yet.</p>
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
				{index !== 0 && <button onClick={() => handlePage(index - 1)}>Prev</button>}
				{(index + 1) * PAGE_LIMIT < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}
			</div>

		</div>
	);
};
