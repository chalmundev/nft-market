import { registerRoute } from 'workbox-routing';
import {
	NetworkFirst,
	StaleWhileRevalidate,
	CacheFirst,
} from 'workbox-strategies';
// Used for filtering matches based on status code, header, or both
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
// Used to limit entries in cache, remove entries after a certain period of time
import { ExpirationPlugin } from 'workbox-expiration';

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
						console.log('putting cache');
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

	/// Normal cache stuff from workbox

	// Cache page navigations (html) with a Network First strategy
	registerRoute(
		// Check to see if the request is a navigation to a new page
		({ request }) => request.mode === 'navigate',
		// Use a Network First caching strategy
		new NetworkFirst({
			// Put all cached files in a cache named 'pages'
			cacheName: 'pages',
			plugins: [
				// Ensure that only requests that result in a 200 status are cached
				new CacheableResponsePlugin({
					statuses: [200],
				}),
			],
		}),
	);

	// Cache CSS, JS, and Web Worker requests with a Stale While Revalidate strategy
	registerRoute(
		// Check to see if the request's destination is style for stylesheets, script for JavaScript, or worker for web worker
		({ request }) =>
			request.destination === 'style' ||
			request.destination === 'script' ||
			request.destination === 'worker',
		// Use a Stale While Revalidate caching strategy
		new StaleWhileRevalidate({
			// Put all cached files in a cache named 'assets'
			cacheName: 'assets',
			plugins: [
				// Ensure that only requests that result in a 200 status are cached
				new CacheableResponsePlugin({
					statuses: [200],
				}),
			],
		}),
	);

	// Images
	registerRoute(
		({ request }) => request.destination === 'image',
		new CacheFirst({
			cacheName: 'images',
			plugins: [
				new CacheableResponsePlugin({
					statuses: [200],
				}),
				new ExpirationPlugin({
					maxEntries: 500,
					maxAgeSeconds: MAX_AGE_30, // 30 Days
				}),
			],
		}),
	);

}