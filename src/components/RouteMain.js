import React, { useState, useEffect } from 'react';
import { fetchBatchTokens } from '../state/near';

import { cats } from '../utils/cats';
import { FeaturedTeaser } from './FeaturedTeaser';
import { SummaryTeaser } from './SummaryTeaser';
import { SummaryGrid } from './SummaryGrid';

export const RouteMain = ({ dispatch, batch, marketSummary, contractMap }) => {

	const onMount = async () => {
		const tokens = [];
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))));
		await dispatch(fetchBatchTokens(tokens));
	};
	useEffect(onMount, []);

	const data = cats.slice(0, 5);
	const items = [];
	data.forEach((data) => items.push(...marketSummary[data.key].slice(0, 1)));

	const gridData = cats.slice(4, 10);
	const gridItems = [];
	gridData.forEach((data) => gridItems.push(...marketSummary[data.key].slice(0, 1)));

	return <>
		<FeaturedTeaser {...{ contractMap, batch, data, items }} />

		{
			cats.slice(0, 4).map((data) => <div key={data.key}>
				<SummaryTeaser {...{ contractMap, batch, data, items: marketSummary[data.key].slice(0, 5) }} />
			</div>)
		}

		<SummaryGrid {...{ contractMap, batch, data: gridData, items: gridItems }} />

	</>;
};