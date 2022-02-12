import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PAGE_SIZE, fetchData } from '../state/app';
import { view, fetchTokens, parseNearAmount } from '../state/near';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { Page } from './Page';
import { Media } from './Media';
import { Chart } from './Chart';
import { MediaCard } from './MediaCard';

import '../css/Routes.scss';
import { contractPriceHistory } from '../utils/data';

export const RouteContract = ({ networkId, dispatch, update, mobile, data }) => {
	const { contract_id, account_id } = useParams();

	let { contractMap, batch, contractId, index, tokens, supply, tokensForOwner } = data;

	const [loading, setLoading] = useState(false);

	const onMount = async () => {
		if (contractId === contract_id) return;
		setLoading(true);
		dispatch(fetchData(contract_id, account_id));
		const supply = await dispatch(view({
			contract_id,
			methodName: 'nft_total_supply',
		}));

		console.log(supply)

		await handlePage(index, supply);
		update('data.contractId', contract_id);
		return () => {
			update('data.index', 0);
		};
	};
	useEffect(onMount, []);

	const handlePage = async (_index = 0, _supply = supply) => {
		setLoading(true);

		if (index !== _index) {
			update('data.index', _index);
		}

		let from_index = _index * PAGE_SIZE;
		let limit = PAGE_SIZE;
		
		// let from_index = (_supply - PAGE_SIZE * (_index + 1));
		// let limit = PAGE_SIZE;
		// if (from_index < 0) {
		// 	from_index = 0;
		// 	limit = _supply % PAGE_SIZE;
		// }

		from_index = from_index.toString();
		
		await dispatch(fetchTokens(contract_id, {
			from_index,
			limit,
		}));

		console.log(from_index, limit)

		setLoading(false);
	};

	const { title, media } = parseData(contractMap, batch, {}, { contract_id });

	const summary = data?.[contract_id]?.summary || {
		avg_sale: '0',
		sales: 'NA',
		events: 'NA',
		noChart: true
	};

	if (account_id && tokensForOwner) {
		tokens = tokensForOwner
	}

	return (
		<div className='route contract'>

			<div className='resp-grid'>
				<div>
					<Media {...{ media, classNames: ['featured'] }} />


				</div>

				<div>
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
							<div>{near(summary.highest.amount)}</div>
						</div>
						<div>
							<div>Lowest</div>
							<div>{near(summary.lowest.amount)}</div>
						</div>
					</div>}

					{ !summary.noChart && <Chart data={contractPriceHistory(data?.[contract_id])} /> }

				</div>
			</div>


			<Page {...{
				index,
				supply,
				handlePage,
				pageSize: PAGE_SIZE,
				loading,
				width: mobile ? window.innerWidth / 2 : undefined,
				arr: tokens,
				Item: ({ token_id, metadata: { title, media } }) => {
					return <div>
						<MediaCard {...{
							title: title || token_id,
							subtitle: title ? token_id : null,
							media,
							link: `/token/${contract_id}/${token_id}`,
							classNames: ['feature-card', 'tall']
						}} />
					</div>;
				}
			}} />

		</div>
	);
};
