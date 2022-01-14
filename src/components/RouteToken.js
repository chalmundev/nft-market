import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupply, getTokens } from '../state/near';

export const RouteToken = ({ dispatch, tokens }) => {
	const params = useParams();
	const { contract_id, token_id } = params;
	
	const onMount = async () => {
		// dispatch(getTokens(contract_id, (index * PAGE_LIMIT).toString(), PAGE_LIMIT));
	};
	useEffect(onMount, []);

	const token = tokens.find((token) => token.token_id === token_id)

	return (
		<div>

			<img src={token.metadata.media} />

			<p>{ token.token_id }</p>
			<p>{ token.owner_id }</p>

		</div>
	);
};
