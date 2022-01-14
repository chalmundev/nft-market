const fs = require('fs');
const { execSync } = require('child_process');
const nearAPI = require('near-api-js');
const {
	Near, Account, KeyPair, keyStores: { InMemoryKeyStore },
	utils: { format: { parseNearAmount } }
} = nearAPI

const networkId = 'testnet'
const nodeUrl = 'https://rpc.testnet.near.org'

const farm = async (i) => {
	execSync('rm -rf neardev && (near dev-deploy || exit 0)')

	await new Promise(r => setTimeout(r, 1000))

	const contractId = fs.readFileSync('./neardev/dev-account').toString()

	console.log(contractId)

	let credentials = JSON.parse(fs.readFileSync(
		`${process.env.HOME}/.near-credentials/${networkId}/${contractId}.json`
	))

	const keyStore = new InMemoryKeyStore();
	keyStore.setKey(
		networkId,
		contractId,
		KeyPair.fromString(credentials.private_key)
	);

	const near = new Near({
		networkId,
		nodeUrl,
		deps: { keyStore },
	});

	const { connection } = near;
	const contractAccount = new Account(connection, contractId);

	const res = await contractAccount.sendMoney('nft-market.testnet', parseNearAmount('195'))
	
	if (res?.status?.SuccessValue === '') console.log('#', i)
}

const init = async () => {
	for (let i = 0; i < 100; i++) {
		await farm(i)
		await new Promise(r => setTimeout(r, 50000 + Math.random() * 50000))
	}
}

init()