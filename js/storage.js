/*
 * storage.js — Everything that talks to localStorage, plus the live
 * in-memory state for the current workout.
 *
 * Two kinds of data live in the browser between visits:
 *   1. ws-<date>   -> which item ids are ticked off for that day
 *   2. day-borrow  -> { "2026-06-14": "2026-06-18" } (see ui.js openSwapSheet)
 *
 * Every read is wrapped in try/catch because localStorage can throw
 * (private mode, quota, disabled) — when it does we just fall back to empty
 * state instead of crashing the whole app.
 */

// ─── Live session state (shared across files) ───────────────────────────────
// These are plain top-level `let`s in a classic script, so they form a single
// shared binding every other script can read and write.
let completedItems = new Set(); // ids of items ticked done today
let allItems = []; // the full ordered item list for today
// The localStorage key for today's ticks. It encodes the *workout* being shown
// (date + type + variation) — not just the date — so that "follow a different
// day" keeps each workout's progress separate instead of one set of positional
// ids (stretch-1, ex-2, …) bleeding onto an unrelated workout.
let cachedKey = null;
let cachedDayKey = null; // plain YYYY-MM-DD, so we can detect a midnight rollover

// Whether localStorage actually persists. An app whose whole value is a
// trustworthy record must never *look* saved while silently dropping ticks, so
// we track this and let the UI surface a warning when it goes false.
// Boot probe: prove a round-trip write works right now (private mode, disabled
// site storage, or a full quota all throw here).
let storageOK = true;
try {
	localStorage.setItem('ws-probe', '1');
	localStorage.removeItem('ws-probe');
} catch (e) {
	storageOK = false;
}

// Build the storage key for a given date + schedule entry.
function stateKey(dayKey, entry) {
	return entry ? `${dayKey}-${entry.type}-${entry.variation || 'x'}` : dayKey;
}

// ─── Per-day completion ─────────────────────────────────────────────────────
function saveState(key) {
	try {
		localStorage.setItem('ws-' + key, JSON.stringify([...completedItems]));
	} catch (e) {
		// Never throw — but record that this write did NOT persist so the UI can
		// warn the user instead of pretending the tick was saved.
		storageOK = false;
	}
}
function loadState(key) {
	let s = null;
	try {
		s = localStorage.getItem('ws-' + key);
	} catch (e) {
		storageOK = false;
		return new Set();
	}
	if (s) {
		try {
			return new Set(JSON.parse(s));
		} catch (e) {
			// Corrupt record. Preserve the raw value under a quarantine key FIRST
			// (in its own try — quarantining must never throw) so the next tap
			// can't overwrite unreadable data with a fresh one-item array.
			try {
				localStorage.setItem('ws-corrupt-' + key, s);
			} catch (e2) {}
		}
	}
	return new Set();
}

// Drop per-day completion keys older than two weeks so localStorage doesn't
// grow for the whole life of the program. Each key is `ws-YYYY-MM-DD-...`, so
// the date to compare is the 10 chars right after the `ws-` prefix.
function pruneOldState() {
	try {
		const d = new Date();
		d.setDate(d.getDate() - 14);
		const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const k = localStorage.key(i);
			if (k && k.startsWith('ws-') && k.slice(3, 13) < cutoff) {
				localStorage.removeItem(k);
			}
		}
	} catch (e) {}
}

// ─── Day borrow ("follow a different day") ──────────────────────────────────
function loadBorrows() {
	try {
		return JSON.parse(localStorage.getItem('day-borrow') || '{}');
	} catch (e) {
		return {};
	}
}
function saveBorrows(b) {
	try {
		localStorage.setItem('day-borrow', JSON.stringify(b));
	} catch (e) {}
}
