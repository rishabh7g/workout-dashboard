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
// In-program history is kept in full (~60 KB worst case) — deleting it buys
// nothing and would destroy the only record of the program. Only clean up
// once the whole program is over. See pruneOldState in storage.js.
if (todayKey() > PROGRAM_END) pruneOldState();
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

// Rollover safety net for the always-visible case (visibilitychange/focus
// never fire if the app stays on screen across midnight).
function scheduleMidnightRefresh() {
	const now = new Date();
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	setTimeout(() => {
		refreshIfDayChanged();
		scheduleMidnightRefresh();
	}, next - now + 1000);
}
scheduleMidnightRefresh();
setInterval(refreshIfDayChanged, 60000); // belt-and-braces; no-ops when day unchanged

// ─── Service Worker (offline support) ────────────────────────────────────────
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('./sw.js').catch(() => {});
}
