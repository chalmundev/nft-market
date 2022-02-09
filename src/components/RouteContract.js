import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from '../state/app';
import { view, fetchTokens } from '../state/near';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { Rows } from './Rows';
import { Media } from './Media';
import { Chart } from './Chart';
import { MediaCard } from './MediaCard';

import '../css/Routes.scss'
import { contractPriceHistory } from '../utils/data';

const PAGE_SIZE = 30;

export const RouteContract = ({ dispatch, update, mobile, data }) => {
	const { contract_id } = useParams();

	let { contractMap, batch, contractId, index, tokens, supply } = data;
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

	const { title, media } = parseData(contractMap, batch, {}, { contract_id })

	if (!summary) return null

	return (
		<div className='route contract'>

			<Media {...{media, classNames: ['featured']}} />

			<h2>{title}</h2>
			<p>{contract_id}</p>

			<div className='stats'>
				<div>
					<div>Avg</div>
					<div>{near(summary.avg_sale)}</div>
				</div>
				<div>
					<div>Sales</div>
					<div>{summary.sales}</div>
				</div>
				<div>
					<div>Events</div>
					<div>{summary.events}</div>
				</div>
			</div>
			{summary.highest && <div className='stats'>
				<div>
					<div>Highest</div>
					<div>{ near(summary.highest.amount) }</div>
				</div>
				<div>
					<div>Lowest</div>
					<div>{ near(summary.lowest.amount) }</div>
				</div>
			</div>}

			<Chart data={contractPriceHistory(data?.[contract_id])} />

			{
				Math.ceil(supply / PAGE_SIZE) > 1 && <>
					<p>Page {index+1} / {Math.ceil(supply / PAGE_SIZE)}</p>

					<div className='grid apart-2'>
						{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
						{(index + 1) * PAGE_SIZE < supply ? <button onClick={() => handlePage(index + 1)}>Next</button> : <button style={{ visibility: 'hidden' }}></button>}
					</div>
				</>
			}

			<div className='tokens'>
				<Rows {...{
					width: mobile ? window.innerWidth/2 : undefined,
					arr: tokens,
					Item: ({ token_id, metadata: { title, media } }) => {
						return <div key={token_id}>
							<MediaCard {...{
								title: title || token_id,
								subtitle: title ? token_id : null,
								media,
								link: `/token/${contract_id}/${token_id}`,
								classNames: ['feature-card', 'tall']
							}} />
						</div>
					}
				}} />
			</div>
		</div>
	);
};
