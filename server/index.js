const { writeFile } = require('fs/promises');
const { providers } = require('near-api-js');
const fastify = require('fastify')({ logger: true });

fastify.register(require('fastify-postgres'), {
	name: 'indexer',
	connectionString: 'postgres://public_readonly:nearprotocol@testnet.db.explorer.indexer.near.dev/testnet_explorer'
});

fastify.register(require('fastify-postgres'), {
	name: 'market',
	connectionString: 'postgres://nftmarket:nftmarket@127.0.0.1:5432/nftmarket'
});

const queries = {
	market: () => new Promise((res, rej) => {

		fastify.pg.market.connect(onConnect = (err, client, release) => {
			if (err) {
				return rej(err);
			}
	
			client.query(
				`
				select * from market_data
				`, [],
				onResult = async (err, result) => {
					release();
					if (err) {
						return rej(err);
					}
					res(result.rows);
				}
			);
		});
	}),
	contracts: () => new Promise((res, rej) => {
		const provider = new providers.JsonRpcProvider("https://rpc.testnet.near.org");

		fastify.pg.indexer.connect(onConnect = (err, client, release) => {
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

					await writeFile('../static/data.json', JSON.stringify(formattedRows));

					res(formattedRows);
				}
			);
			
		});
	})
};

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

fastify.get('/', async (request, reply) => {
	return { hello: 'world' };
});

fastify.get('/contracts', (req, reply) => {
	return queries.contracts();
});

fastify.get('/market', (req, reply) => {
	return queries.market();
});

const start = async () => {
	try {
		console.log("Hello World!");
		await fastify.listen(3000);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};
start();