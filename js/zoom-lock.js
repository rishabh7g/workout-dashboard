/*
 * zoom-lock.js — Standalone zoom lock (#166, house UI standard §7).
 *
 * Zoom is on in a browser tab and off once installed. The static viewport tag
 * in index.html carries no zoom flags — it must not — because detecting
 * display-mode is only possible client-side (the same URL is a tab on one
 * launch and an installed app on the next). This script reads
 * matchMedia('(display-mode: standalone)') and, only when it matches,
 * AMENDS the tag's existing content string by appending
 * `maximum-scale=1, user-scalable=no`. It never writes a hardcoded
 * replacement string, so `viewport-fit=cover` (and anything else already on
 * the tag) always survives — losing that would silently turn off every
 * env(safe-area-inset-*) read in the app.
 *
 * Loaded LAST, after main.js — it is independent of the
 * data -> storage -> workout -> ui -> main chain.
 */

// The two directives this script owns — everything else in the tag is not ours.
const ZOOM_LOCK_DIRECTIVES = ['maximum-scale=1', 'user-scalable=no'];
const ZOOM_LOCK_OWNED = /^(maximum-scale|user-scalable)\s*=/i;

// Idempotent by construction: it strips our directives before deciding
// whether to re-add them, so it reads the CURRENT tag rather than a captured
// original and cannot get stuck locked after a display-mode change.
function syncViewport(meta, standalone) {
	const base = meta.content
		.split(',')
		.map((d) => d.trim())
		.filter((d) => d.length > 0 && !ZOOM_LOCK_OWNED.test(d));
	meta.content = (standalone ? base.concat(ZOOM_LOCK_DIRECTIVES) : base).join(', ');
}

if (typeof document !== 'undefined') {
	const viewportMeta = document.querySelector('meta[name="viewport"]');
	if (viewportMeta) {
		const displayModeQuery = typeof matchMedia === 'function'
			? matchMedia('(display-mode: standalone)')
			: null;

		const applyZoomLock = () => syncViewport(viewportMeta, !!(displayModeQuery && displayModeQuery.matches));
		applyZoomLock();

		// A session can move between tab and installed display modes without a
		// reload; re-run on that change so the lock never silently lifts or sticks.
		if (displayModeQuery && typeof displayModeQuery.addEventListener === 'function') {
			displayModeQuery.addEventListener('change', applyZoomLock);
		}
	}
}

// ─── Node-only test exports (inert in the browser — see js/data.js) ─────────
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { syncViewport };
}
