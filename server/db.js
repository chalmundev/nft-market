const { writeFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers } = require('near-api-js');


const getConfig = require("../utils/config");
const { readFile, readFileSync } = require('fs');
const {
	contractId,
	transactionsFile,
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

function appendEventToContractAndUpdateSummary(contracts, log) {
	//remove unnecessary info by creating new item to store object
	const offer = { event: log.event == "update_offer" ? "0" : "1",  maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at};

	const tokens = contracts.tokens = contracts.tokens || {};
	const token = tokens[log.data.token_id] = tokens[log.data.token_id] || {};
	const offers = token.offers = token.offers || [];
	
	offers.push(offer);
	updateSummary(contracts, log);
}

function updateSummary(contracts, log) {
	//remove unnecessary info by creating new item to store object
	const contractSummaryInfo = { amount: log.data.amount, updated_at: log.data.updated_at };
	
	//make sure the summaries for tokens and the contract are defined.
	contracts.summary = contracts.summary || {};
	contracts.tokens[log.data.token_id].summary = contracts.tokens[log.data.token_id].summary || {};
	
	//increment total offers made
	if(log.event == "update_offer") {
		//update contract summary
		contracts.summary.offers_len ? contracts.summary.offers_len += 1 : contracts.summary.offers_len = 1;
		//update token summary
		contracts.tokens[log.data.token_id].summary.offers_len ? contracts.tokens[log.data.token_id].summary.offers_len += 1 : contracts.tokens[log.data.token_id].summary.offers_len = 1;
	} 
	//potentially change highest and lowest offer
	else {
		//check if highest offer exists
		if(contracts.summary.highest_offer_sold) {
			if(log.data.amount > contracts.summary.highest_offer_sold.amount) {
				contracts.summary.highest_offer_sold = contractSummaryInfo;
			}
		} 
		//first offer sold - set it to highest offer sold.
		else {
			contracts.summary.highest_offer_sold = contractSummaryInfo;
		}

		if(contracts.summary.lowest_offer_sold) {
			if(log.data.amount.amount < contracts.summary.lowest_offer_sold.amount) {
				contracts.summary.lowest_offer_sold = contractSummaryInfo;
			}
		}
		//first offer sold - set it to lowest offer sold
		else {
			contracts.summary.lowest_offer_sold = contractSummaryInfo;
		}
	}
}


module.exports = {
	market: (db, near) => new Promise((res, rej) => {
		const provider = new providers.JsonRpcProvider("https://rpc.testnet.near.org");

		db.connect(onConnect = (err, client, release) => {
			if (err) {
				return rej(err);
			}
	
			client.query(
				`
				SELECT *
					FROM receipts 
					where receiver_account_id = $1
					AND DIV(included_in_block_timestamp, 1000 * 1000) >= 1628216994837 
					AND receipt_kind = 'ACTION'
					ORDER BY included_in_block_timestamp
				limit 1000
				`, [contractId],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}

					const txDone = {};
					const eventsPerContract = {};
					
					//loop through and bulk all logs together for each contract
					for(let rowNum = 0; rowNum < result.rows.length; rowNum++) {

						const hash = result.rows[rowNum].originated_from_transaction_hash.toString();
						try {
							//console.log('transactionsFinished[result.rows[rowNum].originated_from_transaction_hash: ', result.rows[rowNum].originated_from_transaction_hash.toString());
							
							//has hash been analyzed already?
							if(txDone[hash]) {
								console.log('SEEN HASH');
								continue;
							}
								
							//get the list of receipts including logs
							const { receipts_outcome } = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
							
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
										} else {
											console.log("Log of non recognizable market event --> ", log);
										}
									}
								}
							}		

							txDone[hash] = true;	

						} catch(e) {
							console.log("Skipping. Error: ", e, result.rows[rowNum].originated_from_transaction_hash);
						}
						console.log("Finished ", rowNum+1, " of ", result.rows.length);
					}

					//loop through the logs for each contract
					for (var key in eventsPerContract) {
						console.log("looping through keys - ", key);
						if (eventsPerContract.hasOwnProperty(key)) {
							console.log("READING DATA");
							let currentContractData = {};
							try {
								let rawContractData = readFileSync(`../static/${key}.json`);
								currentContractData = JSON.parse(rawContractData);
							} catch(e) {
								console.log("Unable to read file for contract: ", key);
							}
							
							//loop through each event per contract
							for(var i = 0; i < eventsPerContract[key].length; i++) {
								console.log("looping through each log for ", key, " - ", i);
								appendEventToContractAndUpdateSummary(currentContractData, eventsPerContract[key][i]);
							}

							await writeFile(`../static/${key}.json`, JSON.stringify(currentContractData));
						}
					}

					if(result.rows.length >= 1000) {
						console.log("Warning. 1000 rows returned from indexer. Potential data missed.");
					}

					//console.log("length - ", Object.keys(transactionsFinished).length);

					
					res(result.rows);
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

					const data = JSON.stringify(formattedRows);
					await writeFile('../static/data.json', data);
					await writeFile('../../nft-market-data/contracts.json', data);
					execSync(`cd ../../nft-market-data && git add . && git commit -am 'update' && git push`);

					res(formattedRows);
				}
			);
			
		});
	})
};