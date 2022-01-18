import { formatNearAmount } from 'near-api-js/lib/utils/format';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchData,  } from '../state/app';
import { fetchTokens } from '../state/near';

const PAGE_LIMIT = 3;

export const RouteContract = ({ dispatch, update, data }) => {

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	const { contractId, index, supply, tokens } = data
	const summary = data?.[contract_id]?.summary;
	console.log(summary)

	const onMount = async () => {
		if (contractId === contract_id) {
			return
		}
		dispatch(fetchData(contract_id)),
		handlePage(index)
		update('data.contractId', contract_id)
	};
	useEffect(onMount, []);

	const handlePage = async (_index) => {
		console.log(index, _index)
		if (index !== _index) {
			update('data.index', _index)
		}
		await dispatch(fetchTokens(contract_id, {
			from_index: (parseInt(_index, 10) * PAGE_LIMIT).toString(),
			limit: PAGE_LIMIT,
		}))
	};

	const cols = [], numCols = Math.ceil(window.innerWidth / 500)
	for (let i = 0; i < tokens.length; i += numCols) {
		cols.push(tokens.slice(i, i + numCols))
	}

	return (
		<div>

			<h1>{ contract_id }</h1>
			{ summary && <>
				<h3>Market Summary</h3>
				<p>Average: { formatNearAmount(summary.avg_sale, 4) }</p>
				<p>Highest: { formatNearAmount(summary.highest_offer_sold.amount, 4) }</p>
				<p>Lowest: { formatNearAmount(summary.lowest_offer_sold.amount, 4) }</p>
				<p>Volume: { summary.vol_traded }</p>
				<p>Offers (all time): { summary.offers_len }</p>
			</>}

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
