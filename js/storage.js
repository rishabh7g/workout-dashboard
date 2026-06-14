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
let allItems = [];              // the full ordered item list for today
let cachedKey = null;           // today's date key, so saveState knows where to write

// ─── Per-day completion ─────────────────────────────────────────────────────
function saveState(key) {
  try { localStorage.setItem('ws-' + key, JSON.stringify([...completedItems])); } catch(e) {}
}
function loadState(key) {
  try {
    const s = localStorage.getItem('ws-' + key);
    if (s) return new Set(JSON.parse(s));
  } catch(e) {}
  return new Set();
}

// ─── Day borrow ("follow a different day") ──────────────────────────────────
function loadBorrows() {
  try { return JSON.parse(localStorage.getItem('day-borrow') || '{}'); } catch(e) { return {}; }
}
function saveBorrows(b) {
  try { localStorage.setItem('day-borrow', JSON.stringify(b)); } catch(e) {}
}
