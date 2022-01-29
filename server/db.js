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

function logEvents(receipts_outcome, eventsPerContract) {
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
}

function appendEventToContractAndUpdateSummary(contracts, log) {
	//remove unnecessary info by creating new item to store object
	const offer = { event: log.event == "update_offer" ? 0 : 1,  maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at};

	const tokens = contracts.tokens = contracts.tokens || {};
	
	const token = tokens[log.data.token_id] = tokens[log.data.token_id] || {};
	const offers = token.offers = token.offers || [];
	
	offers.push(offer);
	updateSummary(contracts, log);
}

function updateSummary(contracts, log) {

	/*

	/// TODO

	/// for contracts and tokens
	/// track all events as "events" and track resolved only as "sales"

	/// for tokens
	/// add highest/lowest for token with { amount, updated_at }

	/// rename summary.highest_offer_sold to summary.highest/lowest

	/// MARKET SUMMARY

	Front page (market summary)

	5 Editor's Choice (we choose)
	
	5 Contracts with New Events (first 5 unique events in a market update) shift and push
	5 Contracts with Top # Events (check contract summary against this array in market summary)
	5 Contracts with Highest Sale (check contract summary against this array in market summary)
	5 Contracts with Lowest Sale (check contract summary against this array in market summary)

	Inside Contract Page (contract summary)

	5 Tokens with most new events (already have offers array so done)
	5 Tokens with most # events (already have offers array so done)
	5 Tokens with highest sale
	5 Tokens with lowest sale

	*/


	//remove unnecessary info by creating new item to store object
	const contractSummaryInfo = { amount: log.data.amount, updated_at: log.data.updated_at };
	
	//make sure the summaries for tokens and the contract are defined.
	contracts.summary = contracts.summary || { offers_len: 0, vol_traded: 0, avg_sale: "0" };
	contracts.tokens[log.data.token_id].summary = contracts.tokens[log.data.token_id].summary || { offers_len: 0, vol_traded: 0, avg_sale: "0"};
	
	//increment total offers made
	if(log.event == "update_offer") {
		//update contract summary
		contracts.summary.offers_len += 1;
		//update token summary
		contracts.tokens[log.data.token_id].summary.offers_len += 1;
	} 
	//potentially change highest and lowest offer
	else {
		//update token volume traded
		contracts.tokens[log.data.token_id].summary.vol_traded += 1;
		//update contract volume traded
		contracts.summary.vol_traded += 1;


		//perform the average sale calculations. Adding 1 to avg --> new_avg = old_avg + (val - avg)/numValues
		contracts.tokens[log.data.token_id].summary.avg_sale = 
		new BN(contracts.tokens[log.data.token_id].summary.avg_sale)
			.add((new BN(log.data.amount).sub(new BN(contracts.tokens[log.data.token_id].summary.avg_sale)))
				.div(new BN(contracts.tokens[log.data.token_id].summary.vol_traded))).toString();
		
		contracts.summary.avg_sale = 
			new BN(contracts.summary.avg_sale)
				.add((new BN(log.data.amount).sub(new BN(contracts.summary.avg_sale)))
					.div(new BN(contracts.summary.vol_traded))).toString();
		
		//make sure highest and lowest aren't undefined
		contracts.summary.highest_offer_sold = contracts.summary.highest_offer_sold || contractSummaryInfo;
		contracts.summary.lowest_offer_sold = contracts.summary.lowest_offer_sold || contractSummaryInfo;
		//check if highest offer exists
		if(log.data.amount > contracts.summary.highest_offer_sold.amount) {
			contracts.summary.highest_offer_sold = contractSummaryInfo;
		}
		
		if(log.data.amount.amount < contracts.summary.lowest_offer_sold.amount) {
			contracts.summary.lowest_offer_sold = contractSummaryInfo;
		}
	}
}


module.exports = {
	market: (db, startTimestamp) => new Promise((res, rej) => {

		console.log(`\nMARKET UPDATE: ${new Date()}\n`)

		const provider = new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`);
		const archivalProvider = new providers.JsonRpcProvider(`https://archival-rpc.${networkId}.near.org`);

		db.connect(onConnect = async (err, client, release) => {
			if (err) {
				return rej(err);
			}

			await mkdir(`../../nft-market-data/${marketId}`).catch((e) => {
				// console.log("Unable to create directory for contract ", marketId);
			});

			let currentHighestBlockTimestamp = 0;
			let marketSummary = {};
			try {
				marketSummary = JSON.parse(await readFile(`../../nft-market-data/${marketId}/marketSummary.json`));
				currentHighestBlockTimestamp = startTimestamp ? startTimestamp : marketSummary.blockstamp; 
			} catch(e) {
				console.log("Cannot read market summary for contract ", marketId);
			}
	
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

						try {
							//update future highest block timestamp
							futureHighestBlockTimestamp = result.rows[rowNum].included_in_block_timestamp > futureHighestBlockTimestamp ? result.rows[rowNum].included_in_block_timestamp : futureHighestBlockTimestamp;
						
							//has hash been analyzed already?
							if(txDone[hash]) {
								continue;
							}
								
							//get the list of receipts including logs
							const { receipts_outcome } = await getTransactionInformation(provider, result.rows[rowNum].originated_from_transaction_hash);
							logEvents(receipts_outcome, eventsPerContract)
							txDone[hash] = true;	

						} catch(e) {
							// if it's some error besides a tx doesn't exist
							if (!/doesn't exist/.test(e)) {
								return console.log("SKIPPING: ", e, result.rows[rowNum].originated_from_transaction_hash);
							}

							// try archival provider
							try {
								const { receipts_outcome } = await getTransactionInformation(archivalProvider, result.rows[rowNum].originated_from_transaction_hash);
								logEvents(receipts_outcome, eventsPerContract)
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
								appendEventToContractAndUpdateSummary(currentContractData, eventsPerContract[contractId][i]);
							}
							console.log("WRITING CONTRACT FILE");
							await writeFile(`../../nft-market-data/${marketId}/${contractId}.json`, JSON.stringify(currentContractData));
						}
					}

					if(result.rows.length >= 1000) {
						console.log("Warning. 1000 rows returned from indexer. Potential data missed.");
					}

					console.log("MARKET SUMMARY");
					marketSummary = {
						blockstamp: futureHighestBlockTimestamp,
						updated_at: Date.now(),
					}; 
					await writeFile(`../../nft-market-data/${marketId}/marketSummary.json`, JSON.stringify(marketSummary));

					console.log("PUSH TO GH");
					try {
						execSync(`cd ../../nft-market-data && git add --all && git commit -am 'update' && git push -f`);
					} catch(e) {
						console.log("ERROR:\n", e.stdout.toString(), e.stderr.toString());
					}
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

			/// TODO rewrite formattedRows as a map : { [contract_id]: { nft_metadata } }

			/// TODO check existing updated_at timestamp in contracts.json
			/// read file in and parse as json, store in memory for final step
			/// get ts
			/// multiply by 1000000 (postgres has ns timestamps)
			/// add where clause searching after timestamp

			// where emitted_at_block_timestamp > $1::bigint (postgres has ns timestamps)

			/// FINAL update file and concat new contracts

			/*

			For each contract call nft_tokens with limit: 10 and try to find metadata with valid media and store this token as an "example"


			
			*/
	
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