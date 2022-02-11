import React, { useState, useEffect } from 'react';

import { PAGE_SIZE } from '../state/app';
import { view, fetchBatchTokens } from '../state/near';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { Page } from './Page';
import { MediaCard } from './MediaCard';

const DATA = { label: 'Amount', innerKey: 'amount', format: near, isToken: true };
const NFT_DATA = { };

/// TODO add likelyNFTs endpoint and get user's tokens if we have the contract too
/// https://helper.testnet.near.org/account/benjiman.testnet/likelyNFTs

export const RouteOffers = ({ dispatch, update, navigate, account, data, networkId }) => {
	if (!account) return null;

	const { offers, supply, index, contractMap, batch } = data;
	const { account_id } = account;

	const isMaker = /maker/.test(window.location.href);
	const isTaker = !isMaker;
	const type = isMaker ? 'maker' : 'taker';

	const [loading, setLoading] = useState(true);
	const [nfts, setNFTs] = useState([]);

	const onMount = async () => {
		console.log('offers mount');
		setLoading(true);

		const [_supply] = await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id,
				from_index: '0',
				limit: 1,
			},
		}));
		await handlePage(index, _supply);
		update('data.supply', _supply);

		/// finding the users tokens

		if (type === 'taker') {
			const likelyNFTs = await fetch(`https://helper.${networkId}.near.org/account/${account.accountId}/likelyNFTs`).then(r => r.json());
			const nfts = likelyNFTs.filter((contract_id) => !!contractMap[contract_id]).map((contract_id) => ({ contract_id }));
			setNFTs(nfts);
		}

		return () => {
			update('data', { index: 0, offers: { [type]: [] } });
		};
	};
	useEffect(onMount, [type]);

	const handlePage = async (_index = 0, _supply = supply) => {
		setLoading(true);

		if (index !== _index) {
			update('data.index', _index);
		}

		let from_index = (_supply - PAGE_SIZE * (_index + 1));
		let limit = PAGE_SIZE;
		if (from_index < 0) {
			from_index = 0;
			limit = _supply % PAGE_SIZE;
		}
		from_index = from_index.toString();

		const [, offers] = await dispatch(view({
			methodName: `get_offers_by_${type}_id`,
			args: {
				account_id,
				from_index,
				limit,
			},
			key: 'data.offers.' + type
		}));

		await dispatch(fetchBatchTokens(offers.map(({ contract_id, token_id }) => ({ contract_id, token_id }))));

		setLoading(false);
	};

	const [, offerArr = []] = offers[type];

	return <div className='route offers'>
		<h3>{isMaker ? 'My Offers' : 'Received Offers'}</h3>

		{
			!loading && offerArr.length === 0 && <p>You have not {isMaker ? 'made' : 'received'} offers yet.</p>
		}

		{offerArr.length > 0 && <Page {...{
			update,
			index,
			supply,
			handlePage,
			pageSize: PAGE_SIZE,
			loading,
			width: Math.min(window.innerWidth / 2, 375),
			arr: offerArr,
			Item: (item) => {
				const { contract_id, token_id } = item;
				const { title, subtitle, media, link } = parseData(contractMap, batch, DATA, item);

				return <div key={contract_id + ':' + token_id}>
					<MediaCard {...{
						title: title || token_id,
						subtitle: subtitle,
						media,
						link,
						classNames: ['feature-card', 'tall']
					}} />
				</div>;
			}
		}} />}

		{
			!isMaker && nfts.length > 0 && <>
				<h3>My Tokens</h3>
				<Page {...{
					update: () => {},
					index: 0,
					supply: nfts.length,
					handlePage: () => {},
					pageSize: 1000,
					loading: false,
					width: Math.min(window.innerWidth / 2, 375),
					arr: nfts,
					Item: (item, i) => {
						let { title, media, link } = parseData(contractMap, batch, NFT_DATA, item);
						link += `/${account.account_id}`
						return <div key={i}>
							<MediaCard {...{
								title,
								media,
								link,
								classNames: ['feature-card', 'tall']
							}} />
						</div>;
					}
				}} />
			</>
		}


	</div>;
};
