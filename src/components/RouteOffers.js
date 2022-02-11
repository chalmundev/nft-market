import React, { useState, useEffect } from 'react';

import { PAGE_SIZE } from '../state/app';
import { view, fetchBatchTokens } from '../state/near';
import { parseData } from '../utils/media';
import { near } from '../utils/format';
import { Page } from './Page';
import { MediaCard } from './MediaCard';

const DATA = { label: 'Amount', innerKey: 'amount', format: near, isToken: true };

/// TODO add likelyNFTs endpoint and get user's tokens if we have the contract too
/// https://helper.testnet.near.org/account/benjiman.testnet/likelyNFTs

export const RouteOffers = ({ dispatch, update, navigate, account, data }) => {
	if (!account) return null;

	const { offers, supply, index, contractMap, batch } = data;
	const { account_id } = account;

	const isMaker = /maker/.test(window.location.href);
	const isTaker = !isMaker;
	const type = isMaker ? 'maker' : 'taker';

	const [loading, setLoading] = useState(true);

	const onMount = async () => {
		if (offers[type].length > 0) {
			return;
		}
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

		console.log(account_id, offers);

		await dispatch(fetchBatchTokens(offers.map(({ contract_id, token_id }) => ({ contract_id, token_id }))));

		setLoading(false);
	};

	const [, offerArr = []] = offers[type];

	return <div className='route offers'>
		<h3>{isMaker ? 'My Offers' : 'My Tokens'}</h3>

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


	</div>;
};
