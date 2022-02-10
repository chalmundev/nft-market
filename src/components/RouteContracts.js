import React from 'react';
import { useStore } from '../utils/store';

import { Page } from './Page';
import { Media } from './Media';

import { PAGE_SIZE } from '../state/app';

export const RouteContracts = ({ update, navigate, contracts, index }) => {

	const [filter, setFilter] = useStore('__FILTER');

	const supply = contracts.length;
	const displayContracts = contracts
		.filter(({ contract_id, name }) => new RegExp(filter, 'gi').test(contract_id + name))
		.slice(index * PAGE_SIZE, (index+1) * PAGE_SIZE);

	const handlePage = async (_index = 0) => {
		update('data.index', _index);
	};

	return <>

		<input value={filter} onChange={(e) => setFilter(e.target.value)} />

		<Page {...{
			update,
			index,
			supply,
			handlePage,
			pageSize: PAGE_SIZE,
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

	</>;
};