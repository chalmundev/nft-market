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
		return JSON.stringify({ error: 'invalid code '});
	}

	if (req.query.networkId === 'testnet') {
		return contracts(fastify.pg.testnet, 'testnet');
	} else if (req.query.networkId === 'mainnet') {
		return contracts(fastify.pg.mainnet, 'mainnet');
	} else {
		return JSON.stringify({ error: 'must specify a valid network ID'});
	}
});

fastify.get('/market/:adminCode?', (req, reply) => {
	if (req.params?.adminCode !== process.env.ADMIN_CODE) {
		return JSON.stringify({ error: 'invalid code '});
	}
	if (req.query.networkId === 'testnet') {
		return market(fastify.pg.testnet, 'testnet');
	} else if (req.query.networkId === 'mainnet') {
		return market(fastify.pg.mainnet, 'mainnet');
	} else {
		return JSON.stringify({ error: 'must specify a valid network ID'});
	}
});

fastify.get('/reset/:adminCode?', (req, reply) => {
	if (req.params?.adminCode !== process.env.ADMIN_CODE) {
		return JSON.stringify({ error: 'invalid code '});
	}
	if (req.query.networkId === 'testnet') {
		return reset('testnet');
	} else if (req.query.networkId === 'mainnet') {
		return reset('mainnet');
	} else {
		return JSON.stringify({ error: 'must specify a valid network ID'});
	}
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
};

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
			['mainnet', 'testnet'].forEach((networkId) => {
				if (!processing[networkId].market) {
					processing[networkId].market = true;
					console.log(`MARKETS FOR - ${networkId}`);
					market(fastify.pg[networkId], networkId)
						.then(() => processing[networkId].market = false)
						.catch((e) => console.warn(e));
				}
				if (!processing[networkId].contracts) {
					processing[networkId].contracts = true;
					console.log(`CONTRACTS FOR - ${networkId}`);
					contracts(fastify.pg[networkId], networkId)
						.then(() => processing[networkId].contracts = false)
						.catch((e) => console.warn(e));
				}
			});
		}, 60000); // 1m
	} else {
		await mkdir(`../dist/out`).catch((e) => {
			if (!/already exists/.test(e)) {
				console.log('Unable to create directory for development market output');
			}
		});
	}
};
start();