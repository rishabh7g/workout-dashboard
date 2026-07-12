const CACHE = 'workout-dashboard-v3';
const ASSETS = [
	'./',
	'./index.html',
	'./manifest.json',
	'./css/styles.css',
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
						.filter((k) => k !== CACHE)
						.map((k) => caches.delete(k)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener('fetch', (e) => {
	// Network-first for same-origin GETs: always try the network so a fresh
	// deploy shows up on the very next load, and fall back to cache only when
	// offline. This avoids the old cache-first behaviour where new code took an
	// extra reload to appear, and the unhandled rejection when offline.
	if (
		e.request.method === 'GET' &&
		e.request.url.startsWith(self.location.origin)
	) {
		e.respondWith(
			fetch(e.request)
				.then((res) => {
					if (res.ok) {
						const clone = res.clone();
						caches.open(CACHE).then((c) => c.put(e.request, clone));
					}
					return res;
				})
				.catch(() =>
					caches
						.match(e.request)
						.then((cached) => cached || caches.match('./index.html')),
				),
		);
	}
});
