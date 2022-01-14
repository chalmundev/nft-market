import * as nearAPI from 'near-api-js';
const { WalletAccount } = nearAPI;
import { near, contractAccount, contractId } from '../../utils/near-utils';

export const initNear = () => async ({ update }) => {

	const wallet = new WalletAccount(near);

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

export const getSupply = (contractId) => async ({ update }) => {
	let supply = 0;
	try {
		supply = parseInt(await contractAccount.viewFunction(contractId, 'nft_total_supply'), 10);
	} catch(e) {
		console.warn(e)
	}
	await update('data', { supply });
};

export const getTokens = (contractId, from_index, limit) => async ({ update }) => {
	let tokens = [];
	try {
		tokens = (await contractAccount.viewFunction(contractId, 'nft_tokens', {
			from_index,
			limit,
		})).map((token) => {

			/// TODO move to utils/token.js

			// find invalid tokens
			if (!token?.metadata?.media) return
			// swap ipfs links to cloudflare
			const media = token.metadata.media  
			console.log(media)

			const file = '/' + token.metadata.media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0]
			const ipfsHash = token.metadata.media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0]
			console.log(file)
			console.log(ipfsHash)

			if (ipfsHash) {
				token.metadata.media = 'https://cloudflare-ipfs.com/ipfs/' + ipfsHash + file
			}
			return token
		}).filter((token) => !!token)
	} catch(e) {
		console.warn(e);
	}
	await update('data', { tokens });
};