const test = require('ava');

const {
	getAccount, init,
	recordStart, recordStop,
	parseNearAmount,
	U128_MAX,
	initNFT,
} = require('./test-utils');
const getConfig = require("../utils/config");
const {
	contractId,
	gas,
} = getConfig();

// test.beforeEach((t) => {
// });


// Base token ID used for this set of runs. Actual token IDs will be runningTokenId + delimiter + incrementing token number.
// This ensures all tests will have unique token IDs minted to the same NFT contract.
let runningTokenId = new Date().getTime();

const nftContractId = process.env.DEPLOY_NFT_CONTRACT == "true" ? runningTokenId + "." + contractId : "tests.nft-market.testnet";

const tokens = [
	{
		contract_id: nftContractId,
		token_id: runningTokenId + ":1",
	},
	{
		contract_id: nftContractId,
		token_id: runningTokenId + ":2",
	},
];

const royaltyAccounts = [

];

let contractAccount, offerIds, offers, aliceId, bobId, tokenOwnerId, tokenOwner, alice, bob, royaltyIdOne, royaltyIdTwo;

test('users initialized', async (t) => {

	// consistent alice and bob
	aliceId = 'alice.nft-market.testnet';
	bobId = 'bob.nft-market.testnet';

	// ephemeral alice and bob based on market contract
	// aliceId = 'alice.' + contractId;
	// bobId = 'bob.' + contractId;

	contractAccount = await getAccount(contractId);

	tokenOwnerId = 'owner.' + contractId;
	tokenOwner = await getAccount(tokenOwnerId);
	console.log(tokenOwner);
	alice = await getAccount(aliceId);
	bob = await getAccount(bobId);

	//royalty accounts for NFT payouts
	royaltyIdOne = '10-percent.' + contractId;
	royaltyIdTwo = '5-percent.' + contractId;
	royaltyAccountOne = await getAccount(royaltyIdOne);
	royaltyAccountTwo = await getAccount(royaltyIdTwo);

	t.true(true);
});

test('owner remove offers', async (t) => {
	try {
		await Promise.all([
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers',
				gas
			}).catch((e) => { console.warn(e); }),
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_maker_id',
				args: { account_id: aliceId },
				gas
			}).catch((e) => { console.warn(e); }),
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_taker_id',
				args: { account_id: aliceId },
				gas
			}).catch((e) => { console.warn(e); }),
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_maker_id',
				args: { account_id: bobId },
				gas
			}).catch((e) => { console.warn(e); }),
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_taker_id',
				args: { account_id: bobId },
				gas
			}).catch((e) => { console.warn(e); }),
		]);
	} catch(e) {
		console.warn(e);
	}
	t.true(true);
});

test('alice and bob withdraw storage', async (t) => {
	try {
		await Promise.all([
			alice.functionCall({
				contractId,
				methodName: 'withdraw_offer_storage',
				gas
			}).catch((e) => { console.warn(e); }),
			bob.functionCall({
				contractId,
				methodName: 'withdraw_offer_storage',
				gas
			}).catch((e) => { console.warn(e); }),
		]);
	} catch(e) {
		console.warn(e);
	}
	t.true(true);
});

test('owner remove MORE offers', async (t) => {
	try {
		const calls = [];
		['mdl1.testnet', 'datestyone.testnet'].forEach((account_id) => {
			calls.push(contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_maker_id',
				args: { account_id },
				gas
			}).catch((e) => { console.warn(e); }),
			contractAccount.functionCall({
				contractId,
				methodName: 'remove_offers_by_taker_id',
				args: { account_id },
				gas
			}).catch((e) => { console.warn(e); }));
		});
		await Promise.all(calls);
	} catch(e) {
		console.warn(e);
	}
	t.true(true);
});
