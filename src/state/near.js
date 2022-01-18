import * as nearAPI from 'near-api-js';
const { WalletAccount } = nearAPI;
import {
	near, contractAccount, contractId
} from '../../utils/near-utils';
import { parseToken } from '../utils/token';
import getConfig from '../../utils/config';
const {
	contractId,
	gas,
	attachedDeposit: defaultAttachedDeposit
} = getConfig();
export const marketId = contractId
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
		update('', { account: null });
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
		const { account } = getState()
		account.functionCall({
			contractId,
			methodName,
			args,
			gas,
			attachedDeposit,
		})
	} catch(e) {
		console.warn(e)
	}
}

export const view = ({
	contract_id = marketId,
	methodName,
	args,
	key,
	defaultVal
}) => async ({ update }) => {
	if (defaultVal) {
		update(key, defaultVal)
	}
	try {
		let res = await contractAccount.viewFunction(
			contract_id,
			methodName,
			args
		)
		/// TODO move to utils/token.js
		if (/nft_total_supply/.test(methodName)) {
			res = parseInt(res, 10)
		}
		if (/nft_tokens/.test(methodName)) {
			res = res.map(parseToken)
		}
		if (key) {
			await update(key, res);
		}
		return res
	} catch(e) {
		console.warn(e)
	}
}

export const fetchTokens = (contract_id, args) => async ({ getState, dispatch }) => {
	const { contractId } = getState()?.data || {}
	dispatch(view({
		contract_id,
		methodName: 'nft_tokens',
		args,
		key: 'data.tokens',
		defaultVal: []
	}))
	if (contract_id === contractId) {
		return
	}
	dispatch(view({
		contract_id,
		methodName: 'nft_total_supply',
		key: 'data.supply',
		defaultVal: 0,
	}))
};