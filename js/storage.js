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
// Read-modify-write a single tick so two same-profile contexts (an installed
// PWA + a stray browser tab sharing the profile's storage) CONVERGE per-item
// instead of clobbering the whole array. Without this, a context that loaded
// empty and ticks one item would save just `[thatItem]`, erasing every tick the
// other context had persisted. So: capture the user's intent (add vs remove)
// from what they currently see, then — when storage is healthy — re-load the
// freshly-stored done-set (it may already carry ticks another tab made since
// our last render) and apply only this one toggle to it before saving. The
// union of both sessions' completions survives; only the single toggled id is
// authoritative from this action.
//
// Storage-failure interaction (milestone-01 ticket): when storage is broken we
// must NOT re-read — loadState returns an empty Set on a failed store, and
// replacing the in-memory set with it would silently drop the ticks we are
// deliberately keeping visible while warning the user. The re-check after
// loadState covers the case where storage breaks DURING this read.
function toggleAndSave(key, id) {
	const adding = !completedItems.has(id);
	if (storageOK) {
		const merged = loadState(key);
		if (storageOK) completedItems = merged;
	}
	if (adding) completedItems.add(id);
	else completedItems.delete(id);
	saveState(key);
	return adding;
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

// ─── Per-exercise log (exlog) ───────────────────────────────────────────────
//
// A separate capture store for the numbers the tick array can't hold: the
// weight, reps and a felt-easy signal for each logged set — the data the
// "add 2.5 kg when 12 reps feels easy" progression rule actually needs.
//
// KEY DECISIONS (issue #86):
//   • Key = 'exlog', deliberately NOT `ws-` prefixed. pruneOldState only ever
//     matches `^ws-\d{4}-\d{2}-\d{2}`, so this store is invisible to it — the
//     in-program history the progression rule reads is never destroyed. The
//     js/storage.js prune note above records this constraint for future stores.
//   • Keyed by exercise NAME, not the positional item id. Ids (`ex-3`) are
//     per-workout positional, but the same exercise (e.g. Romanian deadlift)
//     recurs across A/B variations; name-keying gives ~14-day recall instead of
//     28 and one trajectory per movement rather than per slot.
//   • Shape: { "<name>": [{ d:'YYYY-MM-DD', w:32.5, r:12, e:true }, …] }, newest
//     LAST, capped at the last 10 entries per exercise (≈15 KB over 26 weeks —
//     bounded, so no pruning is needed).
//
// Every access is wrapped in try/catch with the same storageOK discipline as
// the tick store (#51): a read falls back to {} and a failed write flips
// storageOK (so the UI can warn) instead of throwing.
const EXLOG_KEY = 'exlog';
const EXLOG_CAP = 10;

function loadExlog() {
	try {
		const s = localStorage.getItem(EXLOG_KEY);
		if (!s) return {};
		const parsed = JSON.parse(s);
		// Guard the shape: only a plain object maps names → entry arrays. Anything
		// else (array, primitive, corrupt) falls back to empty rather than throwing.
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed;
		}
	} catch (e) {
		// Unreadable store (disabled/corrupt) — behave as if empty.
	}
	return {};
}

// The (up to 10) entries logged for one exercise NAME, newest last. Empty array
// when nothing's been logged for it yet.
function exlogEntries(name) {
	const arr = loadExlog()[name];
	return Array.isArray(arr) ? arr : [];
}

// The most recent entry for an exercise NAME (to pre-fill the capture sheet), or
// null when there's no history yet.
function lastExlogEntry(name) {
	const arr = exlogEntries(name);
	return arr.length ? arr[arr.length - 1] : null;
}

// Append one entry for an exercise NAME, keeping only the last EXLOG_CAP. Never
// throws: a failed write flips storageOK (so the UI can warn) and returns false;
// a successful write returns true. Honors storageOK the same way saveState does
// — it always attempts the write and records failure rather than pretending.
function appendExlog(name, entry) {
	const log = loadExlog();
	const arr = Array.isArray(log[name]) ? log[name] : [];
	arr.push(entry);
	log[name] = arr.slice(-EXLOG_CAP);
	try {
		localStorage.setItem(EXLOG_KEY, JSON.stringify(log));
		return true;
	} catch (e) {
		storageOK = false;
		return false;
	}
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

// ─── One-tap backup: export / import (issue #89) ─────────────────────────────
//
// localStorage on an installed PWA is OS-evictable and dies with the device.
// Once the exercise log (#86) exists, months of progression history become the
// most valuable data in the app, so the record has to be recoverable. These
// three functions are the whole persistence-export surface.
//
// SCOPE — "all app keys", enumerated, not hardcoded. This origin is exclusively
// the workout app, so EVERY localStorage key is app data: the ws-<date> ticks,
// ws-corrupt-* quarantine, day-borrow, exlog, the last-export marker, and any
// FUTURE store — all get swept up automatically by iterating localStorage rather
// than naming keys. The one exclusion is `ws-probe`: it is the transient boot
// round-trip probe (written then removed synchronously at load), never real
// state, so it is skipped from both export and the restore-clear.
//
// The last-export date lives under a NON-`ws-` key so pruneOldState's
// `^ws-\d{4}-\d{2}-\d{2}` sweep can never touch it (same discipline as exlog).
const LAST_EXPORT_KEY = 'last-export';
const BACKUP_SCHEMA = 1;
const PROBE_KEY = 'ws-probe';

// True for a key we own and should export / clear on restore. Everything except
// the transient boot probe.
function isAppKey(k) {
	return typeof k === 'string' && k.length > 0 && k !== PROBE_KEY;
}

// Read-only serializer: iterate localStorage.key(i)/getItem and copy every app
// key's raw string value into `data`. Never mutates storage. Values are kept as
// the exact stored strings so a round-trip is byte-identical (no re-encoding of
// the JSON envelopes). Returns a plain, JSON-serializable backup object.
function serializeBackup() {
	const data = {};
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!isAppKey(k)) continue;
			const v = localStorage.getItem(k);
			if (v !== null) data[k] = v;
		}
	} catch (e) {
		// A throwing store yields whatever we read so far; export never crashes.
	}
	return { schema: BACKUP_SCHEMA, exported: new Date().toISOString(), data };
}

// Full-shape validator — the gate that makes import atomic. Returns true ONLY
// for a well-formed, correctly-versioned backup: a plain object with
// schema === 1 and a plain-object `data` map whose every value is a string.
// Anything else (array, null, wrong/missing schema, non-string value) is
// rejected so a malformed or unversioned file can be refused BEFORE any
// destructive clear runs.
function validateBackup(obj) {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
	if (obj.schema !== BACKUP_SCHEMA) return false;
	const data = obj.data;
	if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
	for (const k of Object.keys(data)) {
		if (typeof data[k] !== 'string') return false;
	}
	return true;
}

// Replace-all restore. ATOMIC by construction: validate the ENTIRE object first
// and bail (returning false, touching nothing) if it fails, so a bad file can
// never partially apply. Only once valid do we clear existing app keys and write
// the file's keys. A mid-write storage failure (quota/disabled) is the one case
// that can leave a partial state — that is a genuine storage fault, not a bad
// file — and it flips storageOK so the UI can warn, mirroring saveState (#51).
function restoreBackup(obj) {
	if (!validateBackup(obj)) return false;
	const data = obj.data;
	try {
		// Clear existing app keys first (snapshot keys before mutating the store).
		const toRemove = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (isAppKey(k)) toRemove.push(k);
		}
		for (const k of toRemove) localStorage.removeItem(k);
		// Write from the file.
		for (const k of Object.keys(data)) {
			localStorage.setItem(k, data[k]);
		}
		return true;
	} catch (e) {
		storageOK = false;
		return false;
	}
}

// Persist the last-export timestamp (ISO) under the non-ws- marker key, and read
// it back for the footer label. Silent-fail like the rest of storage.js.
function recordExport(iso) {
	try {
		localStorage.setItem(LAST_EXPORT_KEY, iso);
	} catch (e) {
		storageOK = false;
	}
}
function lastExportDate() {
	try {
		return localStorage.getItem(LAST_EXPORT_KEY);
	} catch (e) {
		return null;
	}
}
