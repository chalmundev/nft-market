import { State } from '../utils/state';

import { initNear, marketId } from './near';

const DATA_HOST = process.env.REACT_APP_ENV === 'prod' ? 'https://data.secondx.app' : 'http://localhost:1234/out';

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
	const res = await fetchJson(`${DATA_HOST}/contracts.json`);
	const contracts = Object.entries(res.contracts).map(([contract_id, data]) => ({
		contract_id,
		...data,
	}))
	update('data', { contracts });
};

export const fetchData = (fn = 'marketSummary') => async ({ update }) => {
	const res = await fetchJson(`${DATA_HOST}/${marketId}/${fn}.json`);
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