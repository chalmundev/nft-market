import { formatNearAmount } from 'near-api-js/lib/utils/format';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from '../state/app';
import { view, fetchTokens } from '../state/near';
import { Rows } from './Rows';
import { TokenMedia } from './TokenMedia';

const PAGE_SIZE = 30;

export const RouteContract = ({ dispatch, update, navigate, params, data }) => {
	const { contract_id } = useParams();

	let { contractId, index, tokens, supply } = data;
	const summary = data?.[contract_id]?.summary;

	console.log(data?.[contract_id])

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

	return (
		<div>

			<h1>{contract_id}</h1>
			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				{summary.highest && <p>Highest: {formatNearAmount(summary.highest.amount, 4)}</p>}
				{summary.lowest && <p>Lowest: {formatNearAmount(summary.lowest.amount, 4)}</p>}
				<p>Sales: {summary.sales}</p>
				<p>Events: {summary.events}</p>
			</>}

			<p>Page {index+1} / {Math.ceil(supply / PAGE_SIZE)}</p>

			<div className='button-row'>
				{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
				{(index + 1) * PAGE_SIZE < supply ? <button onClick={() => handlePage(index + 1)}>Next</button> : <button style={{ visibility: 'hidden' }}></button>}
			</div>

			<Rows {...{
				arr: tokens,
				Item: ({ token_id, metadata: { media } }) => <div onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
					<TokenMedia {...{media}} />
					<p>{token_id}</p>
				</div>
			}} />

		</div>
	);
};
