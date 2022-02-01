const { writeFile, mkdir, readFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers } = require('near-api-js');
const BN = require('bn.js');

const getConfig = require("../utils/config");
const {
	networkId,
	contractId: marketId,
} = getConfig();

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
	return {name: res.name, symbol: res.symbol};
}

async function getTransactionInformation(provider, transactionHash) {
	return await provider.sendJsonRpc("EXPERIMENTAL_tx_status", [
		transactionHash,
		"foo",
	]);
}

function logEvents(receipts_outcome, eventsPerContract, marketSummaryData) {
	//loop through each receipt
	for(let i = 0; i < receipts_outcome.length; i++) {
		const { logs } = receipts_outcome[i].outcome;
		//loop through each log in the receipt
		for(let j = 0; j < logs.length; j++) {
			//check if the logs start with MARKET_EVENT
			if(/MARKET_EVENT/.test(logs[j])) {
				//get the current log object
				const log = JSON.parse(logs[j].replace('MARKET_EVENT:', ''));

				//if market event was logged
				if(/update_offer|resolve_offer/.test(log.event)) {
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
	if(queue.length < 50) {
		queue.push(element);
	} else {
		queue.shift();
		queue.push(element);
	}
}

function appendEventToContractAndUpdateSummary(contracts, log, marketSummaryData) {
	//remove unnecessary info by creating new item to store object
	const offer = { event: log.event == "update_offer" ? 0 : 1,  maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at};

	const tokens = contracts.tokens = contracts.tokens || {};
	
	const token = tokens[log.data.token_id] = tokens[log.data.token_id] || {};
	const offers = token.offers = token.offers || [];
	
	offers.push(offer);
	updateSummary(contracts, log, marketSummaryData);
}

function updateAverageChange(marketSummaryData, log, changeLog, updateHighest) {
	let changeArray = updateHighest == true ? marketSummaryData.high_change : marketSummaryData.low_change;
	//We need to populate the change array with unique contracts (less than 50 so far)
	if(changeArray.length < 50) {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for(var i = 0; i < changeArray.length; i++) {
			if (changeArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if(foundIndex != -1) {
			//check if we should replace the change log for the contract
			if(updateHighest == true) {
				//if we're updating the highest, check if the change is greater
				if(changeLog.change > changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeLog;
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if(changeLog.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeLog;
				}
			}
			
		} 
		//no contract was found. We should push the change log and sort the array.
		else {
			//push the change log
			changeArray.push(changeLog);
			//sort by the average
			if(updateHighest == true) {
				//if we're updating the highest, sort by change ascending
				changeArray.sort((a,b) => (a.change > b.change) ? 1 : ((b.change > a.change) ? -1 : 0));
			} else {
				//of we're updating the lowest, sort by change descending
				changeArray.sort((a,b) => (a.change < b.change) ? 1 : ((b.change < a.change) ? -1 : 0));
			}
		}
	} 
	//we filled up the high change array. Need to start replacing values.
	else {
		//check if the contract exists in the set yet
		var foundIndex = -1;
		for(var i = 0; i < changeArray.length; i++) {
			if (changeArray[i].contract_id == log.data.contract_id) {
				foundIndex = i;
				break;
			}
		}
		//if we found the contract
		if(foundIndex != -1) {
			//check if we should replace the change log for the contract
			if(updateHighest == true) {
				//if we're updating the highest, check if the change is greater
				if(changeLog.change > changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeLog;
				}
			} else {
				//if we're updating the lowest, check if the change is less than
				if(changeLog.change < changeArray[foundIndex].change) {
					changeArray[foundIndex] = changeLog;
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
			if(updateHighest == true ? changeLog.change > changeArray[0] : changeLog.change < changeArray[0]) {
				//loop through and try and find the appropriate spot to insert the change log.
				//default to index 49 in case we don't find anywhere.
				var foundSpot = 49;
				for(var i = 0; i < changeArray.length; i++) {
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
					if(updateHighest == true) {
						if (changeLog.change < changeArray[i].change) {
							foundSpot = i;
							break;
						}
					} else {
						if (changeLog.change > changeArray[i].change) {
							foundSpot = i;
							break;
						}
					}
					
				}
				//splice the array to insert and push everything back
				changeArray.splice(foundSpot, 0, changeLog);
				//shift the array over by 1
				changeArray.shift();
			}
		}
	}

	//update the market summary data depending on if we're looking at the highest or lowest change
	if(updateHighest == true) {
		marketSummaryData.high_change = changeArray;
	} else {
		marketSummaryData.low_change = changeArray;
	}
}

function updateSummary(contracts, log, marketSummaryData) {
	//remove unnecessary info by creating new item to store object
	const contractSummaryInfo = { amount: log.data.amount, updated_at: log.data.updated_at };
	
	//make sure the summaries for tokens and the contract are defined.
	contracts.summary = contracts.summary || { events: 0, sales: 0, avg_sale: "0" };
	contracts.tokens[log.data.token_id].summary = contracts.tokens[log.data.token_id].summary || { events: 0, sales: 0, avg_sale: "0"};
	console.log('contracts: ', contracts);
	
	//increment total offers made
	if(log.event == "update_offer") {
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
			HIGHEST CHANGE IN AVERAGE PRICE 
		*/
		//check if the old avg sale is 0. If it is, don't do anything.
		if (old_avg_sale.toString() != 0) {
			let changeLog = {change: new_avg_sale.div(old_avg_sale).mul(new BN("100")).toString(), contract_id: log.data.contract_id, updated_at: log.data.updated_at};
			//update the change for the highest
			updateAverageChange(marketSummaryData, log, changeLog, true);
			//update the change for the lowest
			updateAverageChange(marketSummaryData, log, changeLog, false);
		}

		console.log("HIGHEST CHANGE - ", marketSummaryData.high_change);
		console.log("LOWEST CHANGE - ", marketSummaryData.low_change);		
		
		//make sure highest and lowest aren't undefined
		contracts.summary.highest = contracts.summary.highest || contractSummaryInfo;
		contracts.summary.lowest = contracts.summary.lowest || contractSummaryInfo;
		
		//check if offer is higher than existing higher
		if(log.data.amount > contracts.summary.highest.amount) {
			contracts.summary.highest = contractSummaryInfo;
		}
		
		//check if offer is lower than existing lower
		if(log.data.amount < contracts.summary.lowest.amount) {
			contracts.summary.lowest = contractSummaryInfo;
		}

		/*
			TOKENS
		*/

		//update token sales and events for the summary
		contracts.tokens[log.data.token_id].summary.sales += 1;
		contracts.tokens[log.data.token_id].summary.events += 1;

		contracts.tokens[log.data.token_id].summary.avg_sale = 
		new BN(contracts.tokens[log.data.token_id].summary.avg_sale)
			.add((new BN(log.data.amount).sub(new BN(contracts.tokens[log.data.token_id].summary.avg_sale)))
				.div(new BN(contracts.tokens[log.data.token_id].summary.sales))).toString();

		//make sure highest and lowest aren't undefined
		contracts.tokens[log.data.token_id].summary.highest = contracts.tokens[log.data.token_id].summary.highest || contractSummaryInfo;
		contracts.tokens[log.data.token_id].summary.lowest = contracts.tokens[log.data.token_id].summary.lowest || contractSummaryInfo;
		
		//check if offer is higher than existing higher
		if(log.data.amount > contracts.tokens[log.data.token_id].summary.highest.amount) {
			contracts.tokens[log.data.token_id].summary.highest = contractSummaryInfo;
		}
		
		//check if offer is lower than existing lower
		if(log.data.amount < contracts.tokens[log.data.token_id].summary.lowest.amount) {
			contracts.tokens[log.data.token_id].summary.lowest = contractSummaryInfo;
		}
	}
}


module.exports = {
	market: (db, startTimestamp) => new Promise((res, rej) => {

		console.log(`\nMARKET UPDATE: ${new Date()}\n`);

		const provider = new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`);
		const archivalProvider = new providers.JsonRpcProvider(`https://archival-rpc.${networkId}.near.org`);

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			await mkdir(`../../nft-market-data/${marketId}`).catch((e) => {
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
				marketSummary = JSON.parse(await readFile(`../../nft-market-data/${marketId}/marketSummary.json`));
				currentHighestBlockTimestamp = startTimestamp ? startTimestamp : marketSummary.blockstamp; 
			} catch(e) {
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
				high_sales: marketSummary.high_sales || [],
				low_sales: marketSummary.low_sales || [],
			};
			
			console.log("MARKET SUMMARY - ", marketSummary);
			
			currentHighestBlockTimestamp = 0;
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
					
					if(result.rows.length == 0) {
						console.log("No receipts found since timestamp: ", currentHighestBlockTimestamp);
						return res(marketSummary);
					}

					//loop through and bulk all logs together for each contract
					for(let rowNum = 0; rowNum < result.rows.length; rowNum++) {
						const hash = result.rows[rowNum].originated_from_transaction_hash.toString();
						// if(rowNum >=150) {
						// 	break;
						// }
						try {
							//update future highest block timestamp
							futureHighestBlockTimestamp = result.rows[rowNum].included_in_block_timestamp > futureHighestBlockTimestamp ? result.rows[rowNum].included_in_block_timestamp : futureHighestBlockTimestamp;
						
							//has hash been analyzed already?
							if(txDone[hash]) {
								//console.log("Already analyzed. Continuing");
								continue;
							}
								
							//get the list of receipts including logs
							const { receipts_outcome } = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
							logEvents(receipts_outcome, eventsPerContract, marketSummaryData);
							txDone[hash] = true;	

						} catch(e) {
							// if it's some error besides a tx doesn't exist
							if (!/doesn't exist/.test(e)) {
								return console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
							}

							// try archival provider
							try {
								const { receipts_outcome } = await getTransactionInformation(archivalProvider, result.rows[rowNum].originated_from_transaction_hash);
								logEvents(receipts_outcome, eventsPerContract, marketSummaryData);
								txDone[hash] = true;	
							} catch(e) {
								console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
							}
						}
						console.log("Receipt ", rowNum+1, " of ", result.rows.length, " done.");
					}

					//loop through the logs for each contract
					for (var contractId in eventsPerContract) {
						console.log("CONTRACT: ", contractId);
						if (eventsPerContract.hasOwnProperty(contractId)) {
							let currentContractData = {};
							try {
								let rawContractData = await readFile(`../../nft-market-data/${marketId}/${contractId}.json`);
								currentContractData = startTimestamp ? {} : JSON.parse(rawContractData);
							} catch(e) {
								console.log("WARNING: unable to read contract file: ", contractId, " creating new file.");
							}
							
							//loop through each event per contract
							for(var i = 0; i < eventsPerContract[contractId].length; i++) {
								console.log("LOOPING LOG: ", i, "OF", eventsPerContract[contractId].length);
								appendEventToContractAndUpdateSummary(currentContractData, eventsPerContract[contractId][i], marketSummaryData);
							}
							console.log("WRITING CONTRACT FILE");
							await writeFile(`../../nft-market-data/${marketId}/${contractId}.json`, JSON.stringify(currentContractData));
						}
					}

					if(result.rows.length >= 5000) {
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
						high_sales: marketSummaryData.high_sales,
						low_sales: marketSummaryData.low_sales,
					}; 
					await writeFile(`../../nft-market-data/${marketId}/marketSummary.json`, JSON.stringify(marketSummary));
					console.log("PUSH TO GH");
					// try {
					// 	execSync(`cd ../../nft-market-data && git add --all && git commit -am 'update' && git push -f`);
					// } catch(e) {
					// 	console.log("ERROR:\n", e.stdout.toString(), e.stderr.toString());
					// }
					console.log("DONE");
					res(marketSummary);
				}
			);
		});
	}),
	contracts: (db) => new Promise((res, rej) => {
		const provider = new providers.JsonRpcProvider("https://rpc.testnet.near.org");

		db.connect(onConnect = (err, client, release) => {
			if (err) {
				return rej(err);
			}
	
			client.query(
				`
				select distinct
						emitted_by_contract_account_id as contract_id,
						min(emitted_at_block_timestamp) as ts
					from
						assets__non_fungible_token_events
					
					group by
						emitted_by_contract_account_id
					order by
						min(emitted_at_block_timestamp)
					desc
				`, [],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}

					let formattedRows = []; 

					//loop through each row of the result and gets metadata information from RPC
					for(let i = 0; i < result.rows.length; i++) {
						try {
							//get the symbol and name for the contract. If the provider can't call the nft_metadata function, skips contract.
							const data = await getContractMetadata(provider, result.rows[i].contract_id);
							data.contract_id = result.rows[i].contract_id; 
							data.ts = result.rows[i].ts;
							formattedRows.push(data); 
						} catch(e) {
							console.log("Skipping. Error for contract: ", result.rows[i].contract_id);
						}
						console.log("Finished ", i+1, " of ", result.rows.length);
					}

					const data = JSON.stringify({
						updated_at: Date.now(),
						contracts: formattedRows,
					});
					await writeFile('../../nft-market-data/contracts.json', data);
					execSync(`cd ../../nft-market-data && git add . && git commit -am 'update' && git push -f`);

					res(formattedRows);
				}
			);
			
		});
	})
};