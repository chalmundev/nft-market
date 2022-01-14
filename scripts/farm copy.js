const fs = require('fs');
const { execSync } = require('child_process');
const { parseNearAmount } = require('near-api-js/lib/utils/format');
const { InMemoryKeyStore } = require('near-api-js/lib/key_stores');
const { Near, Account, KeyPair } = require('near-api-js');

const networkId = 'testnet'
const nodeUrl = 'https://rpc.testnet.near.org'

/// TODO Sock5 Tor this
/// await web_1.fetchJson(`${this.helperUrl}/account`, JSON.stringify({ newAccountId, newAccountPublicKey: publicKey.toString() }));

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

	const res = await contractAccount.sendMoney('snft.testnet', parseNearAmount('195'))
	
	if (res?.status?.SuccessValue === '') console.log('farm #', i)

}

const init = async () => {
	for (let i = 0; i < 100; i++) {
		await farm(i)
		await new Promise(r => setTimeout(r, 100000))
	}
}

init()