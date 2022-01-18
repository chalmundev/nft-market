import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { view } from '../state/near';

const PAGE_LIMIT = 3;

export const RouteOffersMaker = ({ dispatch, update, account, index, offersMaker }) => {
	if (!account) return null

	const { account_id } = account

	console.log(account_id)

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
			methodName: 'get_offers_by_maker_id',
			args: {
				account_id
			},
			key: 'data.offersMaker'
		}))
	};

	const [supply, offers] = offersMaker

	const cols = [], numCols = Math.ceil(window.innerWidth / 500)
	for (let i = 0; i < offers.length; i += numCols) {
		cols.push(offers.slice(i, i + numCols))
	}

	return (
		<div>

			<p>Page {index + 1}</p>

			{
				cols.map((col, i) => <div className="grid" key={i}>
					{
						col.map(({ token_id, metadata }) => <div key={token_id} onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
							<img src={metadata.media} />
							<p>{token_id}</p>
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
