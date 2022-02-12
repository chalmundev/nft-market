const { writeFile, mkdir, readFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers: _providers } = require('near-api-js');
const BN = require('bn.js');

const contracts = {
	testnet: 'v1.nft-market.testnet',
	mainnet: 'market.secondx.near',
};

const providers = {
	testnet: {
		provider: new _providers.JsonRpcProvider(`https://rpc.testnet.near.org`),
		archivalProvider: new _providers.JsonRpcProvider(`https://archival-rpc.testnet.near.org`),
	},
	mainnet: {
		provider: new _providers.JsonRpcProvider(`https://rpc.mainnet.near.org`),
		archivalProvider: new _providers.JsonRpcProvider(`https://archival-rpc.mainnet.near.org`),
	},
};

const MAX_LEN_MARKET_SUMMARIES = 100;
const PATH = process.env.NODE_ENV === 'prod' ? '../../nft-market-data' : '../dist/out';


async function getContractMedia(provider, accountId) {
	let args = { from_index: "0", limit: 10 };
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
	let exampleMedia = null;
	let exampleToken = null;

	for (var i = 0; i < res.length; i++) {
		let metadata = res[i].metadata;
		if (metadata.media && metadata.media.length != 0 && metadata.media.length < 2048) {
			if (res[i].token_id) {
				exampleMedia = metadata.media;
				exampleToken = res[i].token_id;
				break;
			}
		}
	}

	return {exampleMedia, exampleToken};
}

async function getContractMetadata(provider, accountId) {
	const rawResult = await provider.query({
		request_type: "call_function",
		account_id: accountId,
		method_name: "nft_metadata",
		args_base64: "e30=",
		finality: "optimistic",
	});

	// format result
	const res = JSON.parse(Buffer.from(rawResult.result).toString());
	return { name: res.name, symbol: res.symbol, base_uri: res.base_uri };
}

async function getTransactionInformation(provider, transactionHash) {
	return await provider.sendJsonRpc("EXPERIMENTAL_tx_status", [
		transactionHash,
		"foo",
	]);
}

function logEvents(receipts_outcome, eventsPerContract, marketSummaryData) {
	//loop through each receipt
	for (let i = 0; i < receipts_outcome.length; i++) {
		const { logs } = receipts_outcome[i].outcome;
		//loop through each log in the receipt
		for (let j = 0; j < logs.length; j++) {
			//check if the logs start with MARKET_EVENT
			if (/MARKET_EVENT/.test(logs[j])) {
				//get the current log object
				const log = JSON.parse(logs[j].replace('MARKET_EVENT:', ''));

				//if market event was logged
				if (/update_offer|resolve_offer/.test(log.event)) {
					eventsPerContract[log.data.contract_id] = eventsPerContract[log.data.contract_id] || [];
					eventsPerContract[log.data.contract_id].push(log);

					const new_offer = {
						event: log.event == "update_offer" ? 0 : 1,
						contract_id: log.data.contract_id,
						token_id: log.data.token_id,
						updated_at: log.data.updated_at,
						amount: log.data.amount,
						maker_id: log.data.maker_id,
						taker_id: log.data.taker_id,
					};
					AddToQueue(log.event == "update_offer" ? marketSummaryData.new_offers : marketSummaryData.new_sales, new_offer);
				} else {
					console.log("Log of non recognizable market event --> ", log);
				}
			}
		}
	}
}

function AddToQueue(queue, element) {
	if (queue.length >= MAX_LEN_MARKET_SUMMARIES) {
		queue.pop();
	}
	queue.unshift(element);
}

function updateChangeInAverageSummary(marketSummaryData, log, changeInAverageSummary, updateHighest) {
	let changeArray = updateHighest == true ? marketSummaryData.high_change : marketSummaryData.low_change;
	
	//We need to populate the change array with unique contracts (less than MAX_LEN_MARKET_SUMMARIES so far)
	if (changeArray.length < MAX_LEN_MARKET_SUMMARIES) {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < changeArray.length; i++) {
			if (changeArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if we should replace the change log for the contract
			if (updateHighest == true) {
				//if we're updating the highest, check if the change is greater
				if (changeInAverageSummary.change > changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if (changeInAverageSummary.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
				}
			}
		}
		//no contract was found. We should push the change log and sort the array at the end.
		else {
			//push the change log
			changeArray.push(changeInAverageSummary);
		}
	}
	//we filled up the high change array. Need to start replacing values.
	else {
		/*
			start by removing the oldest
		*/

		//sort the array by highest updated at first and lowest last. This means oldest is at the end of the array
		changeArray.sort((a, b) => b.updated_at - a.updated_at);
		//remove the last index (oldest)
		changeArray.pop();

		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < changeArray.length; i++) {
			if (changeArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if we should replace the change log for the contract
			if (updateHighest == true) {
				//if we're updating the highest, check if the change is greater
				if (changeInAverageSummary.change > changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if (changeInAverageSummary.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
				}
			}
		}
		//no contract was found. We should simply push and sort at the end
		else {
			//push the change log
			changeArray.push(changeInAverageSummary);
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		changeArray.sort((b, a) => (a.change > b.change) ? 1 : -1);
		marketSummaryData.high_change = changeArray;
	} else {
		changeArray.sort((b, a) => (a.change < b.change) ? 1 : -1);
		marketSummaryData.low_change = changeArray;
	}
}

function updateAveragePriceSummary(marketSummaryData, log, averagePriceSummary, updateHighest) {
	let existingArray = updateHighest == true ? marketSummaryData.high_sales : marketSummaryData.low_sales;
	//We need to populate the array with unique contracts (less than MAX_LEN_MARKET_SUMMARIES so far)
	if (existingArray.length < MAX_LEN_MARKET_SUMMARIES) {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if we should replace the average price log for the contract
			if (updateHighest == true) {
				//if we're updating the highest, check if our avg is greater than the existing avg
				if (new BN(averagePriceSummary.avg).gte(new BN(existingArray[foundIndex].avg))) {
					existingArray[foundIndex] = averagePriceSummary;
				}
			} else {
				//if we're updating the lowest, check if the avg is less
				if (new BN(averagePriceSummary.avg).lte(new BN(existingArray[foundIndex].avg))) {
					existingArray[foundIndex] = averagePriceSummary;
				}
			}
		}
		//no contract was found. We should push the avg price log and sort the array at the end.
		else {
			//push the avg price log
			existingArray.push(averagePriceSummary);
		}
	}
	//we filled up the average price array. Need to start replacing values.
	else {
		/*
			start by removing the oldest
		*/

		//sort the array by highest updated at first and lowest last. This means oldest is at the end of the array
		existingArray.sort((a, b) => b.updated_at - a.updated_at);
		//remove the last index (oldest)
		existingArray.pop();

		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if we should replace the average price log for the contract
			if (updateHighest == true) {
				//if we're updating the highest, check if the avg is greater
				if (new BN(averagePriceSummary.avg).gte(new BN(existingArray[foundIndex].avg))) {
					existingArray[foundIndex] = averagePriceSummary;
				}
			} else {
				//if we're updating the lowest, check if the avg is less than
				if (new BN(averagePriceSummary.avg).lte(new BN(existingArray[foundIndex].avg))) {
					existingArray[foundIndex] = averagePriceSummary;
				}
			}
		}
		//no contract was found. We should push and sort at the end
		else {
			//push the avg price log
			existingArray.push(averagePriceSummary);
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		existingArray.sort((b, a) => new BN(a.avg).gte(new BN(b.avg)) ? 1 : -1);
		marketSummaryData.high_sales = existingArray;
	} else {
		existingArray.sort((b, a) => new BN(a.avg).lte(new BN(b.avg)) ? 1 : -1);
		marketSummaryData.low_sales = existingArray;
	}
}

function updatedVolumeOrEventsSummary(marketSummaryData, log, volumeOrEventSummary, updateVolume) {
	let existingArray = updateVolume == true ? marketSummaryData.top_volume : marketSummaryData.top_events;
	//We need to populate the array with unique contracts (less than MAX_LEN_MARKET_SUMMARIES so far)
	if (existingArray.length < MAX_LEN_MARKET_SUMMARIES) {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if we should replace the summary for the contract by comparing the totals
			if (volumeOrEventSummary.total > existingArray[foundIndex].total) {
				existingArray[foundIndex] = volumeOrEventSummary;
			}
		}
		//no contract was found. We should push the summary and sort the array at the end.
		else {
			//push the summary log
			existingArray.push(volumeOrEventSummary);
		}
	}
	//we filled up the array. Need to start replacing values.
	else {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if (foundIndex != -1) {
			//check if the total is greater
			if (volumeOrEventSummary.total > existingArray[foundIndex].total) {
				existingArray[foundIndex] = volumeOrEventSummary;
			}
		}
		//no contract was found. We should replace an existing contract based on which total is higher.
		else {
			/*
				since the total price array is sorted, the last index will have the smallest total
				
				We only need to do this computation if our log has a better total at that index
			*/
			if (volumeOrEventSummary.total > existingArray[MAX_LEN_MARKET_SUMMARIES-1].total) {
				//pop the last entry off
				existingArray.pop();
				//push the summary and sort after
				existingArray.push(volumeOrEventSummary);
			}
		}
	}

	//sort the array
	existingArray.sort((b, a) => (a.total > b.total) ? 1 : -1);

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateVolume == true) {
		marketSummaryData.top_volume = existingArray;
	} else {
		marketSummaryData.top_events = existingArray;
	}
}

function updatedHighestOrLowestSales(marketSummaryData, log, saleSummary, updateHighest) {
	let existingArray = updateHighest == true ? marketSummaryData.high_sale_tokens : marketSummaryData.low_sale_tokens;
	//if the array is less than max length, check if the token exists already
	if (existingArray.length < MAX_LEN_MARKET_SUMMARIES) {
		//check if the token exists and only replace if its sale is larger
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id && existingArray[i].token_id == log.data.token_id ) {
				foundIndex = i;
				break;
			}
		}
		//token exists already
		if(foundIndex != -1) {
			if (updateHighest == true) {
				//if we're updating the highest, check if the avg is greater
				if (new BN(saleSummary.amount).gte(new BN(existingArray[foundIndex].amount))) {
					existingArray[foundIndex] = saleSummary;
				}
			} else {
				//if we're updating the lowest, check if the avg is less than
				if (new BN(saleSummary.amount).lte(new BN(existingArray[foundIndex].amount))) {
					existingArray[foundIndex] = saleSummary;
				}
			}
		} else {
			//token doesn't exist so just push the summary
			existingArray.push(saleSummary);
		}
	} else {
		/*
			start by removing the oldest
		*/

		//sort the array by highest updated at first and lowest last. This means oldest is at the end of the array
		existingArray.sort((a, b) => b.updated_at - a.updated_at);
		//remove the last index (oldest)
		existingArray.pop();

		//check if the token exists and only replace if its sale is larger
		var foundIndex = -1;
		for (var i = 0; i < existingArray.length; i++) {
			if (existingArray[i].contract_id == log.data.contract_id && existingArray[i].token_id == log.data.token_id ) {
				foundIndex = i;
				break;
			}
		}
		//token exists already
		if(foundIndex != -1) {
			if (updateHighest == true) {
				//if we're updating the highest, check if the avg is greater
				if (new BN(saleSummary.amount).gte(new BN(existingArray[foundIndex].amount))) {
					existingArray[foundIndex] = saleSummary;
				}
			} else {
				//if we're updating the lowest, check if the avg is less than
				if (new BN(saleSummary.amount).lte(new BN(existingArray[foundIndex].amount))) {
					existingArray[foundIndex] = saleSummary;
				}
			}
		} else {
			//token doesn't exist so just push the summary
			existingArray.push(saleSummary);
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		//if we're updating the highest, check if the amount is less
		existingArray.sort((b, a) => new BN(a.amount).gte(new BN(b.amount)) ? 1 : -1);
		marketSummaryData.high_sale_tokens = existingArray;
	} else {
		//if we're updating the lowest, check if the amount is less
		existingArray.sort((b, a) => new BN(a.amount).lte(new BN(b.amount)) ? 1 : -1);
		marketSummaryData.low_sale_tokens = existingArray;
	}
}

function appendEventToContractAndUpdateSummary(contracts, log, marketSummaryData) {
	//remove unnecessary info by creating new item to store object
	const offer = { event: log.event == "update_offer" ? 0 : 1, maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at };

	const tokens = contracts.tokens = contracts.tokens || {};

	const token = tokens[log.data.token_id] = tokens[log.data.token_id] || {};
	const offers = token.offers = token.offers || [];

	offers.push(offer);
	updateSummary(contracts, log, marketSummaryData);
}

function updateSummary(contracts, log, marketSummaryData) {
	//remove unnecessary info by creating new item to store object
	const contractSummaryInfo = { amount: log.data.amount, updated_at: log.data.updated_at };

	//make sure the summaries for tokens and the contract are defined.
	contracts.summary = contracts.summary || { events: 0, sales: 0, avg_sale: "0", avg_change: 0 };
	contracts.tokens[log.data.token_id].summary = contracts.tokens[log.data.token_id].summary || { events: 0, sales: 0, avg_sale: "0", avg_change: 0 };
	
	//set the event summary for the contract (increment the total since we haven't incremented it yet on the contract side)
	let eventSummary = { total: contracts.summary.events + 1, contract_id: log.data.contract_id, updated_at: log.data.updated_at };
	//since an event will be added no matter what, we should update the market summary for events
	updatedVolumeOrEventsSummary(marketSummaryData, log, eventSummary, false);

	//increment total offers made
	if (log.event == "update_offer") {
		//update contract summary
		contracts.summary.events += 1;
		//update token summary
		contracts.tokens[log.data.token_id].summary.events += 1;
	}
	//potentially change highest and lowest offer
	else {
		/*
			CONTRACTS
		*/
		//update contract sales and events
		contracts.summary.sales += 1;
		contracts.summary.events += 1;

		//get old avg sale for market summary data populating
		let old_avg_sale = new BN(contracts.summary.avg_sale);

		//perform the average sale calculations. Adding 1 to avg --> new_avg = old_avg + (val - avg)/numValues
		contracts.summary.avg_sale =
			new BN(contracts.summary.avg_sale)
				.add((new BN(log.data.amount).sub(new BN(contracts.summary.avg_sale)))
					.div(new BN(contracts.summary.sales))).toString();

		//get new avg sale for market summary data populating			
		let new_avg_sale = new BN(contracts.summary.avg_sale);

		/*
			HIGHEST / LOWEST CHANGE IN AVERAGE PRICE 
		*/
		//check if the old avg sale is 0. If it is, don't do anything.
		if (old_avg_sale.toString() != "0") {
			//set change in average
			let changeInAvg = parseFloat((parseInt(new_avg_sale.toString(), 10) / parseInt(old_avg_sale.toString(), 10) - 1).toFixed(4));

			contracts.summary.avg_change = changeInAvg;

			let changeInAverageSummary = { change: changeInAvg, contract_id: log.data.contract_id, updated_at: log.data.updated_at };
			if(changeInAvg > 0) {
				//update the highest change in average
				updateChangeInAverageSummary(marketSummaryData, log, changeInAverageSummary, true);
			} else if(changeInAvg < 0) {
				//update the lowest change in average
				updateChangeInAverageSummary(marketSummaryData, log, changeInAverageSummary, false);
			}
		}

		/*
			HIGHEST / LOWEST AVERAGE PRICE
		*/

		let averagePriceSummary = { avg: contracts.summary.avg_sale, contract_id: log.data.contract_id, updated_at: log.data.updated_at };
		//update the average price in the high_sales
		updateAveragePriceSummary(marketSummaryData, log, averagePriceSummary, true);
		//update the average price in the low_sales
		updateAveragePriceSummary(marketSummaryData, log, averagePriceSummary, false);

		/*
			VOLUME TRADED SUMMARY
		*/
		//set the event summary for the contract (don't increment the total since we already incremented it on the contract side)
		let volumeSummary = { total: contracts.summary.sales, contract_id: log.data.contract_id, updated_at: log.data.updated_at };
		//we should update the market summary for volume traded
		updatedVolumeOrEventsSummary(marketSummaryData, log, volumeSummary, true);

		//make sure highest and lowest aren't undefined
		contracts.summary.highest = contracts.summary.highest || contractSummaryInfo;
		contracts.summary.lowest = contracts.summary.lowest || contractSummaryInfo;

		//check if offer is higher than existing higher
		if (new BN(log.data.amount).gte(new BN(contracts.summary.highest.amount))) {
			contracts.summary.highest = contractSummaryInfo;
		}

		//check if offer is lower than existing lower
		if (new BN(log.data.amount).lte(new BN(contracts.summary.lowest.amount))) {
			contracts.summary.lowest = contractSummaryInfo;
		}

		/*
			TOKENS
		*/

		//update token sales and events for the summary
		contracts.tokens[log.data.token_id].summary.sales += 1;
		contracts.tokens[log.data.token_id].summary.events += 1;

		//
		let old_avg_sale_tokens = new BN(contracts.tokens[log.data.token_id].summary.avg_sale);
		contracts.tokens[log.data.token_id].summary.avg_sale =
			new BN(contracts.tokens[log.data.token_id].summary.avg_sale)
				.add((new BN(log.data.amount).sub(new BN(contracts.tokens[log.data.token_id].summary.avg_sale)))
					.div(new BN(contracts.tokens[log.data.token_id].summary.sales))).toString();

		let new_avg_sale_tokens = new BN(contracts.tokens[log.data.token_id].summary.avg_sale);

		if (old_avg_sale_tokens.toString() != 0) {
			//set change in average
			let changeInAvg = parseFloat((parseInt(new_avg_sale_tokens.toString(), 10) / parseInt(old_avg_sale_tokens.toString(), 10) - 1).toFixed(4));

			contracts.tokens[log.data.token_id].summary.avg_change = changeInAvg;
		}

		//make sure highest and lowest aren't undefined
		contracts.tokens[log.data.token_id].summary.highest = contracts.tokens[log.data.token_id].summary.highest || contractSummaryInfo;
		contracts.tokens[log.data.token_id].summary.lowest = contracts.tokens[log.data.token_id].summary.lowest || contractSummaryInfo;

		//check if offer is higher than existing higher
		if (new BN(log.data.amount).gte(new BN(contracts.tokens[log.data.token_id].summary.highest.amount))) {
			contracts.tokens[log.data.token_id].summary.highest = contractSummaryInfo;
		}

		//check if offer is lower than existing lower
		if (new BN(log.data.amount).lte(new BN(contracts.tokens[log.data.token_id].summary.lowest.amount))) {
			contracts.tokens[log.data.token_id].summary.lowest = contractSummaryInfo;
		}

		/*
			UPDATE Highest and Lowest Sales
		*/
		const saleLog = { contract_id: log.data.contract_id, token_id: log.data.token_id, maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at };
		updatedHighestOrLowestSales(marketSummaryData, log, saleLog, true);
		updatedHighestOrLowestSales(marketSummaryData, log, saleLog, false);
	}
}



///  EXPORTS



module.exports = {
	market: (db, networkId) => new Promise((res, rej) => {

		const marketId = contracts[networkId];
		const NEW_PATH = PATH + `/${networkId}`;

		console.log(`\nMARKET UPDATE: ${new Date()}\n`);

		const {provider, archivalProvider} = providers[networkId];

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			await mkdir(`${NEW_PATH}/${marketId}`).catch((e) => {
				// console.log("Unable to create directory for contract ", marketId);
			});

			console.log("MARKET ID - ", marketId);

			/*
			- 5 Editor's Choice
			- 50 Newest sales
			- 50 Newest offers
			- 50 Contracts trending up (highest positive avg change)
			- 50 Contracts trending down (highest negative avg change)
			- 50 Most highest sale contracts (highest amount avg sale amounts)
			- 50 Most lowest sale contracts (lowest amount avg sale amounts)
			- 50 Most volume contracts (most # sales)
			- 50 Most active contracts of all time (most # of offers and sales aka "events")
			- 50 Highest token sales of all time
			- 50 Lowest token sales of all time
			*/

			let currentHighestBlockTimestamp = 0;
			let marketSummary = {};

			try {
				marketSummary = JSON.parse(await readFile(`${NEW_PATH}/${marketId}/marketSummary.json`));
				currentHighestBlockTimestamp = marketSummary.blockstamp;
			} catch (e) {
				console.log("Cannot read market summary for contract ", marketId, " on network ", networkId);
			}

			let marketSummaryData = {
				new_sales: marketSummary.new_sales || [],
				new_offers: marketSummary.new_offers || [],
				high_change: marketSummary.high_change || [],
				low_change: marketSummary.low_change || [],
				high_sales: marketSummary.high_sales || [],
				low_sales: marketSummary.low_sales || [],
				top_volume: marketSummary.top_volume || [],
				top_events: marketSummary.top_events || [],
				high_sale_tokens: marketSummary.high_sale_tokens || [],
				low_sale_tokens: marketSummary.low_sale_tokens || [],
			};

			// debugging
			// currentHighestBlockTimestamp = 0;
			client.query(
				`
				SELECT *
					FROM receipts 
					where receiver_account_id = $1
					AND included_in_block_timestamp > $2::bigint
					AND receipt_kind = 'ACTION'
					ORDER BY included_in_block_timestamp
				limit 5000
				`, [marketId, currentHighestBlockTimestamp],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}

					const txDone = {};
					const eventsPerContract = {};
					let futureHighestBlockTimestamp = currentHighestBlockTimestamp;

					if (result.rows.length == 0) {
						console.log("No receipts found since timestamp: ", currentHighestBlockTimestamp, " for our marketplace: ", marketId, " on ", networkId);
						return res(marketSummary);
					} else {
						console.log("Found ", result.rows.length, " receipts since block timestamp ", currentHighestBlockTimestamp, " for our marketplace: ", marketId, " on ", networkId);
					}

					
					//loop through and bulk all logs together for each contract
					for (let rowNum = 0; rowNum < result.rows.length; rowNum++) {
						const hash = result.rows[rowNum].originated_from_transaction_hash.toString();
						// if(rowNum >=150) {
						// 	break;
						// }
						try {
							//update future highest block timestamp
							futureHighestBlockTimestamp = result.rows[rowNum].included_in_block_timestamp > futureHighestBlockTimestamp ? result.rows[rowNum].included_in_block_timestamp : futureHighestBlockTimestamp;

							//has hash been analyzed already?
							if (txDone[hash]) {
								//console.log("Already analyzed. Continuing");
								continue;
							}

							//get the list of receipts including logs
							const { receipts_outcome } = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
							logEvents(receipts_outcome, eventsPerContract, marketSummaryData);
							txDone[hash] = true;

						} catch (e) {
							// if it's some error besides a tx doesn't exist
							if (!/doesn't exist/.test(e)) {
								console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
								continue;
							}

							// try archival provider
							try {
								const { receipts_outcome } = await getTransactionInformation(archivalProvider, result.rows[rowNum].originated_from_transaction_hash);
								logEvents(receipts_outcome, eventsPerContract, marketSummaryData);
								txDone[hash] = true;
							} catch (e) {
								console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
							}
						}
						console.log("Receipt ", rowNum + 1, " of ", result.rows.length, " done.");
					}

					//await writeFile(`./data.json`, JSON.stringify(eventsPerContract));

					//loop through the logs for each contract
					for (var contractId in eventsPerContract) {
						console.log("CONTRACT: ", contractId);
						if (eventsPerContract.hasOwnProperty(contractId)) {
							let currentContractData = {};
							try {
								let rawContractData = await readFile(`${NEW_PATH}/${marketId}/${contractId}.json`);
								currentContractData = JSON.parse(rawContractData);
							} catch (e) {
								console.log("WARNING: unable to read contract file: ", contractId, " creating new file.");
							}

							//loop through each event per contract
							for (var i = 0; i < eventsPerContract[contractId].length; i++) {
								console.log("LOOPING LOG: ", i, "OF", eventsPerContract[contractId].length);
								appendEventToContractAndUpdateSummary(currentContractData, eventsPerContract[contractId][i], marketSummaryData);
							}
							console.log("WRITING CONTRACT FILE");
							await writeFile(`${NEW_PATH}/${marketId}/${contractId}.json`, JSON.stringify(currentContractData));
						}
					}

					if (result.rows.length >= 5000) {
						console.log("Warning. 5000 rows returned from indexer. Potential data missed.");
					}

					console.log("MARKET SUMMARY");
					marketSummary = {
						blockstamp: futureHighestBlockTimestamp,
						updated_at: Date.now(),
						new_sales: marketSummaryData.new_sales,
						new_offers: marketSummaryData.new_offers,
						high_change: marketSummaryData.high_change,
						low_change: marketSummaryData.low_change,
						high_sales: marketSummaryData.high_sales,
						low_sales: marketSummaryData.low_sales,
						top_volume: marketSummaryData.top_volume,
						top_events: marketSummaryData.top_events,
						high_sale_tokens: marketSummaryData.high_sale_tokens,
						low_sale_tokens: marketSummaryData.low_sale_tokens,
					};
					await writeFile(`${NEW_PATH}/${marketId}/marketSummary.json`, JSON.stringify(marketSummary));

					if (process.env.NODE_ENV === 'prod') {
						console.log("PUSH TO GH");
						try {
							execSync(`cd ${PATH} && git add --all && git commit -am 'update' && git push -f`);
						} catch (e) {
							console.log("ERROR:\n", e.stdout.toString(), e.stderr.toString());
						}
						console.log("DONE");
					}
					res(marketSummary);
				}

			);
		});
	}),

	contracts: (db, networkId) => new Promise((res, rej) => {
		const {provider} = providers[networkId];

		const NEW_PATH = PATH + `/${networkId}`;

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			let currentHighestBlockTimestamp = 0;
			let curData = {};

			try {
				curData = JSON.parse(await readFile(`${NEW_PATH}/contracts.json`));
				currentHighestBlockTimestamp = curData.blockstamp;
			} catch (e) {
				console.log("Cannot read contract summary for ", networkId, " Creating file and defaulting blockstamp to 0 - ", e);
			}

			client.query(
				`
				select distinct
						emitted_by_contract_account_id as contract_id,
						min(emitted_at_block_timestamp) as ts
					from
						assets__non_fungible_token_events
					where 
						emitted_at_block_timestamp > $1::bigint
					group by
						emitted_by_contract_account_id
					order by
						min(emitted_at_block_timestamp)
					desc
				`, [currentHighestBlockTimestamp],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}

					if (result.rows.length === 0) {
						console.log('NO NEW CONTRACTS');
						return res(curData);
					}

					let formattedRows = curData.contracts || {};

					let futureHighestBlockTimestamp = currentHighestBlockTimestamp;

					if (result.rows.length == 0) {
						console.log("No receipts found since timestamp: ", currentHighestBlockTimestamp, " for contracts on ", networkId);
						return res(curData);
					} else {
						console.log("Found ", result.rows.length, " receipts since block timestamp ", currentHighestBlockTimestamp, " for contracts on ", networkId);
					}

					//loop through each row of the result and gets metadata information from RPC
					for (let i = 0; i < result.rows.length; i++) {
						try {
							if (!formattedRows[result.rows[i].contract_id]) {
								//get the symbol and name for the contract. If the provider can't call the nft_metadata function, skips contract.
								const data = await getContractMetadata(provider, result.rows[i].contract_id);
								const mediaData = await getContractMedia(provider, result.rows[i].contract_id);

								data.ts = result.rows[i].ts;
								data.media = mediaData.exampleMedia;
								data.token = mediaData.exampleToken;

								formattedRows[result.rows[i].contract_id] = data;
							} else {
								console.log("data exists already for - ", result.rows[i].contract_id, " skipping.");
							}
						} catch (e) {
							console.log("Skipping. Error for contract: ", result.rows[i].contract_id, e);
						}
						console.log("Finished ", i + 1, " of ", result.rows.length);
						if (result.rows[i].ts > futureHighestBlockTimestamp) {
							futureHighestBlockTimestamp = result.rows[i].ts;
						}
					}

					const data = JSON.stringify({
						blockstamp: futureHighestBlockTimestamp,
						contracts: formattedRows,
					});

					await writeFile(`${NEW_PATH}/contracts.json`, data);
					if (process.env.NODE_ENV === 'prod') {
						console.log("PUSH TO GH");
						try {
							execSync(`cd ${PATH} && git add --all && git commit -am 'update' && git push -f`);
						} catch (e) {
							console.log("ERROR:\n", e.stdout.toString(), e.stderr.toString());
						}
						console.log("DONE");
					}

					res(formattedRows);
				}
			);

		});
	}),

	reset: (networkId) => new Promise((res, rej) => {
		const NEW_PATH = PATH + `/${networkId}/`;
		execSync(`cd ${NEW_PATH} && rm -rf ${marketId} contracts.json`);
		res(JSON.stringify({ reset: 'done' }));
	}),
};