import { State } from '../utils/state';

import { initNear, marketId } from './near';

const DATA_HOST = 'data.secondx.app';

// example
const initialState = {
	loading: true,
	data: {
		contractId: '',
		supply: 0,
		tokens: [],
		token: {},
		cache: {},
		index: 0,
		offers: {
			type: 'maker',
			maker: [],
			taker: [],
		},
		marketSummary: {},
		contracts: [],
	}
};

export const { appStore, AppProvider } = State(initialState, 'app');

// example app function
export const onAppMount = (message) => async ({ update, getState, dispatch }) => {
	update('app', { mounted: true });
};

export const fetchContracts = () => async ({ update }) => {
	const res = await fetchJson(`https://${DATA_HOST}/contracts.json`);
	const contracts = res.contracts || res;
	update('data', { contracts });
};

export const fetchData = (fn = 'marketSummary') => async ({ update }) => {
	const res = await fetchJson(`https://${DATA_HOST}/${marketId}/${fn}.json`);
	console.log(res)
	update('data', { [fn]: res });
};

/// helper
export const fetchJson = async (url) => {
	let res;
	try {
		res = await fetch(url).then((r) => r.json());
	} catch(e) {
		console.warn('ERROR: fetching data', fn, e);
		res = {};
	}
	return res;
};