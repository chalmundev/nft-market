import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../utils/store';

export const RouteContracts = ({ contracts }) => {
	const navigate = useNavigate();

	const [filter, setFilter] = useStore('__FILTER')

	/// TODO rows view for contracts

	/// TODO new market summary data to main page here

	/// TODO new contract summary data

	/// TODO new token summary data

	return <>

		<input value={filter} onChange={(e) => setFilter(e.target.value)} />

		{
			contracts
				.filter(({ contract_id, name }) => new RegExp(filter, 'gi').test(name))
				.map(({ contract_id, ts, name }) => {
					return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
						{name} - {contract_id} - {ts}
					</div>;
				})
		}

	</>
}