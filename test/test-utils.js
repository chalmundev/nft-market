const fs = require('fs');
const BN = require('bn.js');
const nearAPI = require('near-api-js');
const { 
	KeyPair,
	utils: { format: {
		formatNearAmount, parseNearAmount
	} }
} = nearAPI;
const { connection, keyStore, contractAccount } = require('../utils/near-utils');
const getConfig = require("../utils/config");
const {
	networkId, contractId, gas,
	NEW_ACCOUNT_AMOUNT,
} = getConfig();

const U128_MAX = '340282366920938463463374607431768211455';

const initNFT = async (newAccountId) => {
	const nftContractAccount = await createNFTAccount(newAccountId);
	await nftContractAccount.deployContract(fs.readFileSync("./out/nft-contract.wasm"));
	
	await nftContractAccount.functionCall({
		contractId: newAccountId,
		methodName: 'new_default_meta',
		args: {
			owner_id: newAccountId,
		},
		gas
	});
};

const init = async (owner_id = contractId) => {
	/// try to call new on contract, swallow e if already initialized
	try {
		

		await contractAccount.functionCall({
			contractId,
			methodName: 'new',
			args: {
				owner_id,
				market_royalty: 500,
			},
			gas
		});
	} catch (e) {
		console.log('contract already initialized');
		if (!/initialized/.test(e.toString())) {
			throw e;
		}
	}
	return contractAccount;
};

const getAccount = async (accountId, fundingAmount = NEW_ACCOUNT_AMOUNT, secret) => {
	const account = new nearAPI.Account(connection, accountId);
	try {
		let secret;
		try {
			secret = JSON.parse(fs.readFileSync(process.env.HOME + `/.near-credentials/${networkId}/${accountId}.json`, 'utf-8')).private_key;
		} catch(e) {
			if (!/no such file|does not exist/.test(e.toString())) {
				throw e;
			}
			secret = fs.readFileSync(`./neardev/${accountId}`, 'utf-8');
		}
		const newKeyPair = KeyPair.fromString(secret);
		keyStore.setKey(networkId, accountId, newKeyPair);
		await account.state();
		return account;
	} catch(e) {
		if (!/no such file|does not exist/.test(e.toString())) {
			throw e;
		}
	}
	return await createAccount(accountId, fundingAmount, secret);
};

const createAccount = async (accountId, fundingAmount = NEW_ACCOUNT_AMOUNT, secret) => {
	const newKeyPair = secret ? KeyPair.fromString(secret) : KeyPair.fromRandom('ed25519');
	fs.writeFileSync(`./neardev/${accountId}` , newKeyPair.toString(), 'utf-8');
	await contractAccount.createAccount(accountId, newKeyPair.publicKey, fundingAmount);
	keyStore.setKey(networkId, accountId, newKeyPair);
	return new nearAPI.Account(connection, accountId);
};

const createNFTAccount = async (accountId, fundingAmount = NEW_ACCOUNT_AMOUNT) => {
	const newKeyPair = KeyPair.fromRandom('ed25519');
	fs.writeFileSync(process.env.HOME + `/.near-credentials/${networkId}/${accountId}.json` , newKeyPair.toString(), 'utf-8');
	await contractAccount.createAccount(accountId, newKeyPair.publicKey, fundingAmount);
	keyStore.setKey(networkId, accountId, newKeyPair);
	return new nearAPI.Account(connection, accountId);
};

/// debugging

const getAccountBalance = (accountId) => (new nearAPI.Account(connection, accountId)).getAccountBalance();
const getAccountState = (accountId) => (new nearAPI.Account(connection, accountId)).state();
const totalDiff = (balanceBefore, balanceAfter) => formatNearAmount(new BN(balanceAfter.total).sub(new BN(balanceBefore.total)).toString(), 8);
const stateCost = (balanceBefore, balanceAfter) => formatNearAmount(new BN(balanceAfter.stateStaked).sub(new BN(balanceBefore.stateStaked)).toString(), 8);
const bytesUsed = (stateBefore, stateAfter) => parseInt(stateAfter.storage_usage, 10) - parseInt(stateBefore.storage_usage);

/// analyzing

let data = {};
const recordStart = async (accountId) => {
	data[accountId] = {
		balance: await getAccountBalance(accountId),
		state: await getAccountState(accountId),
	};
};

const recordStop = async (accountId) => {
	const before = data[accountId];
	const after = {
		balance: await getAccountBalance(accountId),
		state: await getAccountState(accountId),
	};

	console.log(
		'\n', 'Analysis:', '\n',
		'Total diff:', totalDiff(before.balance, after.balance), '\n',
		'State used:', stateCost(before.balance, after.balance), '\n',
		'Bytes used:', bytesUsed(before.state, after.state), '\n',
	);
};

module.exports = {
	init,
	getAccount,
	createAccount,
	getAccountBalance,
	getAccountState,
	stateCost,
	bytesUsed,
	recordStart,
	recordStop,
	formatNearAmount,
	parseNearAmount,
	initNFT,
	U128_MAX,
};