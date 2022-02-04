import React, { useState, useEffect } from 'react';
import { percent } from '../utils/format';
import { fetchBatchTokens, formatNearAmount } from '../state/near';

import { Rows } from './Rows';
import { TokenMedia } from './TokenMedia';

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

export const RouteMain = ({ dispatch, update, navigate, cache, marketSummary, contractMap }) => {

	// console.log(marketSummary);

	const onMount = async () => {
		const tokens = []
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))))
		await dispatch(fetchBatchTokens(tokens));
	}
	useEffect(onMount, [])

	return <>

		{
			cats.map(({ isToken, label, key, innerKey, format, reverse }) => {
				const summary = marketSummary[key]

				return <div key={key}>
					<h3>{label}</h3>
					<Rows {...{
						width: 375,
						arr: summary,
						Item: (data) => {
							const { contract_id, token_id } = data
							let { name, media } = contractMap[contract_id]
							const token = cache[contract_id]?.[token_id]
							if (isToken) {
								media = token?.metadata?.media
							}
							return <div onClick={() => navigate(isToken ? `/token/${contract_id}/${token_id}` : `/contract/${contract_id}`)}>
								<TokenMedia {...{ media }} />
								<p>{name}</p>
								<p>{format ? format(data[innerKey]) : data[innerKey]}</p>
							</div>
						}
					}} />
				</div>
			})
		}


	</>;
};