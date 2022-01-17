import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { view, action } from '../state/near';
import { contractId, parseNearAmount } from '../../utils/near-utils';

export const RouteToken = ({ dispatch, tokens }) => {
	const params = useParams();
	const { contract_id, token_id } = params;

	const [token, setToken] = useState()
	const [amount, setAmount] = useState('')
	
	const onMount = async () => {
		let token = tokens.find((token) => token.token_id === token_id)
		if (!token) {
			token = await dispatch(view({
				contract_id,
				methodName: 'nft_token',
				args: {
					token_id,
				}
			}))
		}

		const offer = await dispatch(view({
			methodName: 'get_offer',
			args: {
				contract_id,
				token_id,
			}
		}))

		console.log(offer)
		
		setToken(token)
	};
	useEffect(onMount, []);

	const handleMakeOffer = () => {
		dispatch(action({
			methodName: 'make_offer',
			args: {
				contract_id,
				token_id,
			},
			attachedDeposit: parseNearAmount((parseFloat(amount, 10) + 0.05).toString())
		}))
	}

	if (!token) return null

	return (
		<div>

			<img src={token.metadata.media} />

			<p>{ token.token_id }</p>
			<p>{ token.owner_id }</p>

			<input
				type="number"
				placeholder=''
				value={amount}
				onChange={({ target: { value } }) => setAmount(value)}

			/>
			<button onClick={handleMakeOffer}>Make Offer</button>

		</div>
	);
};
