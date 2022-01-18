const test = require('ava');

const {
	getAccount, init,
	recordStart, recordStop,
	parseNearAmount,
	U128_MAX,
} = require('./test-utils');
const getConfig = require("../utils/config");
const {
	contractId,
	gas,
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

test('owner remove offers', async (t) => {
	const res = await contractAccount.functionCall({
		contractId,
		methodName: 'remove_offers',
		gas
	});
	t.is(res?.status?.SuccessValue, '');
});

test('users initialized', async (t) => {

	// consistent alice and bob
	aliceId = 'alice.nft-market.testnet';
	bobId = 'bob.nft-market.testnet';

	// ephemeral alice and bob based on market contract
	// aliceId = 'alice.' + contractId;
	// bobId = 'bob.' + contractId;

	tokenOwnerId = 'owner.' + contractId;
	tokenOwner = await getAccount(tokenOwnerId);
	alice = await getAccount(aliceId);
	bob = await getAccount(bobId);

	await alice.functionCall({
		contractId,
		methodName: 'withdraw_offer_storage',
		gas,
	})

	await bob.functionCall({
		contractId,
		methodName: 'withdraw_offer_storage',
		gas,
	})

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

	t.is(offers.length, 2);
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

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.is(offers.length, 1);
});

test('token owner approves the marketplace with auto transfer true', async (t) => {
	const msg = JSON.stringify({
		// original offer was 0.2 so this should just get accepted and auto transferred
		amount: parseNearAmount('0.1'),
		auto_transfer: true,
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

	t.is(offers.length, 0);
});

test('check if market balance increased', async (t) => {
	const balance = await contractAccount.viewFunction(
		contractId,
		'get_market_balance',
		{}
	);

	t.true(parseFloat(balance) > 1);
});

test('withdrawing market balance', async (t) => {
	await contractAccount.functionCall({
		contractId,
		methodName: 'withdraw_market_balance',
		args: {
			receiving_account: royaltyIdOne
		},
		gas,
		attachedDeposit: 0,
	});

	const balance = await contractAccount.viewFunction(
		contractId,
		'get_market_balance',
		{}
	);

	t.true(balance == '0');
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

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	t.is(offers.length, 1);
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

	t.is(offers.length, 1);
});

test('Check if offers approval ID changed was updated', async (t) => {
	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.is(offers.length, 1);
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

	t.is(offers.length, 0);
});

test('check if marketplace balance increased 2', async (t) => {
	balance = await contractAccount.viewFunction(
		contractId,
		'get_market_balance',
		{}
	);

	console.log(balance);

	t.true(balance > 1);
});

test('withdrawing market balance 2', async (t) => {
	const res = await contractAccount.functionCall({
		contractId,
		methodName: 'withdraw_market_balance',
		args: {
			receiving_account: royaltyIdOne
		},
		gas,
		attachedDeposit: 0,
	});

	balance = await contractAccount.viewFunction(
		contractId,
		'get_market_balance',
		{}
	);

	t.true(balance == 0);
});


/// alice owner


test('Alice opens token for bidding by calling nft_approve with U128_MAX', async (t) => {

	const aliceOffers = await contractAccount.viewFunction(
		contractId,
		'get_offers_by_maker_id',
		{ account_id: aliceId }
	);
	console.log('aliceOffers', aliceOffers)
	t.is(aliceOffers.length, 0);


	const res = await alice.functionCall({
		contractId,
		methodName: 'pay_offer_storage',
		args: {},
		gas,
		attachedDeposit: parseNearAmount('0.05'),
	});

	t.is(res?.status?.SuccessValue, '');

	const msg = JSON.stringify({
		amount: U128_MAX
	});

	const res3 = await alice.functionCall({
		contractId: nftContractId,
		methodName: 'nft_approve',
		args: {
			token_id: tokens[1].token_id,
			account_id: contractId,
			msg,
		},
		gas,
		attachedDeposit: parseNearAmount('0.01'),
	});

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.is(offers.length, 1);
});

test('Bob can make offer on token open for bidding', async (t) => {
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

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	/// TODO - check actual offer data in more tests
	t.is(offers[0].maker_id, bobId);
});

test('Alice accepts Bob offer', async (t) => {
	const res = await alice.functionCall({
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

	t.is(offers.length, 0);
});



/// bob owner


test('Bob opens token for bidding by calling nft_approve with fixed price', async (t) => {
	
	const res = await bob.functionCall({
		contractId,
		methodName: 'pay_offer_storage',
		args: {},
		gas,
		attachedDeposit: parseNearAmount('0.05'),
	});

	const msg = JSON.stringify({
		amount: parseNearAmount('0.2')
	});

	const res2 = await bob.functionCall({
		contractId: nftContractId,
		methodName: 'nft_approve',
		args: {
			token_id: tokens[1].token_id,
			account_id: contractId,
			msg,
		},
		gas,
		attachedDeposit: parseNearAmount('0.01'),
	});

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	t.is(offers.length, 1);

	const bobStorageAvailable = await contractAccount.viewFunction(
		contractId,
		'offer_storage_available',
		{ owner_id: bobId }
	);

	t.is(bobStorageAvailable, 0);

});

test('Alice makes lower offer and panics', async (t) => {
	try {
		const res = await alice.functionCall({
			contractId,
			methodName: 'make_offer',
			args: {
				...tokens[1],
			},
			gas,
			attachedDeposit: parseNearAmount('0.15'),
		});
		t.true(false);
	} catch (e) {
		t.true(true);
	}
});

test('Alice can make offer of exact amount and purchase AND bob has no more storage available', async (t) => {
	const res = await alice.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[1],
		},
		gas,
		attachedDeposit: parseNearAmount('0.25'), // parseNearAmount('0.2') + 0.05 N for storage
	});

	t.is(res?.status?.SuccessValue, '');

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	t.is(offers.length, 0);

	const bobStorageAvailable = await contractAccount.viewFunction(
		contractId,
		'offer_storage_available',
		{ owner_id: bobId }
	);

	console.log('bobStorageAvailable', bobStorageAvailable)

	t.is(bobStorageAvailable, 0);
});


/// Bob offer, alice owner counters


test('Bob makes an offer', async (t) => {
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

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	t.is(offers.length, 1);
});


test('Alice approves token with larger offer and replaces Bob (check bob has been refunded 1.5 N)', async (t) => {
	const res = await alice.functionCall({
		contractId,
		methodName: 'pay_offer_storage',
		args: {},
		gas,
		attachedDeposit: parseNearAmount('0.05'),
	});

	const msg = JSON.stringify({
		amount: parseNearAmount('0.2')
	});

	await recordStart(bobId);

	const res2 = await alice.functionCall({
		contractId: nftContractId,
		methodName: 'nft_approve',
		args: {
			token_id: tokens[1].token_id,
			account_id: contractId,
			msg,
		},
		gas,
		attachedDeposit: parseNearAmount('0.01'),
	});

	await recordStop(bobId);

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers);

	t.is(offers[0].maker_id, aliceId);
});
