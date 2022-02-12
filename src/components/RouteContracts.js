import React, { useState } from 'react';
import { useStore } from '../utils/store';

import { Page } from './Page';
import { Media } from './Media';

export const RouteContracts = ({ update, navigate, contracts, index, pageSize }) => {

	const [filter, setFilter] = useStore('__FILTER');
	const [loading, setLoading] = useState(false);

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
				return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
					<Media {...{media}} />
					<p>{name || contract_id}</p>
					<p>{contract_id}</p>
				</div>;
			}
		}} />

	</div>;
};