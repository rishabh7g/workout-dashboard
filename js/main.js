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
// Dead borrows (keys before today) are unreachable by construction, so this
// runs every boot regardless of the post-program ws- gate above. See
// pruneOldBorrows in storage.js.
pruneOldBorrows();
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

// ─── Cross-tab sync ───────────────────────────────────────────────────────────
// The `storage` event fires only in OTHER same-profile contexts (never the one
// that made the write), so when a background tab hears today's ticks or the
// day-borrow map change under it, repaint from storage instead of holding a
// stale screen. Paired with the read-modify-write merge in toggleItem, two open
// contexts stay converged instead of silently clobbering each other's ticks.
window.addEventListener('storage', (e) => {
	if (e.key === 'ws-' + cachedKey || e.key === 'day-borrow') render();
});

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
// A mid-session deploy activates immediately (sw.js: skipWaiting + claim), so
// the page keeps running OLD js until it is next relaunched — and the midnight
// refresh only re-renders, it never reloads code. `controllerchange` fires when
// the new worker takes control; we surface a non-intrusive toast rather than
// auto-reloading mid-workout. The first-install claim is skipped via the
// hadController flag. (Error surfacing for register() is ticket #83.)
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('./sw.js').catch(() => {});
	let hadController = !!navigator.serviceWorker.controller;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (hadController) showUpdateToast(); // skip the first-install claim
		hadController = true;
	});
}

// Fixed bottom pill announcing a new deploy; tapping it reloads onto the fresh
// code. role="status" so screen readers announce it. Idempotent — a second
// controllerchange won't stack toasts.
function showUpdateToast() {
	if (document.querySelector('.update-toast')) return;
	const toast = document.createElement('button');
	toast.className = 'update-toast';
	toast.type = 'button';
	toast.setAttribute('role', 'status');
	toast.textContent = 'Updated — tap to refresh';
	toast.onclick = () => location.reload();
	document.body.appendChild(toast);
}
