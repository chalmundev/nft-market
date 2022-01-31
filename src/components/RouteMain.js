import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const RouteMain = ({ contracts }) => {
	const navigate = useNavigate();

	return <>
	
	{
		contracts.filter(({ contract_id, name }) => /fayyr|loot|luna/gi.test(name) || contract_id === 'tests.nft-market.testnet')
		.map(({ contract_id, ts, name }) => {
			return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
				{name} - {contract_id} - {ts}
			</div>;
		})
	

	}
	
	</>
}