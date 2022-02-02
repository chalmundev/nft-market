import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../utils/store';

import { Rows } from './Rows';
import { TokenMedia } from './TokenMedia';

const PAGE_SIZE = 30;

export const RouteContracts = ({ update, contracts, index }) => {
	const navigate = useNavigate();

	const [filter, setFilter] = useStore('__FILTER')

	/// TODO new market summary data to main page here

	/// TODO new contract summary data

	/// TODO new token summary data

	console.log(index)

	const supply = contracts.length
	const displayContracts = contracts
		.filter(({ contract_id, name }) => new RegExp(filter, 'gi').test(contract_id + name))
		.slice(index * PAGE_SIZE, (index+1) * PAGE_SIZE)

	const handlePage = async (_index = 0) => {
		update('data.index', _index);
	}

	return <>

		<input value={filter} onChange={(e) => setFilter(e.target.value)} />

		<p>Page {index+1} / {Math.ceil(supply / PAGE_SIZE)}</p>

		<div className='button-row'>
			{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
			{(index + 1) * PAGE_SIZE < supply ? <button onClick={() => handlePage(index + 1)}>Next</button> : <button style={{ visibility: 'hidden' }}></button>}
		</div>
		
		<Rows {...{
			arr: displayContracts,
			Item: ({ contract_id, ts, name, media }) => {
				return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
					<TokenMedia {...{media}} />
					<p>{name || contract_id}</p>
					<p>{contract_id}</p>
				</div>;
			}
		}} />
	</>
}