const { writeFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers } = require('near-api-js');

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

function formatDataForFile(formattedData, currentLog) {
	//remove unnecessary info by creating new item to store object
	const itemToStore = new Object(); 

	itemToStore.event = currentLog.event;
	itemToStore.maker_id = currentLog.data.maker_id;
	itemToStore.taker_id = currentLog.data.taker_id;
	itemToStore.amount = currentLog.data.amount;
	itemToStore.updated_at = currentLog.data.updated_at;
	itemToStore.token_id = currentLog.data.token_id;

	//default the contract's data if it's not in file
	if (!formattedData[currentLog.data.contract_id]) {
		formattedData[currentLog.data.contract_id] = {};
		formattedData[currentLog.data.contract_id].tokens = {};
	}

	//default the current token to empty vec if it's not in file
	if(!formattedData[currentLog.data.contract_id].tokens[currentLog.data.token_id]) {
		//default token's data if it's not in the contract
		formattedData[currentLog.data.contract_id].tokens[currentLog.data.token_id] = [];
	}
	
	formattedData[currentLog.data.contract_id].tokens[currentLog.data.token_id].push(itemToStore);
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
					where receiver_account_id = 'dev-1642397812464-81288426033213'
					AND DIV(included_in_block_timestamp, 1000 * 1000) >= 1628216994837 
					AND receipt_kind = 'ACTION'
					ORDER BY included_in_block_timestamp
				limit 1000
				`, [],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}

					let formattedRows = new Object();
					let transactionsFinished = new Object();
					
					for(var rowNum = 0; rowNum < result.rows.length; rowNum++) {
						try {
							//console.log('transactionsFinished[result.rows[rowNum].originated_from_transaction_hash: ', result.rows[rowNum].originated_from_transaction_hash.toString());
							//has hash been analyzed already?
							
							if(!transactionsFinished[result.rows[rowNum].originated_from_transaction_hash.toString()]) {
								//get the list of receipts including logs
								const transactionInformation = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
								
								//loop through each receipt
								for(var i = 0; i < transactionInformation.receipts_outcome.length; i++) {						
									
									//loop through each log in the receipt
									for(var j = 0; j < transactionInformation.receipts_outcome[i].outcome.logs.length; j++) {
										//check if the logs start with MARKET_EVENT
										if(transactionInformation.receipts_outcome[i].outcome.logs[j].startsWith("MARKET_EVENT")) {
											//get the current log object
											const currentLog = JSON.parse(transactionInformation.receipts_outcome[i].outcome.logs[j].replace('MARKET_EVENT:', ''));

											//if update offer was logged
											if(currentLog.event == 'update_offer') {
												formatDataForFile(formattedRows, currentLog);
											//if resolve offer was called
											} else if (currentLog.event == 'resolve_offer') {
												formatDataForFile(formattedRows, currentLog);
											//some unrecognizable log
											} else {
												console.log("Log of non recognizable market event --> ", currentLog);
											}
										}
									}
								}		
								transactionsFinished[result.rows[rowNum].originated_from_transaction_hash.toString()] = "analyzed";					
							} else {
								//console.log("ALREADY ANALYZED - ", result.rows[rowNum].originated_from_transaction_hash);
							}
							//console.log('transactionsFinished: ', transactionsFinished);
						} catch(e) {
							console.log("Skipping. Error: ", e, result.rows[rowNum].originated_from_transaction_hash);
						}
						console.log("Finished ", rowNum+1, " of ", result.rows.length);
					}

					//console.log("length - ", Object.keys(transactionsFinished).length);

					await writeFile('../static/transactions.json', JSON.stringify(formattedRows));
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
					for(var i = 0; i < result.rows.length; i++) {
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