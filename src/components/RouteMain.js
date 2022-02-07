import React, { useState, useEffect } from 'react';
import { fetchBatchTokens } from '../state/near';

import { cats } from '../utils/cats';
import { SummaryTeaser } from './SummaryTeaser';
import { TokenFeatured } from './TokenFeatured';

export const RouteMain = ({ dispatch, batch, marketSummary, contractMap }) => {

	const onMount = async () => {
		const tokens = []
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))))
		await dispatch(fetchBatchTokens(tokens));
	}
	useEffect(onMount, [])

	const f = marketSummary.new_offers[0]
	const fc = contractMap?.[f.contract_id]

	return <>

		{
			<TokenFeatured {...{ contract: fc, token: batch?.[f.contract_id]?.[f.token_id] }} />
		}

		{
			cats.map((data) => <div key={data.key}>
				<SummaryTeaser {...{ contractMap, batch, data, items: marketSummary[data.key].slice(0, 5) }} />
			</div>)
		}


	</>;
};