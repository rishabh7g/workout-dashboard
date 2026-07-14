const CACHE = 'workout-dashboard-v49';
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

self.addEventListener('fetch', (e) => {
	// Network-first with a short race: healthy network wins inside 3s so a
	// fresh deploy still shows up on the very next load (issue #5 invariant).
	// On a stalling network the cache answers in ≤3s and the background fetch
	// still updates the cache, so the deploy lands one load later.
	//
	// F06-7: GitHub Pages serves `cache-control: max-age=600`; within 10 minutes
	// of a load, fetch() is satisfied from the HTTP cache, so "deploy visible on
	// next load" has a ≤10-min window by design. Accepted: it also shields
	// flaky-wifi loads inside the window. Do not add `{cache:'no-cache'}` without
	// pairing it with the 3s race (already present).
	if (e.request.method !== 'GET') return;
	if (new URL(e.request.url).origin !== self.location.origin) return;
	e.respondWith((async () => {
		const network = fetch(e.request).then((res) => {
			if (res.ok && res.status !== 206) {
				const clone = res.clone();
				e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {}));
			}
			return res;
		});
		const winner = await Promise.race([
			network.catch(() => undefined),
			new Promise((r) => setTimeout(r, NETWORK_TIMEOUT_MS)),
		]);
		if (winner) return winner;                 // healthy network: deploy visible THIS load
		const cached = await caches.match(e.request);
		if (cached) return cached;                 // slow/offline: instant from cache
		try { return await network; }              // uncached asset: wait the network out
		catch {
			if (e.request.mode === 'navigate') {
				const shell = (await caches.match('./')) || (await caches.match('./index.html'));
				if (shell) return shell;
			}
			return Response.error();               // explicit, spec-clean network error
		}
	})());
});
