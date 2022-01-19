import { formatNearAmount } from 'near-api-js/lib/utils/format';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchData } from '../state/app';
import { view, fetchTokens } from '../state/near';

const PAGE_SIZE = 10;

export const RouteContract = ({ dispatch, update, data }) => {

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	let { contractId, index, supply, tokens } = data
	const summary = data?.[contract_id]?.summary;

	const onMount = async () => {
		if (contractId === contract_id) {
			return
		}
		update('loading', true)
		dispatch(fetchData(contract_id));
		const supply = await dispatch(view({
			contract_id,
			methodName: 'nft_total_supply',
		}))
		let _index = index
		while ((_index + 1) * PAGE_SIZE < supply) {
			_index++;
		}
		await handlePage(_index)
		update('data.contractId', contract_id)
		return () => {
			update('data.index', 0)
		}
	};
	useEffect(onMount, []);

	const handlePage = async (_index) => {
		console.log(index, _index)
		if (index !== _index) {
			update('data.index', _index)
		}
		await dispatch(fetchTokens(contract_id, {
			from_index: (parseInt(_index, 10) * PAGE_SIZE).toString(),
			limit: PAGE_SIZE,
		}))
		update('loading', false)
	};

	tokens = tokens.slice().reverse()

	const rows = [], numCols = Math.ceil(window.innerWidth / 500)
	for (let i = 0; i < tokens.length; i += numCols) {
		rows.push(tokens.slice(i, i + numCols))
	}

	return (
		<div>

			<h1>{contract_id}</h1>
			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				<p>Highest: {formatNearAmount(summary.highest_offer_sold.amount, 4)}</p>
				<p>Lowest: {formatNearAmount(summary.lowest_offer_sold.amount, 4)}</p>
				<p>Volume: {summary.vol_traded}</p>
				<p>Offers (all time): {summary.offers_len}</p>
			</>}

			<p>Page {Math.ceil(supply / PAGE_SIZE) - index}</p>

			<div className='button-row'>
				{(index + 1) * PAGE_SIZE < supply ? <button onClick={() => handlePage(index + 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
				{index !== 0 && <button onClick={() => handlePage(index - 1)}>Next</button>}
			</div>

			{
				rows.map((row, i) => <div className="grid" key={i}>
					{
						row.map(({ token_id, metadata }) => <div key={token_id} onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
							<img src={metadata.media} />
							<p>{token_id}</p>
						</div>)
					}
				</div>)
			}

		</div>
	);
};
