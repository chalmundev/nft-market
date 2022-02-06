import React, { useState, useEffect } from 'react';
import { percent } from '../utils/format';
import { fetchBatchTokens, formatNearAmount } from '../state/near';

import { Rows } from './Rows';
import { TokenMedia } from './TokenMedia';
import { TokenCard } from './TokenCard';
import { TokenFeatured } from './TokenFeatured';

const format = (amount) => formatNearAmount(amount, 4)

const cats = [
	{ isToken: true, label: 'New Offers', key: 'new_offers', innerKey: 'amount', format },
	{ isToken: true, label: 'New Sales', key: 'new_sales', innerKey: 'amount', format },
	{ isToken: true, label: 'Highest Token Sales', key: 'high_sale_tokens', innerKey: 'amount', format },
	{ isToken: true, label: 'Lowest Token Sales', key: 'low_sale_tokens', innerKey: 'amount', format },
	{ label: 'Top Volume', key: 'top_volume', innerKey: 'total' },
	{ label: 'Top Events', key: 'top_events', innerKey: 'total' },
	{ label: 'Gainers', key: 'high_change', innerKey: 'change', format: percent },
	{ label: 'Losers', key: 'low_change', innerKey: 'change', format: percent },
	{ label: 'Highest Sellers', key: 'high_sales', innerKey: 'avg', format },
	{ label: 'Lowest Sellers', key: 'low_sales', innerKey: 'avg', format },
]

export const RouteMain = ({ dispatch, update, navigate, batch, marketSummary, contractMap, index }) => {

	// console.log(marketSummary);

	const onMount = async () => {
		const tokens = []
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))))
		await dispatch(fetchBatchTokens(tokens));
	}
	useEffect(onMount, [])

	const handlePage = async (_index = 0) => {
		update('data.index', _index);
	};

	const f = marketSummary.new_offers[0]
	const displayCats = cats.slice(index, index+1)

	const fc = contractMap?.[f.contract_id]

	return <>

		{
			<TokenFeatured {...{ contract: fc, token: batch?.[f.contract_id]?.[f.token_id] } } />
		}
		<div className='grid apart-2'>
			{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
			{(index + 1) < cats.length ? <button onClick={() => handlePage(index + 1)}>Next</button> : <button style={{ visibility: 'hidden' }}></button>}
		</div>
		{
			displayCats.map(({ isToken, label, key, innerKey, format }) => {
				const summary = marketSummary[key]

				return <div key={key}>
					<h3>{label}</h3>
					<Rows {...{
						width: 375,
						arr: summary,
						Item: (data) => {
							const { contract_id, token_id } = data
							let { name, media } = contractMap[contract_id]
							const token = batch[contract_id]?.[token_id]
							if (isToken) {
								media = token?.metadata?.media
							}
							return <div onClick={() => navigate(isToken ? `/token/${contract_id}/${token_id}` : `/contract/${contract_id}`)}>
								{
									token
									?
									<>
									<TokenCard {...{ token }} />
									<p>{format ? format(data[innerKey]) : data[innerKey]}</p>
									</>
									:
									<>
									<TokenMedia {...{ media } } />
									<h3>{name}</h3>
									<p>{format ? format(data[innerKey]) : data[innerKey]}</p>
									</>
								}
							</div>
						}
					}} />
				</div>
			})
		}


	</>;
};