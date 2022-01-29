import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { view, action } from '../state/near';
import { fetchData } from '../state/app';
import { providers, networkId, contractId, parseNearAmount, formatNearAmount } from '../../utils/near-utils';
import { howLongAgo } from '../utils/date';

function getEvents(receipts_outcome) {
	const events = [];
	//loop through each receipt
	for(let i = 0; i < receipts_outcome.length; i++) {
		const { logs } = receipts_outcome[i].outcome;
		//loop through each log in the receipt
		for(let j = 0; j < logs.length; j++) {
			//check if the logs start with MARKET_EVENT
			if(/MARKET_EVENT/.test(logs[j])) {
				//get the current log object
				const log = JSON.parse(logs[j].replace('MARKET_EVENT:', ''));
				//if market event was logged
				if(/update_offer|resolve_offer/.test(log.event)) {
					events.push(log);
				}
			}
		}
	}
	return events;
}

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
			token = await dispatch(view({
				contract_id,
				methodName: 'nft_token',
				args: {
					token_id,
				}
			}));
		}

		if (!data[contract_id]) {
			dispatch(fetchData(contract_id));
		}

		try {
			setOffer(await dispatch(view({
				methodName: 'get_offer',
				args: {
					contract_id,
					token_id,
				}
			})));
		} catch (e) {
			console.warn(e);
		}

		const txHashes = window.location.href.split('?transactionHashes=')[1];
		if (txHashes) {
			const [hash] = txHashes.split();
			const { receipts_outcome } = await new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`).sendJsonRpc("EXPERIMENTAL_tx_status", [
				hash,
				"foo",
			]);
			const [log] = getEvents(receipts_outcome);
			const offer = { event: log.event == "update_offer" ? 0 : 1,  maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at};
			setLastOffer(offer);
		}

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
			attachedDeposit: parseNearAmount((parseFloat(amount, 10) + 0.05).toString())
		}));
	};

	const handleAcceptOffer = () => {
		const msg = JSON.stringify({
			auto_transfer: true,
		});
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

	console.log(displayOffers);

	const isOwner = token.owner_id === account.account_id;

	return (
		<div>

			<div className="button-row">
				<button onClick={async () => {
					await fetch('http://107.152.39.196:3000/market', { mode: 'no-cors' }).then(r => r.json());
					alert('fetched. reloading page');
					window.location.reload();
				}}>Update Market Data</button>
			</div>

			<img src={token.metadata.media} />

			<p>{token.token_id}</p>
			<p>{isOwner ? 'You own this token' : token.owner_id}</p>

			{summary && <>
				<h3>Market Summary</h3>
				<p>Average: {formatNearAmount(summary.avg_sale, 4)}</p>
				<p>Volume: {summary.vol_traded}</p>
				<p>Offers (all time): {summary.offers_len}</p>
			</>}
			<div className="offers current-offer">
				{
					offer && <>
						<h3>Current Offer</h3>
						<div className="offer">
							<div>Offer Maker: {offer.maker_id}</div>
							<div>
								<div>Amount: {formatNearAmount(offer.amount, 4)}</div>
								<div>{howLongAgo({ ts: offer.updated_at / (1000 * 1000), detail: 'minute' })} ago</div>
							</div>
						</div>
					</>
				}
			</div>

			{isOwner && <div className="button-row">
				<button onClick={handleAcceptOffer}>Accept Offer</button>
			</div>}

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

			{
				!isOwner && <>

					<h3>Make Offer</h3>
					<input
						type="number"
						placeholder=''
						value={amount}
						onChange={({ target: { value } }) => setAmount(value)}

					/>
					<button onClick={handleMakeOffer}>Make Offer</button>

				</>
			}

		</div>
	);
};
