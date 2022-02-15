const { connect, KeyPair, keyStores, utils, providers, nearAPI, Account } = require("near-api-js");
const { parseNearAmount, formatNearAmount } = require("near-api-js/lib/utils/format");
const path = require("path");
const homedir = require("os").homedir();
const fs = require('fs');
const BN = require('bn.js');
const { v4 } = require('uuid');

const getConfig = require("../utils/config");
const {
	networkId,
	contractId: marketId,
} = getConfig();

const {
	initNFT,
} = require('../test/test-utils');

const currentTime = new Date().getTime();

let near;
let config;
let bidderOne;
let bidderTwo;
let tokenOwner;
let nftContractId =  currentTime + "." + marketId;


async function getCurrentBid(provider, contract_id, token_id) {
	let args = { contract_id: contract_id, token_id: token_id };
	let base64 = btoa(JSON.stringify(args));

	const rawResult = await provider.query({
		request_type: "call_function",
		account_id: marketId,
		method_name: "get_offer",
		args_base64: base64,
		finality: "optimistic",
	});

	// format result
	const res = JSON.parse(Buffer.from(rawResult.result).toString());

	return res;
}


const getValidTokensToOffer = async (provider, accountId) => { 
	let args = { from_index: "0", limit: 30 };
	let base64 = btoa(JSON.stringify(args));

	const rawResult = await provider.query({
		request_type: "call_function",
		account_id: accountId,
		method_name: "nft_tokens",
		args_base64: base64,
		finality: "optimistic",
	});

	// format result
	const res = JSON.parse(Buffer.from(rawResult.result).toString());
	const fetchImage = async (url) => await fetch(url).then((res) => res);

	//keep trying to get random tokens until one has been found or you've tried 10 times
	let numTries = 1;
	while(numTries <= 10) {
		let randomToken = Math.floor(Math.random() * res.length);
		const imageError = false;

		//get the metadata and attempt to load the image
		let metadata = res[randomToken].metadata;
		
		try {
			//make sure the media isn't the go team image
			if(metadata.media != "https://bafybeiftczwrtyr3k7a2k4vutd3amkwsmaqyhrdzlhvpt33dyjivufqusq.ipfs.dweb.link/goteam-gif.gif") {
				const result = await fetchImage(metadata.media);
				if (result.status != 200) {
					imageError = true;
				}
			} else {
				imageError = true;
			}
		}
		catch (e) {
			imageError = true;
		}

		//there is no image error - we can break and return the image
		if(imageError == false) {
			return res[randomToken];
		}

		numTries += 1;
	}

	return null;
};

const initializeAccounts = async (initialBalance) => {
	console.log("Creating bidding accounts.");	
	const topLevelAccount = await near.account("market-user.testnet"); 

	const newBidderOneId = currentTime + "." + "market-user.testnet";
	const newBidderTwoId = currentTime + "-two." + "market-user.testnet";
	const tokenOwnerId = currentTime + "-owner." + "market-user.testnet";

	const newKeyPairOne = KeyPair.fromRandom('ed25519');
	const pubKeyOne = newKeyPairOne.getPublicKey(); 
	fs.writeFileSync(process.env.HOME + `/.near-credentials/${networkId}/${newBidderOneId}.json` , newKeyPairOne.toString(), 'utf-8');
	await topLevelAccount.createAccount(newBidderOneId, pubKeyOne, parseNearAmount(initialBalance.toString()));
	await near.config.keyStore.setKey(networkId, newBidderOneId, newKeyPairOne);
	bidderOne = await near.account(newBidderOneId);
	console.log("Account 1 Created.");

	const newKeyPairTwo = KeyPair.fromRandom('ed25519');
	const pubKeyTwo = newKeyPairTwo.getPublicKey(); 
	fs.writeFileSync(process.env.HOME + `/.near-credentials/${networkId}/${newBidderTwoId}.json` , newKeyPairTwo.toString(), 'utf-8');
	await topLevelAccount.createAccount(newBidderTwoId, pubKeyTwo, parseNearAmount(initialBalance.toString()));
	await near.config.keyStore.setKey(networkId, newBidderTwoId, newKeyPairTwo);
	bidderTwo = await near.account(newBidderTwoId);

	console.log("Account 2 Created.");

	const ownerKeyPair = KeyPair.fromRandom('ed25519');
	const ownerPubKey = ownerKeyPair.getPublicKey(); 
	fs.writeFileSync(process.env.HOME + `/.near-credentials/${networkId}/${tokenOwnerId}.json` , ownerKeyPair.toString(), 'utf-8');
	await topLevelAccount.createAccount(tokenOwnerId, ownerPubKey, parseNearAmount(initialBalance.toString()));
	await near.config.keyStore.setKey(networkId, tokenOwnerId, ownerKeyPair);
	tokenOwner = await near.account(tokenOwnerId);

	console.log("Account 3 Created. Done.");
};

const initiateNear = async () => {
	const CREDENTIALS_DIR = ".near-credentials";

	const credentialsPath = (await path).join(homedir, CREDENTIALS_DIR);
	(await path).join;
	const keyStore = new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);

	config = {
		networkId: "testnet",
		keyStore,
		nodeUrl: "https://rpc.testnet.near.org",
		walletUrl: "https://wallet.testnet.near.org",
		helperUrl: "https://helper.testnet.near.org",
		explorerUrl: "https://explorer.testnet.near.org",
	};

	near = await connect(config);
};

const startBids = async (provider, tokenList) => {
	for(var i = 0; i < tokenList.length; i++) {
		const currentIter = Math.floor(Math.random() * 11);
		//30% chance to start a bidding war on the token
		if(currentIter > 7) {
			console.log("BIDDING WAR");
			biddingWar(provider, tokenList[i].contract_id, tokenList[i].token_id);
		//50% chance to start a semi bidding war
		} else if (currentIter > 5) {
			console.log("SIMPLE OUTBID");
			simpleOutbid(provider, tokenList[i].contract_id, tokenList[i].token_id);
		} else {
			console.log("STARTING REGULAR BID");
			//add variety as to who is making regular bids.
			//regular price is random number from 0.1 --> 5.01 (2 decimals)
			let currentBidPrice; 
			try {
				let priceData = await getCurrentBid(provider, tokenList[i].contract_id, tokenList[i].token_id);
				currentBidPrice = parseFloat(formatNearAmount(new BN(priceData[1].amount), 2));
			} catch(e) {
				//console.log(e);
				currentBidPrice = 0;
			}

			console.log("Current price existing - ", currentBidPrice, " for ", tokenList[i].contract_id, " and ", tokenList[i].token_id);
			const regularBidPrice = Math.round( (Math.random() * 5 + 1) * 100) / 100 + currentBidPrice;
			if(i % 2 == 0 ) {
				await makeBid(bidderOne, tokenList[i].contract_id, tokenList[i].token_id, regularBidPrice);
			} else {
				await makeBid(bidderTwo, tokenList[i].contract_id, tokenList[i].token_id, regularBidPrice);
			}
			console.log("DONE");
		}
	}
};

const biddingWar = async (provider, contract_id, token_id) => {
	//length from 4 to 10
	const lengthOfWar = Math.floor(Math.random() * 7) + 4;
	console.log('Starting Bidding War Lasting: ', lengthOfWar, " Bids");

	let currentBidPrice; 
	try {
		let priceData = await getCurrentBid(provider, contract_id, token_id);
		currentBidPrice = parseFloat(formatNearAmount(new BN(priceData[1].amount), 2));
	} catch(e) {
		//console.log(e);
		currentBidPrice = 0;
	}

	console.log("Current price existing - ", currentBidPrice, " for ", contract_id, " and ", token_id);

	//starting price from 0.1 --> 2.01. 2 decimal places. 
	let price = Math.round( (Math.random() * 2 + 1) * 100) / 100 + currentBidPrice;
	for(var i = 0; i < lengthOfWar; i++) {
		console.log("Bid ", i, " of ", lengthOfWar);
		//if number is even
		if(i % 2 == 0 ) {
			await makeBid(bidderOne, contract_id, token_id, price);
		} else {
			await makeBid(bidderTwo, contract_id, token_id, price);
		}
		//get random new price offset. Number between 0.1 --> 1.01. 2 decimal places
		const newPriceOffset = Math.round( (Math.random() + 1) * 100) / 100;
		price = price + newPriceOffset; 
	}
	console.log("Done.");
};

const simpleOutbid = async (provider, contract_id, token_id) => {
	console.log('Starting simple outbid scenario. ');

	let currentBidPrice; 
	try {
		let priceData = await getCurrentBid(provider, contract_id, token_id);
		currentBidPrice = parseFloat(formatNearAmount(new BN(priceData[1].amount), 2));
	} catch(e) {
		//console.log(e);
		currentBidPrice = 0;
	}	

	console.log("Current price existing - ", currentBidPrice, " for ", contract_id, " and ", token_id);

	//starting price from 0.1 --> 2.01. 2 decimal places. 
	let price = Math.round( (Math.random() * 2 + 1) * 100) / 100 + currentBidPrice;

	//make first bid
	await makeBid(bidderOne, contract_id, token_id, price);
	/*
		get random new price offset. This should be much larger than bidding war offsets.
		Number between 0.1 --> 5.01. 2 decimal places
	*/
	const newPriceOffset = Math.round( (Math.random() * 5 + 1) * 100) / 100;
	price = price + newPriceOffset; 
	
	//outbid first bidder
	await makeBid(bidderTwo, contract_id, token_id, price);
	console.log("Done.");
};

const makeBid = async (account, contract_id, token_id, price) => {
	console.log("Offering on ", contract_id, " token ", token_id, " price - ", price);
	await account.functionCall({
		contractId: marketId,
		methodName: 'make_offer',
		args: {
			contract_id, 
			token_id
		},
		gas: "200000000000000",
		attachedDeposit: parseNearAmount(price.toString()),
	});
};

const mintAndAcceptTokens = async (provider) => {
	console.log("Creating NFT contract");
	const nftContractMetadata = {
		spec: "nft-1.0.0",
		name: "NFT Tutorial " + currentTime,
		symbol: "NFT"
	};
	await initNFT(nftContractId, nftContractMetadata);
	const minter = await near.account(marketId);

	let tokenList = [];
	//mint 15 random NFTs on the contract

	const res1 = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=tZABeKQjaI8sVMmlm1RRWBLmb4YiBRR8&q=renders`);
	const json1 = await res1.json();
	const totalCount = json1. pagination.total_count;

	const offset = Math.floor(Math.random() * Number(totalCount));
	const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=tZABeKQjaI8sVMmlm1RRWBLmb4YiBRR8&q=renders&limit=15&offset=${offset}`);
	const json = await res.json();
	
	console.log('json: ', json);
	console.log('json.data.length: ', json.data.length);
	console.log('offset: ', offset);
	console.log('totalCount: ', totalCount);
	for(var i = 0; i < json.data.length; i++) {
		console.log("Minting ", i , " of 15");
		
		const title = json.data.title;
		const media = json.data[i].images.downsized.url;
		console.log('media: ', media);
		
		//royalty object to pass into mint function
		const token_id = v4();

		await minter.functionCall({
			contractId: nftContractId,
			methodName: 'nft_mint',
			args: {
				token_id,
				metadata: {
					title,
					media
				},
				receiver_id: tokenOwner.accountId,
			},
			gas: "200000000000000",
			attachedDeposit: parseNearAmount('0.2'),
		});
		tokenList.push({contract_id: nftContractId, token_id: token_id});
	}

	console.log("Starting bids");
	await startBids(provider, tokenList);

	for(var i = 0; i < tokenList.length; i++) {
		console.log("Accepting offers ", i, " of ", tokenList.length);

		const msg = JSON.stringify({
			auto_transfer: true
		});
	
		await tokenOwner.functionCall({
			contractId: nftContractId,
			methodName: 'nft_approve',
			args: {
				token_id: tokenList[i].token_id,
				account_id: marketId,
				msg,
			},
			gas: "200000000000000",
			attachedDeposit: parseNearAmount("0.1"),
		});
	}
};

async function zombie() {
	await initiateNear();
	const initialBalance = "200";
	await initializeAccounts(initialBalance);
	const provider = new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`);

	const rawContractSummary = "https://raw.githubusercontent.com/chalmundev/nft-market-data/main/testnet/contracts.json";
	const res = await fetch(rawContractSummary);
	const contractSummary = await res.json();

	const contracts = Object.keys(contractSummary.contracts);

	let listOfTokens = [];
	// for(var i = 0; i < 15; i++) {
	// 	let mediaFound = false;
	// 	while(mediaFound == false) {
	// 		const randomContract = contracts[Math.floor(Math.random() * contracts.length)];
	// 		//console.log("Check valid token for - ", randomContract, " on iter ", i, " of 15");

	// 		//make sure its not a dev contract
	// 		if(randomContract.endsWith("." + networkId)) {
	// 			try {
	// 				const validToken = await getValidTokensToOffer(provider, randomContract);
	// 				if(validToken != null && 'token_id' in validToken) {
	// 					listOfTokens.push({token_id: validToken.token_id, contract_id: randomContract, media: validToken.metadata.media});
	// 					console.log("Found Token.");
	// 					mediaFound = true;
	// 				} else {
	// 					console.log("No Token Found.");
	// 				}
	// 			} catch(e) {
	// 				console.log("No Token Found.");
	// 			}
	// 		}

	// 		console.log("Iter ", i , " of 15");	
	// 	}
	// }

	//await startBids(provider, listOfTokens);
	await mintAndAcceptTokens(provider);
}

zombie();
//mintAndAcceptTokens();