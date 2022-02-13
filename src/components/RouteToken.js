import React, { useState, useEffect } from 'react';
import BN from 'bn.js';
import { useParams } from 'react-router-dom';
import { view, action, fetchBatchTokens } from '../state/near';
import { fetchData } from '../state/app';
import { share } from '../utils/share';

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
	const [amount, setAmount] = useState('');

	const onMount = async () => {
		window.scrollTo(0, 0);

		if (!data[contract_id]) {
			await dispatch(fetchData(contract_id));
		}

		let token = tokens.find((token) => token.token_id === token_id);

		console.log(token)

		if (!token) {
			dispatch(fetchBatchTokens([{ contract_id, token_id }]));
		} else {
			setToken(token);
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
			setAmount(formatNearAmount(offer?.amount, 4));
		} catch (e) {
			// console.warn(e);
		}

		setLastOffer(await getOfferFromHashes());

		if (!account) return;

		const storageAvailable = await dispatch(view({
			methodName: 'offer_storage_available',
			args: { owner_id: account.account_id }
		}));
		console.log(storageAvailable);
	};
	useEffect(onMount, []);

	const onBatch = () => {
		if (token || !batch[contract_id]?.[token_id]) return;
		setToken(batch[contract_id][token_id]);
	};
	useEffect(onBatch, [batch]);

	const handleMakeOffer = () => {
		if (offer) {
			// buy now
			if (offer.maker_id === offer.taker_id) {
				if (!new BN(parseNearAmount(amount)).eq(new BN(offer.amount))) {
					return alert('Must be the exact price only!');
				}
				// outbid
			} else {
				if (new BN(parseNearAmount(amount)).sub(new BN(OUTBID_AMOUNT)).lt(new BN(offer.amount))) {
					return alert('Counter offer is too small! (by 0.1 N)');
				}
			}
		}
		// new offer
		if (!amount || amount.length === 0 || amount < 0.1) {
			return alert('Please add a price! (min 0.1 N)');
		}
		dispatch(action({
			methodName: 'make_offer',
			args: {
				contract_id,
				token_id,
			},
			attachedDeposit: new BN(parseNearAmount(amount)).add(new BN(parseNearAmount('0.02'))).toString()
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

	const handleAcceptOffer = async (accept = false) => {
		let msg = accept
			? JSON.stringify({ auto_transfer: true })
			: JSON.stringify({ amount: parseNearAmount(amount) });

		if (offer) {
			if (!accept && new BN(parseNearAmount(amount || '0')).sub(new BN(OUTBID_AMOUNT)).lt(new BN(offer.amount))) {
				return alert('Counter offer is too small! (by 0.1 N)');
			}
		} else {
			const storageAvailable = await dispatch(view({
				methodName: 'offer_storage_available',
				args: { owner_id: account.account_id }
			}));
			console.log(storageAvailable);
			if (storageAvailable === 0) {
				await alert('Must pre-pay storage for offers. Redirecting now!', 5000);
				const attachedDeposit = await dispatch(view({
					methodName: 'offer_storage_amount',
				}));
				return dispatch(action({
					methodName: 'pay_offer_storage',
					args: {},
					attachedDeposit
				}));
			}
			if (!amount || amount.length === 0 || amount < 0.1) {
				return alert('Please add a price! (min 0.1 N)');
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
	} = data[contract_id]?.tokens?.[token_id] || {
		summary: {
			avg_sale: '0',
			sales: 'NA',
			events: 'NA',
			noChart: true
		}
	};

	const displayOffers = offers.filter(({ event }) => event === 0).slice(0, offer ? -1 : undefined).reverse();
	const displaySales = offers.filter(({ event }) => event === 1).reverse();

	if (!token) return null;

	const isOwner = token.owner_id === account?.account_id;
	const isPrice = offer && offer?.maker_id === offer?.taker_id;
	const ifOfferOwner = account && offer?.maker_id === account?.account_id;
	let offerLabel = 'Make Offer';
	if (isOwner) offerLabel = 'Set Price'
	if (ifOfferOwner) {
		if (isOwner) offerLabel = 'Increase Price'
		else offerLabel = 'Increase Offer'
	}
	if (isPrice) offerLabel = 'Buy Now'
	const displayCurrent = { ...offer };
	if (ifOfferOwner) displayCurrent.maker_id = 'Your Offer';

	let { title, subtitle, media, link, owner_id } = parseData(contractMap, batch, { isToken: true }, { contract_id, token_id });
	if (!media && token) media = token?.metadata?.media

	const offerData = tokenPriceHistory(offers, true);
	const saleData = tokenPriceHistory(offers);

	return (
		<div className="route token">

			<div className='resp-grid'>

				<div>

					<Media {...{ media, classNames: ['token'] }} />

					<h2>{title}</h2>
					<p>{contract_id}</p>
					<p>Owner: {owner_id}</p>

				</div>

				<div>

					<button onClick={() => share({ contract_id, token_id, link })}>🤗 Share 🥰</button>

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
							<div>{near(summary.highest.amount)}</div>
						</div>
						<div>
							<div>Lowest</div>
							<div>{near(summary.lowest.amount)}</div>
						</div>
					</div>}

					{
						offer ? <>

							<Events {...{ title: isPrice ? 'Owner Offer' : 'Current Offer', events: [displayCurrent] }} />

						</>
							:
							<p>No Current Offer</p>
					}


					<div className='clamp-width'>
						{
							ifOfferOwner &&
							(isOwner || offer?.updated_at < (Date.now() - OUTBID_TIMEOUT) * 1000000) &&
							<button onClick={handleRemoveOffer}>Remove Offer</button>
						}

						{isOwner && offer && !ifOfferOwner && <button onClick={() => handleAcceptOffer(true)}>Accept Offer</button>}
						<input
							type="number"
							placeholder='Amount (N)'
							value={amount}
							onChange={({ target: { value } }) => setAmount(value)}
						/>
						<button onClick={() => isOwner ? handleAcceptOffer() : handleMakeOffer()}>{offerLabel}</button>
					</div>




				</div>

			</div>

			<div className='resp-grid'>

				<div>

					{offerData.length > 0 && <>
						<Chart {...{
							title: 'Offer History',
							data: offerData
						}} />
						
						<Events {...{ title: 'Offers', events: displayOffers }} />
					</>}

				</div>
				<div>

					{saleData.length > 0 && <>
						<Chart {...{
							title: 'Sale History',
							data: saleData
						}} />

						<Events {...{ title: 'Sales', events: displaySales }} />
					</>
					}
				</div>

			</div>

		</div>
	);
};
