const { mkdir } = require('fs/promises');
const fastify = require('fastify')({ logger: true });
const fpg = require('fastify-postgres');

const { market, contracts, reset } = require('./db');

const PORT = 3000;
const HOST = process.env.NODE_ENV === 'prod' ? '0.0.0.0' : '127.0.0.1';

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

fastify.get('/contracts/:adminCode?', (req, reply) => {
	if (req.params?.adminCode !== process.env.ADMIN_CODE) {
		return JSON.stringify({ error: 'invalid code '})
	}
	return contracts(fastify.pg.testnet);
});

fastify.get('/market/:adminCode?', (req, reply) => {
	if (req.params?.adminCode !== process.env.ADMIN_CODE) {
		return JSON.stringify({ error: 'invalid code '})
	}
	return market(fastify.pg.testnet);
});

fastify.get('/reset/:adminCode?', (req, reply) => {
	if (req.params?.adminCode !== process.env.ADMIN_CODE) {
		return JSON.stringify({ error: 'invalid code '})
	}
	return reset();
});

let processing = {
	testnet: {
		market: false,
		contracts: false,
	},
	mainnet: {
		market: false,
		contracts: false,
	},
}

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
		setInterval(() => {
			['testnet', 'mainnet'].forEach((networkId) => {
				if (!processing[networkId].market) {
					processing[networkId].market = true
					await market(fastify.pg[networkId], networkId).catch((e) => console.warn(e))
					processing[networkId].market = false
				}
				if (!processing[networkId].contracts) {
					processing[networkId].contracts = true
					await contracts(fastify.pg[networkId], networkId).catch((e) => console.warn(e))
					processing[networkId].contracts = false
				}
			})
		}, 60000) // 1m
	} else {
		await mkdir(`../dist/out`).catch((e) => {
			if (!/already exists/.test(e)) {
				console.log('Unable to create directory for development market output');
			}
		});
	}
};
start();