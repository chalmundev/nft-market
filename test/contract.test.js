const test = require('ava');

const {
	getAccount, init,
	recordStart, recordStop,
	parseNearAmount,
} = require('./test-utils');
const getConfig = require("../utils/config");
const {
	contractId,
	gas,
	attachedDeposit,
} = getConfig();

// test.beforeEach((t) => {
// });

const nftContractId = "tests.nft-market.testnet";
// Base token ID used for this set of runs. Actual token IDs will be runningTokenId + delimiter + incrementing token number.
// This ensures all tests will have unique token IDs minted to the same NFT contract.
let runningTokenId = new Date().getTime() / 1000;
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

test('contract is deployed', async (t) => {
	contractAccount = await init();

	t.is(contractId, contractAccount.accountId);
});

test('users initialized', async (t) => {
	aliceId = 'alice.' + contractId;
	bobId = 'bob.' + contractId;
	tokenOwnerId = 'owner.' + contractId;
	tokenOwner = await getAccount(tokenOwnerId);
	alice = await getAccount(aliceId);
	bob = await getAccount(bobId);

	//royalty accounts for NFT payouts
	royaltyIdOne = '10-percent.' + contractId;
	royaltyIdTwo = '5-percent.' + contractId;
	royaltyAccountOne = await getAccount(royaltyIdOne);
	royaltyAccountTwo = await getAccount(royaltyIdTwo);

	t.true(true);
});

test('tokens minted', async (t) => {
	//royalty object to pass into mint f	unction
	let tokenRoyalty = new Object();
	tokenRoyalty[royaltyIdOne] = 1000;
	tokenRoyalty[royaltyIdTwo] = 500;

	const res1 = await tokenOwner.functionCall({
		contractId: nftContractId,
		methodName: 'nft_mint',
		args: {
			token_id: tokens[0].token_id,
			metadata: {
				title: "Testing Token ID",
				media: "https://bafybeiftczwrtyr3k7a2k4vutd3amkwsmaqyhrdzlhvpt33dyjivufqusq.ipfs.dweb.link/goteam-gif.gif",
			},
			perpetual_royalties: tokenRoyalty,
			receiver_id: tokenOwnerId,
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	const res2 = await tokenOwner.functionCall({
		contractId: nftContractId,
		methodName: 'nft_mint',
		args: {
			token_id: tokens[1].token_id,
			metadata: {
				title: "Testing Token ID",
				media: "https://bafybeiftczwrtyr3k7a2k4vutd3amkwsmaqyhrdzlhvpt33dyjivufqusq.ipfs.dweb.link/goteam-gif.gif",
			},
			perpetual_royalties: tokenRoyalty,
			receiver_id: tokenOwnerId,
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	tokens[0].taker_id = tokenOwnerId;
	tokens[1].taker_id = tokenOwnerId;

	t.is(res2?.status?.SuccessValue, '');
});

test('alice make_offer on token 1', async (t) => {

	const res = await alice.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[0],
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	t.is(res?.status?.SuccessValue, '');
});

test('bob make_offer on token 2', async (t) => {

	const res = await bob.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[1],
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	t.is(res?.status?.SuccessValue, '');
});

test('bob outbid alice on token 1 (CHECK alice + 0.2 N)', async (t) => {

	await recordStart(aliceId);

	const res = await bob.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[0],
		},
		gas,
		// outbid alice original 0.2 - 0.05 = 0.15 N bid by 0.26 N (0.05 for storage)
		attachedDeposit: parseNearAmount('0.31'),
	});

	await recordStop(aliceId);

	t.is(res?.status?.SuccessValue, '');
});

test('get offers', async (t) => {
	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length >= 1);
});

test('bob remove_offer from token 2', async (t) => {

	const offer_id = offerIds[offers.findIndex(({ maker_id }) => maker_id === bobId)];

	const res = await bob.functionCall({
		contractId,
		methodName: 'remove_offer',
		args: {
			offer_id
		},
		gas,
		attachedDeposit: 1,
	});

	t.is(res?.status?.SuccessValue, '');
});

test('get offers after bob removed', async (t) => {
	offers = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length >= 1);
});

test('token owner approves the marketplace with auto transfer true', async (t) => {
	const msg = JSON.stringify({
		auto_transfer: true
	});

	const res = await tokenOwner.functionCall({
		contractId: nftContractId,
		methodName: 'nft_approve',
		args: {
			token_id: tokens[1].token_id,
			account_id: contractId,
			msg,
		},
		gas,
		attachedDeposit: parseNearAmount("0.1"),
	});

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length == 0);
});

test('check if marketplace holdings increased', async (t) => {
	holdings = await contractAccount.viewFunction(
		contractId,
		'get_market_holdings',
		{}
	);

	t.true(parseFloat(holdings) > 1);
});

test('withdrawing market holdings', async (t) => {
	await contractAccount.functionCall({
		contractId,
		methodName: 'withdraw_market_holdings',
		args: {
			receiving_account: royaltyIdOne
		},
		gas,
		attachedDeposit: 0,
	});

	holdings = await contractAccount.viewFunction(
		contractId,
		'get_market_holdings',
		{}
	);

	t.true(holdings == '0');
});

test('Alice offers on the token Bob just bought', async (t) => {
	const res = await alice.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[1],
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	t.is(res?.status?.SuccessValue, '');
});

test('Check offers 3', async (t) => {
	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length >= 1);
});

test('Bob approves marketplace for the token Alice offered on auto transfer false', async (t) => {
	const msg = JSON.stringify({
		auto_transfer: false
	});

	const res = await bob.functionCall({
		contractId: nftContractId,
		methodName: 'nft_approve',
		args: {
			token_id: tokens[1].token_id,
			account_id: contractId,
			msg,
		},
		gas,
		attachedDeposit: parseNearAmount("0.1"),
	});

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length >= 1);
});

test('Check if offers approval ID changed.', async (t) => {
	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length >= 1);
});

test('Bob accepts Alices offer', async (t) => {
	const res = await bob.functionCall({
		contractId,
		methodName: 'accept_offer',
		args: {
			...tokens[1],
		},
		gas,
		attachedDeposit: 1,
	});

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.true(offers.length == 0);
});

test('check if marketplace holdings increased 2', async (t) => {
	holdings = await contractAccount.viewFunction(
		contractId,
		'view_market_holdings',
		{}
	);

	console.log(holdings);

	t.true(holdings > 1);
});

test('withdrawing market holdings 2', async (t) => {
	const res = await contractAccount.functionCall({
		contractId,
		methodName: 'withdraw_market_holdings',
		args: {
			receiving_account: royaltyIdOne
		},
		gas,
		attachedDeposit: 0,
	});

	holdings = await contractAccount.viewFunction(
		contractId,
		'view_market_holdings',
		{}
	);

	console.log(holdings);

	t.true(holdings == 0);
});