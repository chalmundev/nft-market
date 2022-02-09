import React, { useState, useEffect } from 'react';
import BN from 'bn.js';
import { useParams } from 'react-router-dom';
import { view, action, fetchBatchTokens } from '../state/near';
import { fetchData } from '../state/app';
import { providers, networkId, contractId, parseNearAmount, formatNearAmount } from '../../utils/near-utils';
import { howLongAgo } from '../utils/date';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { getOfferFromHashes } from '../utils/receipts';
import { Media } from './Media';

const OUTBID_AMOUNT = '99999999999999999999999';
const OUTBID_TIMEOUT = 86400000;

export const RouteToken = ({ dispatch, account, data }) => {
	const { contract_id, token_id } = useParams();

	const { contractMap, batch, tokens } = data;

	const [offer, setOffer] = useState();
	const [lastOffer, setLastOffer] = useState();
	const [amount, setAmount] = useState('');

	const onMount = async () => {
		let token = tokens.find((token) => token.token_id === token_id);
		if (!token) {
			dispatch(fetchBatchTokens([{ contract_id, token_id }]))
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
			}));
			setOffer(offer);
		} catch (e) {
			console.warn(e);
		}

		setLastOffer(await getOfferFromHashes());

		// debugging
		// const storageAvailable = await dispatch(view({
		// 	methodName: 'offer_storage_available',
		// 	args: { owner_id: account.account_id }
		// }));
	};
	useEffect(onMount, []);

	const handleMakeOffer = () => {

		if (offer && offer.maker_id !== offer.taker_id && new BN(parseNearAmount(amount)).sub(new BN(OUTBID_AMOUNT)).lt(new BN(offer.amount))) {
			return alert('Counter offer is too small');
		}

		dispatch(action({
			methodName: 'make_offer',
			args: {
				contract_id,
				token_id,
			},
			attachedDeposit: parseNearAmount((parseFloat(amount) + 0.02).toString())
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

	const handleAcceptOffer = async () => {
		let msg = amount.length === 0
			? JSON.stringify({ auto_transfer: true })
			: JSON.stringify({ amount: parseNearAmount(amount) });

		if (offer) {
			if (amount.length > 0 && new BN(parseNearAmount(amount)).sub(new BN(OUTBID_AMOUNT)).lt(new BN(offer.amount))) {
				return alert('Counter offer is too small');
			}
		} else {
			const storageAvailable = await dispatch(view({
				methodName: 'offer_storage_available',
				args: { owner_id: account.account_id }
			}));
			console.log(storageAvailable);
			if (storageAvailable === 0) {
				alert('must pre-pay offer storage');
				const attachedDeposit = await dispatch(view({
					methodName: 'offer_storage_amount',
				}));
				return dispatch(action({
					methodName: 'pay_offer_storage',
					args: {},
					attachedDeposit
				}));
			}
		}

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

	let {
		summary, offers = []
	} = data[contract_id]?.tokens?.[token_id] || {};

	const displayOffers = offers.slice(0, offer ? -1 : undefined).reverse();

	// if (lastOffer && !displayOffers.find(({ updated_at }) => lastOffer.updated_at === updated_at)) {
	// 	displayOffers.unshift(lastOffer);
	// }

	// const isOwner = token.owner_id === account?.account_id;
	// const ifOfferOwner = offer?.maker_id === account?.account_id;
	// const offerLabel = isOwner ? 'Set Price' : 'Make Offer';
	// const { media } = token.metadata;

	const { title, subtitle, media, link } = parseData(contractMap, batch, { isToken: true }, { contract_id, token_id })


	if (!summary) return null
	return (
		<div className="route token">

			{/* <div className="button-row">
				<button onClick={async () => {
					await fetch('http://107.152.39.196:3000/market', { mode: 'no-cors' }).then(r => r.json());
					alert('fetched. reloading page');
					window.location.reload();
				}}>Update Market Data</button>
			</div> */}

			<Media {...{media, classNames: ['token']}} />

			<h2>{title}</h2>
			<p>{token_id}</p>
{/* 
			<p>{token.token_id}</p>
			<p>{isOwner ? 'You own this token' : token.owner_id}</p> */}

			<div className='stats'>
				<div>
					<div>Avg</div>
					<div>{near(summary.avg_sale)}</div>
				</div>
				<div>
					<div>Sales</div>
					<div>{summary.sales}</div>
				</div>
				<div>
					<div>Events</div>
					<div>{summary.events}</div>
				</div>
			</div>
			{summary.highest && <div className='stats'>
				<div>
					<div>Highest</div>
					<div>{ near(summary.highest.amount) }</div>
				</div>
				<div>
					<div>Lowest</div>
					<div>{ near(summary.lowest.amount) }</div>
				</div>
			</div>}

			{/* {
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
					{ifOfferOwner && (isOwner || offer.updated_at < (Date.now() - OUTBID_TIMEOUT) * 1000000) && <div className="button-row">
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
				(!ifOfferOwner ||!offer) && <>

					<h3>{ offerLabel }</h3>
					<input
						type="number"
						placeholder='Amount (N)'
						value={amount}
						onChange={({ target: { value } }) => setAmount(value)}

					/>
					<button onClick={isOwner ? handleAcceptOffer : handleMakeOffer}>{ offerLabel }</button>

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
			</div> */}

		</div>
	);
};
