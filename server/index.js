const fastify = require('fastify')({ logger: true })

fastify.register(require('fastify-postgres'), {
	connectionString: 'postgres://public_readonly:nearprotocol@testnet.db.explorer.indexer.near.dev/testnet_explorer'
})

const queries = {
	contracts: () => new Promise((res, rej) => {
		fastify.pg.connect(onConnect = (err, client, release) => {
			if (err) {
				return rej(err)
			}
	
			client.query(
				`
				select distinct
						emitted_by_contract_account_id as "contractId",
						min(emitted_at_block_timestamp) as "ts"
					from
						assets__non_fungible_token_events
					group by
						emitted_by_contract_account_id
					order by
						min(emitted_at_block_timestamp)
					desc
				`, [],
				onResult = (err, result) => {
					release()
					if (err) {
						return rej(err)
					}
					res(result.rows)
				}
			)
			
		})
	})
}

fastify.get('/', async (request, reply) => {
	return { hello: 'world' }
})

fastify.get('/contracts', (req, reply) => {
	return queries.contracts()
})

const start = async () => {
	try {
		await fastify.listen(3000)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}
start()