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

// Set by loadState when a v1 record's stored item count no longer matches the
// current workout definition (an exercise was inserted/removed in data.js). The
// UI reads this after each load to surface an honest "progress re-checked"
// notice via the same header plumbing as the storage warning.
let definitionChanged = false;

// Build the storage key for a given date + schedule entry.
function stateKey(dayKey, entry) {
	return entry ? `${dayKey}-${entry.type}-${entry.variation || 'x'}` : dayKey;
}

// ─── Per-day completion ─────────────────────────────────────────────────────
//
// Records are stored as a v1 schema envelope: { v, n, done }. `v` is the schema
// version, `n` is the item count at save time (allItems.length), and `done` is
// the array of ticked ids. The count lets loadState detect a workout-definition
// change: item ids are positional (`${sec}-${counts[sec]}`, js/workout.js), so
// inserting/removing an exercise in data.js would otherwise silently re-bind a
// stored tick to a *different* exercise. The envelope turns that into an
// explicit, honest "progress re-checked" state.
//
// The key is still `ws-<key>` (unchanged), so versioned records keep matching
// pruneOldState's `^ws-\d{4}-\d{2}-\d{2}` day-key regex.
//
// Residual limitation: a reorder that keeps the count identical is still
// undetectable with positional ids — n only catches count changes. The
// mitigation is the schedule-validator suite (milestone 01) catching accidental
// data edits, plus the deliberate decision NOT to change the id scheme here
// (milestone 04's redesign must keep ids byte-stable; a slug-id migration was
// considered and deferred as not worth the migration risk mid-program).
function saveState(key) {
	try {
		localStorage.setItem(
			'ws-' + key,
			JSON.stringify({ v: 1, n: allItems.length, done: [...completedItems] })
		);
	} catch (e) {
		// Never throw — but record that this write did NOT persist so the UI can
		// warn the user instead of pretending the tick was saved.
		storageOK = false;
	}
}
function loadState(key) {
	definitionChanged = false;
	let s = null;
	try {
		s = localStorage.getItem('ws-' + key);
	} catch (e) {
		storageOK = false;
		return new Set();
	}
	if (s) {
		try {
			const parsed = JSON.parse(s);
			// Legacy v0: a bare id array, written before the schema envelope. Accept
			// as-is so an upgrade never drops a user's ticks on the first read.
			if (Array.isArray(parsed)) {
				return new Set(parsed);
			}
			// v1 envelope. If the stored item count no longer matches today's list,
			// the workout definition changed — keep only ids that still exist in the
			// current list (drop unknown ids). Worst case a tick is dropped, never
			// re-shown on a different exercise, and we flag the UI to explain why.
			if (parsed && Array.isArray(parsed.done)) {
				if (parsed.n !== allItems.length) {
					definitionChanged = true;
					const current = new Set(allItems.map((i) => i.id));
					return new Set(parsed.done.filter((id) => current.has(id)));
				}
				return new Set(parsed.done);
			}
			// Parsed cleanly but is an unrecognized shape — fall through to empty
			// state rather than quarantining valid JSON.
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

// Retention decision: in-program history is kept in full (~60 KB worst case,
// 184 program days × ~150–300 B against a ~5 MB quota) — the prune buys nothing
// in-program and would permanently destroy the only record of the program (a
// workout variation recurs every 28 days, so a 14-day prune wipes the very
// last-session data the "add 2.5 kg when 12 reps feels easy" rule needs). So
// this only runs after PROGRAM_END (gated at the call site in main.js).
//
// Milestone-06 constraint: future stores must AVOID the `ws-` key prefix. Old
// clients may still run old code that prunes eagerly by that prefix, and this
// filter keys off it too — the planned `exlog`/`hist` stores sidestep it by
// using a different prefix.
//
// This only touches real day records (`ws-YYYY-MM-DD-...`), NOT the boot probe
// (`ws-probe`) or quarantined corrupt records (`ws-corrupt-*`) — their
// slice(3,13) is not a valid date and must never be pruned.
function pruneOldState() {
	try {
		const d = new Date();
		d.setDate(d.getDate() - 14);
		const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		// Real day keys look like ws-YYYY-MM-DD optionally followed by -type-var.
		const dayKeyRe = /^ws-\d{4}-\d{2}-\d{2}(-|$)/;
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const k = localStorage.key(i);
			if (k && dayKeyRe.test(k) && k.slice(3, 13) < cutoff) {
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

// The day-borrow map grows monotonically: every borrow ever made is keyed by
// its (then-current) date via doBorrow, but resolution only ever reads
// borrows[todayKey()] (ui.js render). A key strictly before today is therefore
// unreachable by construction — pure dead weight, including the orphans the
// pre-fix two-clock swap-sheet bug wrote. Unlike ws- history (kept in-program,
// pruned only post-PROGRAM_END — main.js call site), these entries can never
// be read again, so this runs at boot unconditionally regardless of the ws-
// retention policy. Today's and any future-dated key survive.
function pruneOldBorrows() {
	try {
		const b = loadBorrows();
		const today = todayKey();
		let changed = false;
		for (const k of Object.keys(b)) {
			if (k < today) {
				delete b[k];
				changed = true;
			}
		}
		if (changed) saveBorrows(b);
	} catch (e) {}
}
