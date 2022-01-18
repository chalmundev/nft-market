const fastify = require('fastify')({ logger: true });
const fpg = require('fastify-postgres');

const { market, contracts } = require('./db');

const PORT = 3000;
const HOST = process.env.ENV === 'prod' ? '0.0.0.0' : '127.0.0.1';

fastify.register(fpg, {
	name: 'mainnet',
	connectionString: 'postgres://public_readonly:nearprotocol@mainnet.db.explorer.indexer.near.dev/mainnet_explorer'
});

fastify.register(fpg, {
	name: 'testnet',
	connectionString: 'postgres://public_readonly:nearprotocol@testnet.db.explorer.indexer.near.dev/testnet_explorer'
});

fastify.register(fpg, {
	name: 'market',
	connectionString: 'postgres://nftmarket:nftmarket@127.0.0.1:5432/nftmarket'
});

fastify.get('/', async (request, reply) => {
	return { hello: 'world' };
});

fastify.get('/contracts', (req, reply) => {
	return contracts(fastify.pg.testnet);
});

fastify.get('/market/:force?', (req, reply) => {
	return market(fastify.pg.testnet, req.params.force || false);
});

const start = async () => {
	try {
		console.log('Server bound to:', HOST);
		await fastify.listen(PORT, HOST);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};
start();