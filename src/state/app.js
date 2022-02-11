import { State } from '../utils/state';
import { parseMedia } from '../utils/media';

import { fetchBatchContracts, initNear, marketId } from './near';

const DATA_HOST = process.env.REACT_APP_DATA === 'remote' ? 'https://data.secondx.app' : 'http://localhost:1234/out';

let lastCheck = Date.now();
let rate = 0;
export const near2usd = () => {
	if (!rate || Date.now() - lastCheck > 300000) {
		lastCheck = Date.now();
		fetch('https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd')
			.then(r => r.json())
			.then(({ near: { usd } }) => {
				console.log('NEAR RATE:', usd);
				rate = usd;
			});
	}
	return rate;
};
near2usd();

export const PAGE_SIZE = 20;

// example
const initialState = {
	loading: true,
	networkId: 'testnet',
	modal: null,
	data: {
		contractId: '',
		supply: 0,
		tokens: [],
		token: {},
		batch: {},
		index: 0,
		offers: {
			type: 'maker',
			maker: [],
			taker: [],
		},
		marketSummary: {},
		contracts: [],
		contractMap: {},
	}
};

export const { appStore, AppProvider } = State(initialState, 'app');

export const onAppMount = () => async ({ getState, update }) => {
	window.__alert = window.alert;
	window.alert = (message) => new Promise((res, dur) => {
		update('modal', { message });
		setTimeout(res, dur);
	});
};

export const parseContractMap = (contractMap) => {
	const contracts = Object.entries(contractMap).map(([contract_id, data]) => {
		const media = parseMedia(data.media);
		contractMap[contract_id].media = media;
		return {
			contract_id,
			...data,
			media,
		};
	});
	return { contracts, contractMap };
};

export const fetchContracts = () => async ({ getState, update }) => {
	const { networkId } = getState();
	
	const { contracts } = await fetchJson(`${DATA_HOST}/${networkId}/contracts.json`);
	update('data', parseContractMap(contracts));
};

export const fetchData = (fn = 'marketSummary') => async ({ getState, dispatch, update }) => {
	const { networkId, data: { contractMap } } = getState();

	const res = await fetchJson(`${DATA_HOST}/${networkId}/${marketId}/${fn}.json`);
	const missing = [];
	Object.values(res).forEach((arr) => {
		if (!Array.isArray(arr)) return;
		arr.forEach(({ contract_id }) => {
			if (contract_id && !contractMap[contract_id]) missing.push(contract_id);
		});
	});
	await dispatch(fetchBatchContracts(missing));

	update('data', { [fn]: res });
};

/// helper
export const fetchJson = async (url) => {
	let res;
	try {
		res = await fetch(url).then((r) => r.json());
	} catch(e) {
		console.warn('ERROR: fetching data', url, e);
		res = {};
	}
	return res;
};