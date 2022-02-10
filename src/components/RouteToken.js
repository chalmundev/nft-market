import React, { useState, useEffect } from 'react';
import BN from 'bn.js';
import { useParams } from 'react-router-dom';
import { view, action, fetchBatchTokens } from '../state/near';
import { fetchData } from '../state/app';

import { Chart } from './Chart';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { getOfferFromHashes } from '../utils/receipts';
import { Events } from './Events';
import { Media } from './Media';
import { tokenPriceHistory } from '../utils/data';

import { providers, networkId, contractId, parseNearAmount, formatNearAmount } from '../../utils/near-utils';
import { howLongAgo } from '../utils/date';


const OUTBID_AMOUNT = '99999999999999999999999';
const OUTBID_TIMEOUT = 86400000;

export const RouteToken = ({ dispatch, account, data }) => {
	const { contract_id, token_id } = useParams();

	const { contractMap, batch, tokens } = data;

	const [offer, setOffer] = useState();
	const [token, setToken] = useState();
	const [lastOffer, setLastOffer] = useState();
	const [amount, setAmount] = useState();

	const onMount = async () => {
		window.scrollTo(0, 0) 

		if (!data[contract_id]) {
			await dispatch(fetchData(contract_id));
		}

		let token = tokens.find((token) => token.token_id === token_id);
		if (!token) {
			dispatch(fetchBatchTokens([{ contract_id, token_id }]))
		} else {
			setToken(token)
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
			setAmount(formatNearAmount(offer?.amount, 4))
		} catch (e) {
			// console.warn(e);
		}

		setLastOffer(await getOfferFromHashes());

		const storageAvailable = await dispatch(view({
			methodName: 'offer_storage_available',
			args: { owner_id: account.account_id }
		}));
		console.log(storageAvailable)
	};
	useEffect(onMount, []);

	const onBatch = () => {
		if (token || !batch[contract_id]?.[token_id]) return
		setToken(batch[contract_id][token_id])
	}
	useEffect(onBatch, [batch]);

	const handleMakeOffer = () => {
		if (offer && offer.maker_id !== offer.taker_id && new BN(parseNearAmount(amount)).sub(new BN(OUTBID_AMOUNT)).lt(new BN(offer.amount))) {
			return alert('Offer increase is too small');
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

	const displayOffers = offers.filter(({ event }) => event === 0).slice(0, offer ? -1 : undefined).reverse();
	const displaySales = offers.filter(({ event }) => event === 1).reverse();

	if (!token || !summary) return null

	const isOwner = token.owner_id === account?.account_id;
	const isPrice = offer && offer?.maker_id === offer?.taker_id;
	const ifOfferOwner = offer?.maker_id === account?.account_id;
	const offerLabel = isOwner ? 'Set Price' : ifOfferOwner ? 'Increase Offer' : isPrice ? 'Buy Now' : 'Make Offer';
	const displayCurrent = {...offer}
	if (ifOfferOwner) displayCurrent.maker_id = 'Your Offer'

	const { title, subtitle, media, link } = parseData(contractMap, batch, { isToken: true }, { contract_id, token_id })
	const offerData = tokenPriceHistory(offers, true)
	const saleData = tokenPriceHistory(offers)

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

			{
				offer && <>
					
					<Events {...{ title: isPrice ? 'Owner Offer' : 'Current Offer', events: [displayCurrent] }} />
					
					{ifOfferOwner && (isOwner || offer.updated_at < (Date.now() - OUTBID_TIMEOUT) * 1000000) && <div className="button-row">
						<button onClick={handleRemoveOffer}>Remove Offer</button>
					</div>}
				</>
			}

			{!isPrice && <input
				type="number"
				placeholder='Amount (N)'
				value={amount}
				onChange={({ target: { value } }) => setAmount(value)}
			/>}
			<button onClick={isOwner ? handleAcceptOffer : handleMakeOffer}>{ offerLabel }</button>

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
			
			<Events {...{ title: 'Offers', events: displayOffers }} />
			{offerData.length > 0 && <Chart {...{
				title: 'Offer History',
				data: offerData
			} } />}
			
			<Events {...{ title: 'Sales', events: displaySales }} />
			{saleData.length > 0 && <Chart {...{
				title: 'Sale History',
				data: saleData
			} } />}

			
		</div>
	);
};
