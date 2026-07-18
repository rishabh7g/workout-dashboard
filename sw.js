const CACHE = 'workout-dashboard-v56';
const ASSETS = [
	'./',
	'./index.html',
	'./manifest.json',
	'./css/styles.css',
	'./fonts/archivo-latin-800.woff2',
	'./js/data.js',
	'./js/storage.js',
	'./js/workout.js',
	'./js/ui.js',
	'./js/main.js',
];

self.addEventListener('install', (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k.startsWith('workout-dashboard-') && k !== CACHE)
						.map((k) => caches.delete(k)),
				),
			),
	);
	self.clients.claim();
});

const NETWORK_TIMEOUT_MS = 3000;

// Absolute URLs of the precached shell. Derived from ASSETS, so the strategy
// picker below can never drift from what install() actually put in the cache.
const SHELL = new Set(ASSETS.map((a) => new URL(a, self.location.href).href));

// Start a network fetch and mirror a good response into the cache.
// Returns both promises: `network` (the response, for the caller to answer
// with) and `stored` (the cache write, for waitUntil to keep the SW alive).
// Splitting them means the caller never awaits the cache write.
function fetchAndStore(request) {
	const network = fetch(request);
	const stored = network
		.then((res) => {
			if (!res.ok || res.status === 206) return;
			const clone = res.clone();
			return caches.open(CACHE).then((c) => c.put(request, clone));
		})
		.catch(() => {});
	return { network, stored };
}

// Offline last resort: a navigation with nothing cached for it still gets the
// app shell, so a home-screen launch never shows the browser error page.
async function shellFallback(request) {
	if (request.mode !== 'navigate') return Response.error();
	const shell = (await caches.match('./')) || (await caches.match('./index.html'));
	return shell || Response.error(); // explicit, spec-clean network error
}

// Stale-while-revalidate — for the precached shell only (issue #151).
// The cache answers immediately with no network on the critical path, so a
// home-screen launch paints instantly; the revalidation refreshes the cache in
// the background for the next load.
//
// Trade-off vs the old uniform network-first (issue #5 invariant): the first
// load after a deploy serves the previous shell. That is fine because deploy
// visibility does not depend on this handler — the browser byte-compares sw.js
// itself (never routed through fetch), and a bumped CACHE installs the new SW,
// which skipWaiting()s + claims and so fires `controllerchange`, raising the
// "Updated — tap to refresh" toast in js/main.js. The user gets the new version
// on a tap instead of a 3s wait on every launch.
async function staleWhileRevalidate(e) {
	const { network, stored } = fetchAndStore(e.request);
	e.waitUntil(stored); // must be called before the first await (event still active)
	const cached = await caches.match(e.request);
	if (cached) return cached;                 // the hot path: zero network wait
	const res = await network.catch(() => undefined);
	return res || shellFallback(e.request);    // cold cache: fall back to the network
}

// Network-first with a short race — for same-origin GETs that are NOT in
// ASSETS. Unversioned/unprecached URLs have no install-time guarantee of being
// fresh, so a healthy network still wins inside 3s; a stalling one is answered
// from the cache and the background fetch updates it for next time.
//
// F06-7: GitHub Pages serves `cache-control: max-age=600`; within 10 minutes
// of a load, fetch() is satisfied from the HTTP cache. Accepted: it also
// shields flaky-wifi loads inside the window. Do not add `{cache:'no-cache'}`
// without pairing it with the 3s race (already present).
async function networkFirst(e) {
	const { network, stored } = fetchAndStore(e.request);
	e.waitUntil(stored); // must be called before the first await (event still active)
	const winner = await Promise.race([
		network.catch(() => undefined),
		new Promise((r) => setTimeout(r, NETWORK_TIMEOUT_MS)),
	]);
	if (winner) return winner;                 // healthy network: freshest response
	const cached = await caches.match(e.request);
	if (cached) return cached;                 // slow/offline: instant from cache
	const res = await network.catch(() => undefined);
	return res || shellFallback(e.request);    // uncached asset: wait the network out
}

self.addEventListener('fetch', (e) => {
	if (e.request.method !== 'GET') return;
	if (new URL(e.request.url).origin !== self.location.origin) return;
	const shell = SHELL.has(new URL(e.request.url).href);
	e.respondWith(shell ? staleWhileRevalidate(e) : networkFirst(e));
});
