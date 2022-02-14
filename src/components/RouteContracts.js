import React, { useState, useEffect } from 'react';
import { useStore } from '../utils/store';

import { Page } from './Page';
import { MediaCard } from './MediaCard';

export const RouteContracts = ({ update, navigate, contracts, index, pageSize }) => {

	const [filter, setFilter] = useStore('__FILTER');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		window.scrollTo(0, 0)
	}, [])

	const filteredContracts = filter
		?
		contracts.filter(({ contract_id, name }) => new RegExp(filter, 'gi').test(contract_id + name))
		:
		contracts;

	const displayContracts = filteredContracts.slice(index * pageSize, (index+1) * pageSize);

	const handlePage = async (_index = 0) => {
		setLoading(true);
		await update('data.index', _index);
		setLoading(false);
	};

	return <div className="route contracts">

		<input value={filter} onChange={(e) => {
			setFilter(e.target.value);
			handlePage(0);
		}} />

		<Page {...{
			index,
			supply: filteredContracts.length,
			handlePage,
			pageSize: pageSize,
			loading,
			arr: displayContracts,
			Item: ({ contract_id, ts, name, media }) => {
				return <div>
						<MediaCard {...{
							subtitle: name || contract_id,
							media,
							link: `/contract/${contract_id}`,
							classNames: ['feature-card', 'full-width'],
							useCanvas: true,
						}} />
{/* 					
					<Media {...{media, useCanvas: true}} />
					<p>{name || contract_id}</p>
					<p>{contract_id}</p> */}
				</div>;
			}
		}} />

	</div>;
};