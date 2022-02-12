import * as nearAPI from 'near-api-js';
const { WalletAccount } = nearAPI;
import {
	near, contractAccount, contractId, accounts,
} from '../../utils/near-utils';
import { parseToken } from '../utils/media';
import { parseContractMap } from './app';
import getConfig from '../../utils/config';
const {
	gas,
	attachedDeposit: defaultAttachedDeposit
} = getConfig();
export const marketId = contractId;
export {
	parseNearAmount, formatNearAmount,
} from '../../utils/near-utils';

export const initNear = () => async ({ update }) => {

	const wallet = new WalletAccount(near);

	wallet.signIn = () => {
		wallet.requestSignIn(marketId, 'Blah Blah');
	};
	const signOut = wallet.signOut;
	wallet.signOut = () => {
		signOut.call(wallet);
		update('', { account: null, wallet: { signedIn: false } });
	};

	wallet.signedIn = wallet.isSignedIn();
    
	let account;
	if (wallet.signedIn) {
		account = wallet.account();
		account.account_id = account.accountId;
	}

	await update('', { near, wallet, account });

};


/// actions

export const action = ({
	contractId = marketId,
	methodName,
	args,
	attachedDeposit = defaultAttachedDeposit
}) => async ({ getState }) => {
	try {
		const { account } = getState();
		account.functionCall({
			contractId,
			methodName,
			args,
			gas,
			attachedDeposit,
		});
	} catch(e) {
		console.warn(e);
	}
};

export const view = ({
	contract_id = marketId,
	methodName,
	args,
	key,
	defaultVal
}) => async ({ getState, update }) => {
	// console.log('view', contract_id, methodName, JSON.stringify(args))

	const { networkId } = getState();
	const { market } = accounts[networkId]
	if (defaultVal) {
		update(key, defaultVal);
	}
	try {
		let res = await market.viewFunction(
			contract_id,
			methodName,
			args
		);
		if (/nft_total_supply/.test(methodName)) {
			console.log(res)
			res = parseInt(res, 10);
		}
		if (/nft_tokens/.test(methodName)) {
			res = res.map(parseToken);
		}
		if (key) {
			await update(key, res);
		}
		return res;
	} catch(e) {
		console.warn(e);
	}
};

export const fetchBatchContracts = (contractIds) => async ({ getState, update }) => {
	const { contractMap } = getState()?.data || {};
	
	await Promise.all(contractIds.map((contract_id) => contractAccount.viewFunction(
		contract_id,
		'nft_metadata',
	).then(({ name, symbol }) => {
		if (contractMap[contract_id]) {
			return;
		}
		contractMap[contract_id] = { name, symbol };
	}).catch((e) => {
		// console.warn(e)
		contractMap[contract_id] = { name: contract_id, symbol: 'NA' };
	})));

	update('data', parseContractMap(contractMap));
};

export const fetchBatchTokens = (contractAndTokenIds = []) => async ({ update }) => {
	const batch = {};
	await Promise.all(contractAndTokenIds.map(({ contract_id, token_id }) => contractAccount.viewFunction(
		contract_id,
		'nft_token',
		{ token_id }
	).then((token) => {
		if (!batch[contract_id]) {
			batch[contract_id] = {};
		}
		batch[contract_id][token_id] = parseToken(token);
	}).catch((e) => console.warn(e))));
	update('data.batch', batch);
};

export const fetchTokens = (contract_id, args) => async ({ getState, dispatch }) => {
	const { contractId } = getState()?.data || {};
	dispatch(view({
		contract_id,
		methodName: 'nft_tokens',
		args,
		key: 'data.tokens',
		defaultVal: []
	}));
	if (contract_id === contractId) {
		return;
	}
	dispatch(view({
		contract_id,
		methodName: 'nft_total_supply',
		key: 'data.supply',
		defaultVal: 0,
	}));
};

export const fetchTokensForOwner = (contract_id, args) => async ({ getState, dispatch }) => {
	dispatch(view({
		contract_id,
		methodName: 'nft_tokens_for_owner',
		args,
		key: 'data.tokensForOwner',
		defaultVal: []
	}));
};
