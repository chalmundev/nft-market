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

const tokens = [
	{
		taker_id: 'dev-1641660698596-29666961213867',
		token_id: '1:1',
		contract_id: 'dev-1641660698596-29666961213867',
	},
	{
		taker_id: 'alice-1641660715371.dev-1641660698596-29666961213867',
		token_id: '1:1',
		contract_id: 'dev-1641660698596-29666961213867',
	},
]

let contractAccount, offerIds, offers, aliceId, bobId, alice, bob;

test('contract is deployed', async (t) => {
	contractAccount = await init();

	t.is(contractId, contractAccount.accountId);
});

test('users initialized', async (t) => {
	aliceId = 'alice.' + contractId;
	bobId = 'bob.' + contractId;
	alice = await getAccount(aliceId);
	bob = await getAccount(bobId);

	t.true(true);
});

test('alice make_offer', async (t) => {

	const res = await alice.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[0],
			offer_amount: parseNearAmount('0.1')
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	t.is(res?.status?.SuccessValue, '');
});

test('bob make_offer', async (t) => {

	const res = await bob.functionCall({
		contractId,
		methodName: 'make_offer',
		args: {
			...tokens[1],
			offer_amount: parseNearAmount('0.1')
		},
		gas,
		attachedDeposit: parseNearAmount('0.2'),
	});

	t.is(res?.status?.SuccessValue, '');
});

test('get offers', async (t) => {
	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers)

	t.true(offers.length >= 1);
});

test('bob remove_offer', async (t) => {

	const offer_id = offerIds[offers.findIndex(({ maker_id }) => maker_id === bobId)]

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

test('get offers 2', async (t) => {
	offers = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offers)

	t.true(offers.length >= 1);
});