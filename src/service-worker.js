import { registerRoute } from 'workbox-routing';

if (process.env.REACT_APP_ENV === 'prod') {

	self.__WB_DISABLE_DEV_LOGS = true;
	const MAX_AGE_30 = 2592000;
	const JSON_HEADERS = new Headers({
		'content-type': 'application/json',
	});
	const CACHE_HEADERS = new Headers({
		...JSON_HEADERS,
		'cache-control': 'max-age=' + MAX_AGE_30,
	});

	/// near rpc data that never changes
	const RPC_URLS = [
		'https://rpc.near.org/',
		'https://rpc.mainnet.near.org/',
		'https://rpc.testnet.near.org/'
	];
	const RPC_METHOD_NAMES = ['nft_token', 'nft_tokens'];
	registerRoute(
		({ request: { url } }) => RPC_URLS.includes(url),
		async ({ url, request }) => {

			const json = await request.json();
			const { method_name } = json.params;

			// store in cache using url + rpc POST params as cache key for GET request
			if (RPC_METHOD_NAMES.includes(method_name)) {
				const key = url + JSON.stringify(json.params);
				return caches.match(key).then((res) => res || fetch(url, {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify(json)
				}).then((res) => {
					return caches.open('near-rpc').then((cache) => {
						cache.put(new Request(key, {
							headers: CACHE_HEADERS
						}), res.clone());
						return res;
					});
				}));
			}

			// normal rpc request
			return fetch(url, {
				method: 'POST',
				headers: JSON_HEADERS,
				body: JSON.stringify(json)
			});
		},
		'POST'
	);

}