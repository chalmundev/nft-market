import * as nearAPI from 'near-api-js';
const { WalletAccount } = nearAPI
import { near, contractAccount, contractId } from '../../utils/near-utils';

export const initNear = () => async ({ update }) => {

	const wallet = new WalletAccount(near)

	wallet.signIn = () => {
		wallet.requestSignIn(contractId, 'Blah Blah');
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
	}

	await update('', { near, wallet, account });

};

export const getTokens = (contractId, from_index, limit) => async ({ update }) => {
	const tokens = await contractAccount.viewFunction(contractId, 'nft_tokens', {
		from_index,
		limit,
	})
	await update('data', { tokens });
}