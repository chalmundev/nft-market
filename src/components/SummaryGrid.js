import React, { useEffect } from 'react';
import {
	Link,
} from "react-router-dom";
import { parseData } from '../utils/media'
import { Rows } from './Rows';
import { Media } from './Media';
import '../css/Features.scss';

/// items are tokens or contracts

export const SummaryGrid = ({ contractMap, batch, data, items }) => {
	const { label, key } = data

	console.log(data, items)

	return <div className='summary-grid'>

		<Rows {...{
			width: window.innerWidth/2,
			arr: items,
			Item: (item) => {
				const { i } = item
				const { key } = data[i]
				const { title, subtitle, media } = parseData(contractMap, batch, data[i], item)

				return <Link key={i} to={`/summary/${key}`}>
					<Media {...{ media }} />
					<div className="label">
						<h3>{data[i].label}</h3>
					</div>
				</Link>
			}
		}} />
		
	</div>
};