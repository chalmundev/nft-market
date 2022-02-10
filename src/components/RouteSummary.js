import React, { useState, useEffect } from 'react';
import { fetchBatchTokens } from '../state/near';
import {
	Link,
	useParams,
} from "react-router-dom";
import { parseData } from '../utils/media';
import { cats } from '../utils/cats';
import { Select } from './Select';
import { Media } from './Media';
import { SummaryTeaser } from './SummaryTeaser';

import '../css/Select.scss';

export const RouteSummary = ({ dispatch, update, navigate, batch, marketSummary, contractMap, index }) => {

	const { key } = useParams();
	const cat = cats.find((cat) => cat.key === key);
	const { label } = cat;
	
	const [items, setItems] = useState([]);

	const onMount = async () => {
		setItems(marketSummary[key]);
		const tokens = [];
		cats.filter(({ isToken }) => !!isToken).forEach(({ key }) => tokens.push(...marketSummary[key].map(({ contract_id, token_id }) => ({ contract_id, token_id }))));
		await dispatch(fetchBatchTokens(tokens));
	};
	useEffect(onMount, [key]);

	return <>

		<Select {...{
			active: { label, key },
			options: cats.map(({ label, key }) => ({ label, key })),
			onSelect: () => setItems([])
		}} />

		<div className='summary-list'>
			{
				items.map((item, i) => {
					const { title, subtitle, media, link } = parseData(contractMap, batch, cat, item, true);

					return <Link to={link} key={i}>
						<div>{i+1}</div>
						<Media {...{ media }} />
						<div>
							<div>{title}</div>
							<div>{subtitle}</div>
						</div>
					</Link>;
				})
			}
		</div>

	</>;
};