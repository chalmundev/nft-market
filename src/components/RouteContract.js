import { formatNearAmount } from 'near-api-js/lib/utils/format';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchData } from '../state/app';
import { view, fetchTokens } from '../state/near';
import { Rows } from './Rows';

const PAGE_SIZE = 30;

export const RouteContract = ({ dispatch, update, data }) => {

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	let { contractId, index, tokens, supply } = data;
	const summary = data?.[contract_id]?.summary;

	const onMount = async () => {
		if (contractId === contract_id) {
			return;
		}
		update('loading', true);
		dispatch(fetchData(contract_id));
		const supply = await dispatch(view({
			contract_id,
			methodName: 'nft_total_supply',
		}));
		await handlePage(index, supply);
		update('data.contractId', contract_id);
		return () => {
			update('data.index', 0);
		};
	};
	useEffect(onMount, []);

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
		
		await dispatch(fetchTokens(contract_id, {
			from_index,
			limit,
		}));
		update('loading', false);
	};

	tokens = tokens.slice().reverse();

	console.log(summary)

	return (
		<div>

			<h1>{contract_id}</h1>
			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				{summary.highest_offer_sold && <p>Highest: {formatNearAmount(summary.highest_offer_sold.amount, 4)}</p>}
				{summary.lowest_offer_sold && <p>Lowest: {formatNearAmount(summary.lowest_offer_sold.amount, 4)}</p>}
				<p>Volume: {summary.vol_traded}</p>
				<p>Offers (all time): {summary.offers_len}</p>
			</>}

			<p>Page {index+1} / {Math.ceil(supply / PAGE_SIZE)}</p>

			<div className='button-row'>
				{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
				{(index + 1) * PAGE_SIZE < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}
			</div>

			<Rows {...{
				arr: tokens,
				Item: ({ token_id, metadata }) => <div onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
					<img src={metadata.media} />
					<p>{token_id}</p>
				</div>
			}} />

		</div>
	);
};
