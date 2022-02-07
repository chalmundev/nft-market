import React from 'react';
import {
	Link,
} from "react-router-dom";
import { Media } from './Media';
import '../css/Features.scss';

/// items are tokens or contracts

export const SummaryTeaser = ({ contractMap, batch, data, items }) => {
	const { label, key, isToken, innerKey, format } = data

	return <div className='summary-teaser'>
		<div>
			<h3>{label}</h3>
			<h3><Link to="/summary">View All</Link></h3>
		</div>

		{
			items.map((data, i) => {
				const { contract_id, token_id } = data
				let { name: title, media } = contractMap[contract_id] || {}
				const subtitle = format ? format(data[innerKey]) : data[innerKey]
				let link = `/contract/${contract_id}`

				if (isToken) {
					const token = batch[contract_id]?.[token_id]
					title = token_id
					media = token?.metadata?.media
					link = `/token/${contract_id}/${token_id}`
				}

				return <Link key={i} to={link} className='feature-card'>
					<div>
						<div>
							<Media {...{ media }} />
							<h3>{title}</h3>
							<p>{subtitle}</p>
						</div>
					</div>
				</Link>
			})
		}
	</div>
};