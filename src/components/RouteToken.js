import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { view, action } from '../state/near';
import { fetchData } from '../state/app';
import { providers, networkId, contractId, parseNearAmount, formatNearAmount } from '../../utils/near-utils';
import { howLongAgo } from '../utils/date';
import { parseToken } from '../utils/token';
import { getOfferFromHashes } from '../utils/receipts';

export const RouteToken = ({ dispatch, account, data }) => {
	const params = useParams();
	const { contract_id, token_id } = params;

	const { tokens } = data;

	const [token, setToken] = useState();
	const [offer, setOffer] = useState();
	const [lastOffer, setLastOffer] = useState();
	const [amount, setAmount] = useState('');

	const onMount = async () => {
		let token = tokens.find((token) => token.token_id === token_id);
		if (!token) {
			token = parseToken(await dispatch(view({
				contract_id,
				methodName: 'nft_token',
				args: {
					token_id,
				}
			})));
		}

		if (!data[contract_id]) {
			dispatch(fetchData(contract_id));
		}

		try {
			const [, offer] = await dispatch(view({
				methodName: 'get_offer',
				args: {
					contract_id,
					token_id,
				}
			}))
			setOffer(offer);
		} catch (e) {
			console.warn(e);
		}

		setLastOffer(await getOfferFromHashes())

		setToken(token);
	};
	useEffect(onMount, []);

	const handleMakeOffer = () => {
		dispatch(action({
			methodName: 'make_offer',
			args: {
				contract_id,
				token_id,
			},
			attachedDeposit: parseNearAmount((parseFloat(amount, 10) + 0.02).toString())
		}));
	};

	const handleRemoveOffer = () => {
		dispatch(action({
			methodName: 'remove_offer',
			args: {
				contract_id,
				token_id,
			},
			attachedDeposit: 1
		}));
	};

	const handleAcceptOffer = () => {
		let msg = amount.length === 0
		? JSON.stringify({ auto_transfer: true })
		: JSON.stringify({ amount: parseNearAmount(amount) })
		
		dispatch(action({
			contractId: contract_id,
			methodName: 'nft_approve',
			args: {
				token_id,
				account_id: contractId,
				msg,
			},
			attachedDeposit: parseNearAmount('0.01')
		}));
	};

	if (!token) return null;

	let {
		summary, offers = []
	} = data[contract_id]?.tokens?.[token_id] || {};

	const displayOffers = offers.slice(0, offer ? -1 : undefined).reverse();

	if (lastOffer && !displayOffers.find(({ updated_at }) => lastOffer.updated_at === updated_at)) {
		displayOffers.unshift(lastOffer);
	}

	const isOwner = token.owner_id === account?.account_id;
	const ifOfferOwner = offer?.maker_id === account?.account_id; 

	return (
		<div>

			{/* <div className="button-row">
				<button onClick={async () => {
					await fetch('http://107.152.39.196:3000/market', { mode: 'no-cors' }).then(r => r.json());
					alert('fetched. reloading page');
					window.location.reload();
				}}>Update Market Data</button>
			</div> */}

			<img src={token.metadata.media} />

			<p>{token.token_id}</p>
			<p>{isOwner ? 'You own this token' : token.owner_id}</p>

			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				<p>Volume: {summary.vol_traded}</p>
				<p>Offers (all time): {summary.offers_len}</p>
			</>}

			{
				offer && <>
					<div className="offers current-offer">
						<h3>Current Offer</h3>
						<div className="offer">
							<div>From: {ifOfferOwner ? 'You' : offer.maker_id}</div>
							<div>
								<div>Amount: {formatNearAmount(offer.amount, 4)}</div>
								<div>{howLongAgo({ ts: offer.updated_at / (1000 * 1000), detail: 'minute' })} ago</div>
							</div>
						</div>
					</div>
					{ifOfferOwner && offer.updated_at < (Date.now() - 86400000) * 1000000 && <div className="button-row">
						<button onClick={handleRemoveOffer}>Remove Offer</button>
					</div>}
					{isOwner && !ifOfferOwner && <>
						<input
							type="number"
							placeholder='Counter Offer Amount (N) (optional)'
							value={amount}
							onChange={({ target: { value } }) => setAmount(value)}
						/>
						<div className="button-row">
							<button onClick={handleAcceptOffer}>{amount.length > 0 ? 'Counter' : 'Accept'} Offer</button>
						</div>
					</>}
				</>
			}

			{
				!isOwner && !ifOfferOwner && <>

					<h3>Make Offer</h3>
					<input
						type="number"
						placeholder='Offer Amount (N)'
						value={amount}
						onChange={({ target: { value } }) => setAmount(value)}

					/>
					<button onClick={handleMakeOffer}>Make Offer</button>

				</>
			}

			<h3>Previous Offers</h3>
			<div className="offers">
				{
					displayOffers.map(({ event, amount, maker_id, taker_id, updated_at }, i) => <div className="offer" key={i}>
						<div>
							<div>{event === 1 ? 'SOLD TO' : 'From'}: {maker_id}</div>
							<div>Owner: {taker_id}</div>
						</div>
						<div>
							<div>Amount: {formatNearAmount(amount, 4)}</div>
							<div>{howLongAgo({ ts: updated_at / (1000 * 1000), detail: 'minute' })} ago</div>
						</div>
					</div>)
				}
			</div>

		</div>
	);
};
