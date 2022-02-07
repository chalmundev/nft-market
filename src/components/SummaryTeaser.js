import React, { useEffect } from 'react';
import {
	Link,
} from "react-router-dom";
import { parseData } from '../utils/media'
import { Media } from './Media';
import '../css/Features.scss';

/// items are tokens or contracts

export const SummaryTeaser = ({ contractMap, batch, data, items }) => {
	const { label, key } = data

	return <div className='summary-teaser'>
		<div>
			<p>{label}</p>
			<p><Link to={`/summary/${key}`}>View All</Link></p>
		</div>

		<div>

			{
				items.map((item, i) => {
					const { title, subtitle, link, media } = parseData(contractMap, batch, data, item)

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
	</div>
};