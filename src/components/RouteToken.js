import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { view, action } from '../state/near';
import { fetchData } from '../state/app';
import { contractId, parseNearAmount, formatNearAmount } from '../../utils/near-utils';
import { howLongAgo } from '../utils/date';

export const RouteToken = ({ dispatch, tokens, data }) => {
	const params = useParams();
	const { contract_id, token_id } = params;

	const [token, setToken] = useState()
	const [offer, setOffer] = useState()
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

		if (!data[contract_id]) {
			dispatch(fetchData(contract_id))
		}

		try {
			setOffer(await dispatch(view({
				methodName: 'get_offer',
				args: {
					contract_id,
					token_id,
				}
			})))
		} catch (e) {
			console.warn(e)
		}

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

	let {
		summary, offers = []
	} = data[contract_id]?.tokens?.[token_id] || {}

	return (
		<div>

			<div className="button-row">
				<button onClick={async () => {
					await fetch('http://107.152.39.196:3000/market', { mode: 'no-cors' }).then(r => r.json())
					alert('fetched. reloading page')
					window.location.reload()
				}}>SOFT Update Market Data</button>
				<button onClick={async () => {
					await fetch('http://107.152.39.196:3000/market/true', { mode: 'no-cors' }).then(r => r.json())
					alert('fetched. reloading page')
					window.location.reload()
				}}>HARD SOFT Update Market Data</button>
			</div>

			<img src={token.metadata.media} />

			<p>{token.token_id}</p>
			<p>{token.owner_id}</p>

			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				<p>Volume: {summary.vol_traded}</p>
				<p>Offers (all time): {summary.offers_len}</p>
			</>}
			{
				offer && <>
					<h3>Current Offer</h3>
					<div className="offer">
						<div>
							<div>Offer Maker: {offer.maker_id}</div>
							<div>Amount: {formatNearAmount(offer.amount, 4)}</div>
							<div>{howLongAgo({ ts: offer.updated_at / (1000 * 1000), detail: 'minute' })} ago</div>
						</div>
					</div>
				</>
			}

			<h3>Offers</h3>
			{
				offers.map(({ amount, maker_id, updated_at }, i) => <div className="offer" key={i}>
					<div>
						<div>Offer Maker: {maker_id}</div>
						<div>Amount: {formatNearAmount(amount, 4)}</div>
						<div>{howLongAgo({ ts: updated_at / (1000 * 1000), detail: 'minute' })} ago</div>
					</div>
				</div>)
			}

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
