import { providers, networkId } from '../../utils/near-utils';

function getEvents(receipts_outcome) {
	const events = [];
	//loop through each receipt
	for (let i = 0; i < receipts_outcome.length; i++) {
		const { logs } = receipts_outcome[i].outcome;
		//loop through each log in the receipt
		for (let j = 0; j < logs.length; j++) {
			//check if the logs start with MARKET_EVENT
			if (/MARKET_EVENT/.test(logs[j])) {
				//get the current log object
				const log = JSON.parse(logs[j].replace('MARKET_EVENT:', ''));
				//if market event was logged
				if (/update_offer|resolve_offer/.test(log.event)) {
					events.push(log);
				}
			}
		}
	}
	return events;
}

export const getOfferFromHashes = async () => {
	const txHashes = window.location.href.split('?transactionHashes=')[1];
	if (!txHashes) {
		return
	}
	const [hash] = txHashes.split();
	const { receipts_outcome } = await new providers.JsonRpcProvider(`https://rpc.${networkId}.near.org`).sendJsonRpc("EXPERIMENTAL_tx_status", [
		hash,
		"foo",
	]);
	const [log] = getEvents(receipts_outcome);
	if (log) {
		return { event: log.event === 'update_offer' ? 0 : 1, maker_id: log.data.maker_id, taker_id: log.data.taker_id, amount: log.data.amount, updated_at: log.data.updated_at };
	}
}