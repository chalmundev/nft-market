const { writeFile } = require('fs/promises');
const { execSync } = require('child_process');
const { providers } = require('near-api-js');

const getConfig = require("../utils/config");
const {
	contractId,
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

function appendEventToContract(contracts, log) {

	console.log(log)
	//remove unnecessary info by creating new item to store object
	const event = { event: log.event, ...log.data };
	const { contract_id } = event;

	const contract = contracts[contract_id] = contracts[contract_id] || {}
	const tokens = contract.tokens = contract.tokens || {}
	const events = tokens[event.token_id] = tokens[event.token_id] || []
	
	events.push(event);
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

					const contracts = {};
					const txDone = {};
					
					for(let rowNum = 0; rowNum < result.rows.length; rowNum++) {

						const hash = result.rows[rowNum].originated_from_transaction_hash.toString()
						try {
							//console.log('transactionsFinished[result.rows[rowNum].originated_from_transaction_hash: ', result.rows[rowNum].originated_from_transaction_hash.toString());
							
							//has hash been analyzed already?
							if(txDone[hash]) {
								console.log('SEEN HASH')
								continue;
							}
								
							//get the list of receipts including logs
							const { receipts_outcome } = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
							
							//loop through each receipt
							for(let i = 0; i < receipts_outcome.length; i++) {
								const { logs } = receipts_outcome[i].outcome
								
								//loop through each log in the receipt
								for(let j = 0; j < logs.length; j++) {
									//check if the logs start with MARKET_EVENT
									if(/MARKET_EVENT/.test(logs[j])) {
										//get the current log object
										const log = JSON.parse(logs[j].replace('MARKET_EVENT:', ''));

										//if market event was logged
										if(/update_offer|resolve_offer/.test(log.event)) {
											appendEventToContract(contracts, log);
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

					//console.log("length - ", Object.keys(transactionsFinished).length);

					await writeFile('../static/transactions.json', JSON.stringify(contracts));
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