// Standalone unit test for the sw.js fetch strategy (#151): the precached
// shell is served stale-while-revalidate (cache first, no network on the
// critical path); everything else stays network-first with the 3s race.
// The repo has no test framework; run with: node tests/sw-strategy.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const ORIGIN = 'https://example.test';
const SCOPE = ORIGIN + '/workout-dashboard/';
const SW_URL = SCOPE + 'sw.js';

const key = (r) => new URL(typeof r === 'string' ? r : r.url, SW_URL).href;
const url = (p) => new URL(p, SW_URL).href;

// A minimal Response: only the bits sw.js touches (ok/status/clone).
function res(body, { ok = true, status = 200 } = {}) {
	const r = { body, ok, status, clone: () => r };
	return r;
}

const NEVER = new Promise(() => {}); // a network that stalls forever

// Load sw.js in a fresh context with stubbed SW globals, and hand back a
// driver that dispatches a fetch event the way the browser would.
function load({ cached = {}, network } = {}) {
	const store = new Map(Object.entries(cached).map(([p, b]) => [url(p), res(b)]));
	const listeners = {};
	const waits = []; // promises passed to event.waitUntil()
	const cache = {
		addAll: async () => {},
		put: async (req, r) => { store.set(key(req), r); },
		match: async (req) => store.get(key(req)),
	};
	const ctx = {
		console,
		URL,
		setTimeout,
		self: {
			addEventListener: (type, fn) => { listeners[type] = fn; },
			location: { href: SW_URL, origin: ORIGIN },
			skipWaiting: () => {},
			clients: { claim: () => {} },
		},
		caches: {
			open: async () => cache,
			keys: async () => [],
			delete: async () => true,
			match: async (req) => store.get(key(req)),
		},
		fetch: (req) => network(req),
		Response: { error: () => res(null, { ok: false, status: 0 }) },
	};
	vm.createContext(ctx);
	vm.runInContext(src, ctx);

	return {
		store,
		waits,
		// Returns the promise passed to respondWith, or null if sw.js declined
		// to handle the request (passthrough to the browser).
		fetchEvent(request) {
			let responded = null;
			listeners.fetch({
				request,
				respondWith: (p) => { responded = p; },
				waitUntil: (p) => { waits.push(p); },
			});
			return responded;
		},
	};
}

const GET = (p, extra = {}) => ({ url: url(p), method: 'GET', mode: 'no-cors', ...extra });
const NAV = (p) => GET(p, { mode: 'navigate' });

// Resolve `p`, or the sentinel 'TIMEOUT' if it takes longer than `ms`.
// Used to prove the cache answered without waiting on NETWORK_TIMEOUT_MS.
function within(p, ms = 100) {
	return Promise.race([p, new Promise((r) => setTimeout(() => r('TIMEOUT'), ms))]);
}

async function main() {
	// 1. The hot path: a precached shell asset is served from the cache with a
	//    dead network, and does NOT wait out the 3s race.
	{
		const sw = load({ cached: { './': 'old-shell' }, network: () => NEVER });
		const r = await within(sw.fetchEvent(NAV('./')));
		assert.notStrictEqual(r, 'TIMEOUT', 'shell must answer from cache without waiting on the network');
		assert.strictEqual(r.body, 'old-shell', 'shell launch must be served from the cache');
		console.log('PASS 1: cached shell paints instantly with a stalled network');
	}

	// 2. Revalidation still happens: the background fetch refreshes the cache
	//    entry for the next load, even though the stale copy was returned.
	{
		const sw = load({ cached: { './js/main.js': 'v1' }, network: async () => res('v2') });
		const r = await sw.fetchEvent(GET('./js/main.js'));
		assert.strictEqual(r.body, 'v1', 'this load gets the cached copy');
		await Promise.all(sw.waits);
		assert.strictEqual(sw.store.get(url('./js/main.js')).body, 'v2', 'cache must be refreshed in the background');
		console.log('PASS 2: stale response served, cache revalidated for next load');
	}

	// 3. A failed revalidation must not poison the cache or reject the response.
	{
		const sw = load({ cached: { './css/styles.css': 'v1' }, network: async () => { throw new Error('offline'); } });
		const r = await sw.fetchEvent(GET('./css/styles.css'));
		assert.strictEqual(r.body, 'v1', 'offline shell request is served from the cache');
		await Promise.all(sw.waits); // must not reject
		assert.strictEqual(sw.store.get(url('./css/styles.css')).body, 'v1', 'failed revalidation leaves the cache intact');
		console.log('PASS 3: offline revalidation failure is swallowed, cache intact');
	}

	// 4. A non-error response that must not be cached (404, 206) is passed
	//    through without clobbering the good cached copy.
	{
		const sw = load({ cached: { './index.html': 'good' }, network: async () => res('404 page', { ok: false, status: 404 }) });
		const r = await sw.fetchEvent(GET('./index.html'));
		assert.strictEqual(r.body, 'good');
		await Promise.all(sw.waits);
		assert.strictEqual(sw.store.get(url('./index.html')).body, 'good', 'a 404 must never replace a cached shell asset');
		console.log('PASS 4: bad responses do not overwrite the cached shell');
	}

	// 5. Cold cache (first ever load): the shell comes from the network and is
	//    stored for next time.
	{
		const sw = load({ network: async () => res('fresh') });
		const r = await sw.fetchEvent(NAV('./'));
		assert.strictEqual(r.body, 'fresh', 'uncached shell falls back to the network');
		await Promise.all(sw.waits);
		assert.strictEqual(sw.store.get(url('./')).body, 'fresh', 'network response is precached for next launch');
		console.log('PASS 5: cold cache serves and stores the network response');
	}

	// 6. Non-precached same-origin GETs keep network-first: a healthy network
	//    wins over the cached copy (the #5 freshness invariant, unchanged).
	{
		const sw = load({ cached: { './other.json': 'stale' }, network: async () => res('fresh') });
		const r = await within(sw.fetchEvent(GET('./other.json')));
		assert.strictEqual(r.body, 'fresh', 'non-shell URLs must still prefer the network');
		console.log('PASS 6: non-precached GETs stay network-first');
	}

	// 7. Offline navigation to a URL that is not itself cached still gets the
	//    shell (the existing navigate fallback, preserved).
	{
		const sw = load({ cached: { './': 'shell' }, network: async () => { throw new Error('offline'); } });
		const r = await sw.fetchEvent(NAV('./deep/link'));
		assert.strictEqual(r.body, 'shell', 'offline navigation falls back to the cached shell');
		console.log('PASS 7: offline navigate falls back to the shell');
	}

	// 8. Requests sw.js must not touch at all: non-GET, and cross-origin.
	{
		const sw = load({ network: async () => res('x') });
		assert.strictEqual(sw.fetchEvent({ url: url('./'), method: 'POST' }), null, 'non-GET must pass through');
		assert.strictEqual(
			sw.fetchEvent({ url: 'https://other.test/a.js', method: 'GET' }), null,
			'cross-origin must pass through',
		);
		console.log('PASS 8: non-GET and cross-origin requests pass through untouched');
	}

	// 9. The strategy picker is driven by the real ASSETS list, so it cannot
	//    drift from what install() precaches.
	{
		const assets = src.slice(src.indexOf('const ASSETS'), src.indexOf('];'));
		for (const p of ['./', './index.html', './css/styles.css', './js/main.js']) {
			assert.ok(assets.includes(`'${p}'`), `${p} must be in ASSETS for the shell strategy to apply`);
		}
		console.log('PASS 9: shell strategy is derived from the ASSETS precache list');
	}

	console.log('\nALL SW STRATEGY TESTS PASSED');
}

main().catch((err) => { console.error(err); process.exit(1); });
