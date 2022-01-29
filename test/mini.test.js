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

	[offerIds, offers] = await contractAccount.viewFunction(
		contractId,
		'get_offers',
		{}
	);

	console.log(offerIds, offers);

	const aliceOffers = await contractAccount.viewFunction(
		contractId,
		'get_offers_by_maker_id',
		{ account_id: aliceId }
	);
	console.log('aliceOffers', aliceOffers);
	t.is(aliceOffers[0], 0);

	const aliceOffersTaker = await contractAccount.viewFunction(
		contractId,
		'get_offers_by_taker_id',
		{ account_id: aliceId }
	);
	console.log('aliceOffersTaker', aliceOffersTaker);
	t.is(aliceOffers[0], 0);
});
