import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../utils/store';

export const RouteMain = ({ contracts }) => {
	const navigate = useNavigate();

	const [filter, setFilter] = useStore('__FILTER')

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