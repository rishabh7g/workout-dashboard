/*
 * main.js — App bootstrap. Loaded LAST, after every other script.
 *
 * By the time this runs, all the data and functions from the other files
 * already exist on the page, so we can safely:
 *   1. paint the first screen,
 *   2. re-paint when the calendar day rolls over while the app is open,
 *   3. register the service worker for offline support.
 *
 * The PWA manifest is a static file (manifest.json) linked from index.html —
 * a runtime blob: URL can't resolve a relative start_url, which breaks install.
 */

// ─── First paint ────────────────────────────────────────────────────────────
pruneOldState();
render();

// ─── Keep "today" fresh ──────────────────────────────────────────────────────
// An installed PWA often stays open for days. render() captures the date once,
// so without this the screen (and where ticks are saved) would be stuck on the
// day the app was opened. Re-render whenever we regain focus on a new date.
function refreshIfDayChanged() {
	if (!document.hidden && typeof cachedDayKey !== 'undefined' && cachedDayKey !== todayKey()) {
		render();
	}
}
document.addEventListener('visibilitychange', refreshIfDayChanged);
window.addEventListener('focus', refreshIfDayChanged);

// ─── Service Worker (offline support) ────────────────────────────────────────
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('./sw.js').catch(() => {});
}
