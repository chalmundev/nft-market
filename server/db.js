const { writeFile, mkdir, readFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers } = require('near-api-js');
const BN = require('bn.js');

const getConfig = require("../utils/config");
const {
	networkId,
	contractId: marketId,
} = getConfig();

const MAX_LEN_MARKET_SUMMARIES = 10;
const PATH = process.env.NODE_ENV === 'prod' ? '../../nft-market-data' : '../dist/out';

let processingMarket = false;

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

	for (var i = 0; i < res.length; i++) {
		let metadata = res[i].metadata;
		if (metadata.media && metadata.media.length != 0) {
			if (metadata.media.length < 2048) {
				exampleMedia = metadata.media;
				console.log('exampleMedia: ', exampleMedia);
				break;
			}
		}
	}

	return exampleMedia;
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
	return { name: res.name, symbol: res.symbol };
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
	if (queue.length < MAX_LEN_MARKET_SUMMARIES) {
		queue.push(element);
	} else {
		queue.shift();
		queue.push(element);
	}
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
					changeArray.sort((a, b) => (a.change > b.change) ? 1 : ((b.change > a.change) ? -1 : 0));
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if (changeInAverageSummary.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
					changeArray.sort((a, b) => (a.change < b.change) ? 1 : ((b.change < a.change) ? -1 : 0));
				}
			}
		}
		//no contract was found. We should push the change log and sort the array.
		else {
			//push the change log
			changeArray.push(changeInAverageSummary);
			//sort by the average
			if (updateHighest == true) {
				//if we're updating the highest, sort by change ascending
				changeArray.sort((a, b) => (a.change > b.change) ? 1 : ((b.change > a.change) ? -1 : 0));
			} else {
				//of we're updating the lowest, sort by change descending
				changeArray.sort((a, b) => (a.change < b.change) ? 1 : ((b.change < a.change) ? -1 : 0));
			}
		}
	}
	//we filled up the high change array. Need to start replacing values.
	else {
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
					changeArray.sort((a, b) => (a.change > b.change) ? 1 : ((b.change > a.change) ? -1 : 0));
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if (changeInAverageSummary.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeInAverageSummary;
					changeArray.sort((a, b) => (a.change < b.change) ? 1 : ((b.change < a.change) ? -1 : 0));
				}
			}
		}
		//no contract was found. We should replace an existing contract based on which change is higher.
		else {
			/*
				since the change array is sorted, index 0 will have the smallest change (if sorting highest).
				and index 0 will have the largest change (if sorting lowest) 
				
				We only need to do this computation if our change log is better than index 0
			*/
			if (updateHighest == true ? changeInAverageSummary.change > changeArray[0].change : changeInAverageSummary.change < changeArray[0].change) {
				//loop through and try and find the appropriate spot to insert the change log.
				//default to index MAX_LEN_MARKET_SUMMARIES - 1 in case we don't find anywhere.
				var foundSpot = MAX_LEN_MARKET_SUMMARIES - 1;
				for (var i = 0; i < changeArray.length; i++) {
					/*
						example: we have change of 4
						[2, 3, 5]
						=>
						[3, 4, 5] (splice and shift array)

						if we're updating the highest:
						- keep iterating until we find a change that's greater than our change. We should insert our change
						into that spot and shift the array

						if we're updating the lowest:
						- keep iterating until we find a change that's less than our change. We should then insert ours into
						that spot and shift the array

						[5, 4, 2, 1]

					*/
					if (updateHighest == true) {
						if (changeInAverageSummary.change < changeArray[i].change) {
							foundSpot = i;
							break;
						}
					} else {
						if (changeInAverageSummary.change > changeArray[i].change) {
							foundSpot = i;
							break;
						}
					}

				}
				//splice the array to insert and push everything back
				changeArray.splice(foundSpot, 0, changeInAverageSummary);
				//shift the array over by 1
				changeArray.shift();

				//sort the array
				if (updateHighest == true) {
					//if we're updating the highest, check if the change is greater
					changeArray.sort((a, b) => (a.change > b.change) ? 1 : ((b.change > a.change) ? -1 : 0));
				} else {
					//if we're updating the lowest, check if the change is less than
					changeArray.sort((a, b) => (a.change < b.change) ? 1 : ((b.change < a.change) ? -1 : 0));
				}
			}
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		marketSummaryData.high_change = changeArray;
	} else {
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
				if (averagePriceSummary.avg > existingArray[foundIndex].avg) {
					existingArray[foundIndex] = averagePriceSummary;
					existingArray.sort((a, b) => (a.avg > b.avg) ? 1 : ((b.avg > a.avg) ? -1 : 0));
				}
			} else {
				//if we're updating the lowest, check if the avg is less
				if (averagePriceSummary.avg < existingArray[foundIndex].avg) {
					existingArray[foundIndex] = averagePriceSummary;
					existingArray.sort((a, b) => (a.avg < b.avg) ? 1 : ((b.avg < a.avg) ? -1 : 0));
				}
			}

		}
		//no contract was found. We should push the avg price log and sort the array.
		else {
			//push the avg price log
			existingArray.push(averagePriceSummary);
			//sort by the average
			if (updateHighest == true) {
				//if we're updating the highest, sort by avg ascending
				existingArray.sort((a, b) => (a.avg > b.avg) ? 1 : ((b.avg > a.avg) ? -1 : 0));
			} else {
				//of we're updating the lowest, sort by avg descending
				existingArray.sort((a, b) => (a.avg < b.avg) ? 1 : ((b.avg < a.avg) ? -1 : 0));
			}
		}
	}
	//we filled up the average price array. Need to start replacing values.
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
			//check if we should replace the average price log for the contract
			if (updateHighest == true) {
				//if we're updating the highest, check if the avg is greater
				if (averagePriceSummary.avg > existingArray[foundIndex].avg) {
					existingArray[foundIndex] = averagePriceSummary;
					existingArray.sort((a, b) => (a.avg > b.avg) ? 1 : ((b.avg > a.avg) ? -1 : 0));
				}
			} else {
				//if we're updating the lowest, check if the avg is less than
				if (averagePriceSummary.avg < existingArray[foundIndex].avg) {
					existingArray[foundIndex] = averagePriceSummary;
					existingArray.sort((a, b) => (a.avg < b.avg) ? 1 : ((b.avg < a.avg) ? -1 : 0));
				}
			}
		}
		//no contract was found. We should replace an existing contract based on which avg is higher.
		else {
			/*
				since the avg price array is sorted, index 0 will have the smallest avg (if sorting highest).
				and index 0 will have the largest avg (if sorting lowest) 
				
				We only need to do this computation if our average price log has a better avg than index 0
			*/
			if (updateHighest == true ? averagePriceSummary.avg > existingArray[0].avg : averagePriceSummary.avg < existingArray[0].avg) {
				//loop through and try and find the appropriate spot to insert the avg price log.
				//default to index MAX_LEN_MARKET_SUMMARIES - 1 in case we don't find anywhere.
				var foundSpot = MAX_LEN_MARKET_SUMMARIES - 1;
				for (var i = 0; i < existingArray.length; i++) {
					/*
						example: we have avg of 4
						[2, 3, 5]
						=>
						[3, 4, 5] (splice and shift array)

						if we're updating the highest:
						- keep iterating until we find an avg that's greater than our avg. We should insert our avg
						into that spot and shift the array

						if we're updating the lowest:
						- keep iterating until we find a avg that's less than our avg. We should then insert ours into
						that spot and shift the array

						[5, 4, 2, 1]

					*/
					if (updateHighest == true) {
						if (averagePriceSummary.avg < existingArray[i].avg) {
							foundSpot = i;
							break;
						}
					} else {
						if (averagePriceSummary.avg > existingArray[i].avg) {
							foundSpot = i;
							break;
						}
					}

				}
				//splice the array to insert and push everything back
				existingArray.splice(foundSpot, 0, averagePriceSummary);
				//shift the array over by 1
				existingArray.shift();

				//sort the array
				if (updateHighest == true) {
					existingArray.sort((a, b) => (a.avg > b.avg) ? 1 : ((b.avg > a.avg) ? -1 : 0));
				} else {
					existingArray.sort((a, b) => (a.avg < b.avg) ? 1 : ((b.avg < a.avg) ? -1 : 0));
				}
			}
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		marketSummaryData.high_sales = existingArray;
	} else {
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
				existingArray.sort((a, b) => (a.total > b.total) ? 1 : ((b.total > a.total) ? -1 : 0));
			}
		}
		//no contract was found. We should push the summary and sort the array.
		else {
			//push the summary log
			existingArray.push(volumeOrEventSummary);
			//sort by the total
			existingArray.sort((a, b) => (a.total > b.total) ? 1 : ((b.total > a.total) ? -1 : 0));
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
				existingArray.sort((a, b) => (a.total > b.total) ? 1 : ((b.total > a.total) ? -1 : 0));
			}
		}
		//no contract was found. We should replace an existing contract based on which total is higher.
		else {
			/*
				since the total price array is sorted, index 0 will have the smallest total
				
				We only need to do this computation if our log has a better total than index 0
			*/
			if (volumeOrEventSummary.total > existingArray[0].total) {
				//loop through and try and find the appropriate spot to insert the avg price log.
				//default to index MAX_LEN_MARKET_SUMMARIES - 1 in case we don't find anywhere.
				var foundSpot = MAX_LEN_MARKET_SUMMARIES - 1;
				for (var i = 0; i < existingArray.length; i++) {
					/*
						example: we have total of 4
						[2, 3, 5]
						=>
						[3, 4, 5] (splice and shift array)
					*/
					if (volumeOrEventSummary.total < existingArray[i].total) {
						foundSpot = i;
						break;
					}
				}
				//splice the array to insert and push everything back
				existingArray.splice(foundSpot, 0, volumeOrEventSummary);
				//shift the array over by 1
				existingArray.shift();

				//sort the array
				existingArray.sort((a, b) => (a.total > b.total) ? 1 : ((b.total > a.total) ? -1 : 0));
			}
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateVolume == true) {
		marketSummaryData.top_volume = existingArray;
	} else {
		marketSummaryData.top_events = existingArray;
	}
}

function updatedHighestOrLowestSales(marketSummaryData, saleSummary, updateHighest) {
	let existingArray = updateHighest == true ? marketSummaryData.high_sale_tokens : marketSummaryData.low_sale_tokens;
	//if the array is less than max length, simply push and sort
	if (existingArray.length < MAX_LEN_MARKET_SUMMARIES) {
		existingArray.push(saleSummary);

		if (updateHighest == true) {
			//if we're updating the highest, check if the amount is less
			existingArray.sort((a, b) => (a.amount > b.amount) ? 1 : ((b.amount > a.amount) ? -1 : 0));
		} else {
			//if we're updating the lowest, check if the amount is less
			existingArray.sort((a, b) => (a.amount < b.amount) ? 1 : ((b.amount < a.amount) ? -1 : 0));
		}
	} else {
		/*
				since the array is sorted, index 0 will have the smallest amount (if updating highest). Index 0
				will have the largest amount if updating lowest
				
				We only need to do this computation if our log has a better total than index 0
			*/
		if (updateHighest == true ? saleSummary.amount > existingArray[0].amount : saleSummary.amount < existingArray[0].amount) {
			//loop through and try and find the appropriate spot to insert the log.
			//default to index MAX_LEN_MARKET_SUMMARIES - 1 in case we don't find anywhere.
			var foundSpot = MAX_LEN_MARKET_SUMMARIES - 1;
			for (var i = 0; i < existingArray.length; i++) {
				/*
					example: we have avg of 4
					[2, 3, 5]
					=>
					[3, 4, 5] (splice and shift array)

					if we're updating the highest:
					- keep iterating until we find an avg that's greater than our avg. We should insert our avg
					into that spot and shift the array

					if we're updating the lowest:
					- keep iterating until we find a avg that's less than our avg. We should then insert ours into
					that spot and shift the array

					[5, 4, 2, 1]

				*/
				if (updateHighest == true) {
					if (saleSummary.amount < existingArray[i].amount) {
						foundSpot = i;
						break;
					}
				} else {
					if (saleSummary.amount > existingArray[i].amount) {
						foundSpot = i;
						break;
					}
				}

			}
			//splice the array to insert and push everything back
			existingArray.splice(foundSpot, 0, saleSummary);
			//shift the array over by 1
			existingArray.shift();

			//sort the array
			if (updateHighest == true) {
				existingArray.sort((a, b) => (a.amount > b.amount) ? 1 : ((b.amount > a.amount) ? -1 : 0));
			} else {
				existingArray.sort((a, b) => (a.amount < b.amount) ? 1 : ((b.amount < a.amount) ? -1 : 0));
			}
		}

	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if (updateHighest == true) {
		marketSummaryData.high_sale_tokens = existingArray;
	} else {
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
			let changeInAvg = parseFloat((parseInt(new_avg_sale.toString(), 10) / parseInt(old_avg_sale.toString(), 10)).toFixed(4));

			contracts.summary.avg_change = changeInAvg;

			let changeInAverageSummary = { change: changeInAvg, contract_id: log.data.contract_id, updated_at: log.data.updated_at };
			//update the highest change in average
			updateChangeInAverageSummary(marketSummaryData, log, changeInAverageSummary, true);
			//update the lowest change in average
			updateChangeInAverageSummary(marketSummaryData, log, changeInAverageSummary, false);
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
		if (log.data.amount > contracts.summary.highest.amount) {
			contracts.summary.highest = contractSummaryInfo;
		}

		//check if offer is lower than existing lower
		if (log.data.amount < contracts.summary.lowest.amount) {
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
			let changeInAvg = parseFloat((parseInt(new_avg_sale_tokens.toString(), 10) / parseInt(old_avg_sale_tokens.toString(), 10)).toFixed(4));

			contracts.tokens[log.data.token_id].summary.avg_change = changeInAvg;
		}

		//make sure highest and lowest aren't undefined
		contracts.tokens[log.data.token_id].summary.highest = contracts.tokens[log.data.token_id].summary.highest || contractSummaryInfo;
		contracts.tokens[log.data.token_id].summary.lowest = contracts.tokens[log.data.token_id].summary.lowest || contractSummaryInfo;

		//check if offer is higher than existing higher
		if (log.data.amount > contracts.tokens[log.data.token_id].summary.highest.amount) {
			contracts.tokens[log.data.token_id].summary.highest = contractSummaryInfo;
		}

		//check if offer is lower than existing lower
		if (log.data.amount < contracts.tokens[log.data.token_id].summary.lowest.amount) {
			contracts.tokens[log.data.token_id].summary.lowest = contractSummaryInfo;
		}

		/*
			UPDATE Highest and Lowest Sales
		*/
		const saleLog = { contract_id: log.data.contract_id, token_id: log.data.token_id, maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at };
		updatedHighestOrLowestSales(marketSummaryData, saleLog, true);
		updatedHighestOrLowestSales(marketSummaryData, saleLog, false);
	}
}



///  EXPORTS



module.exports = {
	market: (db, startTimestamp) => new Promise((res, rej) => {

		if (processingMarket) {
			res('Update in progress');
			return;
		}
		processingMarket = true;

		console.log(`\nMARKET UPDATE: ${new Date()}\n`);

		const provider = new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`);
		const archivalProvider = new providers.JsonRpcProvider(`https://archival-rpc.${networkId}.near.org`);

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			await mkdir(`${PATH}/${marketId}`).catch((e) => {
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
				marketSummary = JSON.parse(await readFile(`${PATH}/${marketId}/marketSummary.json`));
				currentHighestBlockTimestamp = startTimestamp ? startTimestamp : marketSummary.blockstamp;
			} catch (e) {
				console.log("Cannot read market summary for contract ", marketId);
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
						console.log("No receipts found since timestamp: ", currentHighestBlockTimestamp);
						return res(marketSummary);
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
								return console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
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
								let rawContractData = await readFile(`${PATH}/${marketId}/${contractId}.json`);
								currentContractData = startTimestamp ? {} : JSON.parse(rawContractData);
							} catch (e) {
								console.log("WARNING: unable to read contract file: ", contractId, " creating new file.");
							}

							//loop through each event per contract
							for (var i = 0; i < eventsPerContract[contractId].length; i++) {
								console.log("LOOPING LOG: ", i, "OF", eventsPerContract[contractId].length);
								appendEventToContractAndUpdateSummary(currentContractData, eventsPerContract[contractId][i], marketSummaryData);
							}
							console.log("WRITING CONTRACT FILE");
							await writeFile(`${PATH}/${marketId}/${contractId}.json`, JSON.stringify(currentContractData));
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
					await writeFile(`${PATH}/${marketId}/marketSummary.json`, JSON.stringify(marketSummary));

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

					processingMarket = false;
				}

			);
		});
	}),

	contracts: (db, startTimestamp) => new Promise((res, rej) => {
		const provider = new providers.JsonRpcProvider("https://rpc.testnet.near.org");

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			let currentHighestBlockTimestamp = 0;
			let curData = {};

			try {
				curData = JSON.parse(await readFile(`${PATH}/contracts.json`));
				currentHighestBlockTimestamp = startTimestamp ? startTimestamp : curData.blockstamp;
			} catch (e) {
				console.log("Cannot read contract summary. Creating file and defaulting blockstamp to 0 - ", e);
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

					//loop through each row of the result and gets metadata information from RPC
					for (let i = 0; i < result.rows.length; i++) {
						try {
							if (!formattedRows[result.rows[i].contract_id]) {
								//get the symbol and name for the contract. If the provider can't call the nft_metadata function, skips contract.
								const data = await getContractMetadata(provider, result.rows[i].contract_id);
								const media = await getContractMedia(provider, result.rows[i].contract_id);

								data.ts = result.rows[i].ts;
								data.media = media;
								formattedRows[result.rows[i].contract_id] = data;
							} else {
								console.log("data exists already for - ", result.rows[i].contract_id, " skipping.");
							}
						} catch (e) {
							console.log("Skipping. Error for contract: ", result.rows[i].contract_id);
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

					await writeFile(`${PATH}/contracts.json`, data);
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

	reset: () => new Promise((res, rej) => {
		execSync(`cd ${PATH} && rm -rf ${marketId} contracts.json`);
		res(JSON.stringify({ reset: 'done' }));
	}),
};