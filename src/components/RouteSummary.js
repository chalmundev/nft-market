import React, { useState, useEffect } from 'react';
import { fetchBatchTokens } from '../state/near';
import {
	Link,
	useParams,
} from "react-router-dom";
import { cats } from '../utils/cats';
import { Select } from './Select';
import { SummaryTeaser } from './SummaryTeaser';

import '../css/Select.scss'

export const RouteSummary = ({ dispatch, update, navigate, batch, marketSummary, contractMap, index }) => {

	const { key } = useParams();
	const cat = cats.find((cat) => cat.key === key)
	const { label } = cat
	const items = marketSummary[key]

	const onMount = async () => {
		const tokens = []
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))))
		await dispatch(fetchBatchTokens(tokens));
	}
	useEffect(onMount, [])

	return <>

		<h3>{label}</h3>

		<Select {...{
			active: { label, key },
			options: cats.map(({ label, key }) => ({ label, key }))
		}} />

		{
			items.map(({ contract_id }, i) => <p key={i}>{ contract_id }</p>)
		}

	</>;
};