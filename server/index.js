const { mkdir } = require('fs/promises');
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

// fastify.register(fpg, {
// 	name: 'market',
// 	connectionString: 'postgres://nftmarket:nftmarket@127.0.0.1:5432/nftmarket'
// });

fastify.get('/', async (request, reply) => {
	return { hello: 'world' };
});

fastify.get('/contracts/:startTimestamp?', (req, reply) => {
	return contracts(fastify.pg.testnet, req.params.startTimestamp || false);
});

fastify.get('/market/:startTimestamp?', (req, reply) => {
	return market(fastify.pg.testnet, req.params.startTimestamp || false);
});

const start = async () => {

	try {
		console.log('Server bound to:', HOST);
		await fastify.listen(PORT, HOST);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	/// hit /market every minute
	if (process.env.NODE_ENV === 'prod') {
		setInterval(() => market(fastify.pg.testnet), 60000); // 1m
		setInterval(() => contracts(fastify.pg.testnet), 3600000); // 1h
	} else {
		await mkdir(`../dist/out`).catch((e) => {
			if (!/already exists/.test(e)) {
				console.log('Unable to create directory for development market output');
			}
		});
	}
};
start();