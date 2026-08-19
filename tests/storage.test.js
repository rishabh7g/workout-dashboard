// Standalone unit test for js/storage.js versioned-envelope behaviour (#54).
// The repo has no test framework; run with: node tests/storage.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

function makeStore(seed = {}) {
	const map = new Map(Object.entries(seed));
	return {
		map,
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => map.set(k, String(v)),
		removeItem: (k) => map.delete(k),
		get length() { return map.size; },
		key: (i) => [...map.keys()][i],
	};
}

// Load storage.js in a fresh context and expose its top-level functions/lets.
// `now` (optional) freezes the clock pruneOldState reads — it dates its cutoff
// off `new Date()`, not todayKey(), so the window is only testable with a fixed
// wall clock.
function load(store, today = '2026-07-14', now = null) {
	// todayKey lives in workout.js at runtime (loaded before main.js calls
	// pruneOldBorrows); inject a stub so storage.js can resolve it here.
	const ctx = { localStorage: store, console, todayKey: () => today };
	if (now) {
		const Real = Date;
		ctx.Date = class extends Real {
			constructor(...args) {
				super(...(args.length ? args : [now]));
			}
		};
	}
	vm.createContext(ctx);
	vm.runInContext(
		src +
			'\nthis.__api = { saveState, loadState, toggleAndSave, loadBorrows, saveBorrows, pruneOldBorrows, pruneOldState, STATE_RETENTION_DAYS, serializeBackup, get definitionChanged(){return definitionChanged;}, get stateCorrupted(){return stateCorrupted;}, get quarantineFailed(){return quarantineFailed;}, get borrowsCorrupted(){return borrowsCorrupted;}, get completedItems(){return completedItems;}, set completedItems(v){completedItems=v;}, set allItems(v){allItems=v;}, get storageOK(){return storageOK;}, set storageOK(v){storageOK=v;} };',
		ctx
	);
	return ctx.__api;
}

const items3 = [{ id: 'ex-1' }, { id: 'ex-2' }, { id: 'ex-3' }];

// 1. Legacy v0 bare array loads as-is (no loss on upgrade day).
{
	const store = makeStore({ 'ws-2026-07-14-legs-A': JSON.stringify(['ex-1', 'ex-3']) });
	const api = load(store);
	api.allItems = items3;
	const set = api.loadState('2026-07-14-legs-A');
	assert.deepStrictEqual([...set].sort(), ['ex-1', 'ex-3']);
	assert.strictEqual(api.definitionChanged, false, 'v0 load must not flag change');
	console.log('PASS 1: legacy v0 bare array loads as-is');
}

// 2. Round-trip save -> load -> save is stable and uses the envelope.
{
	const store = makeStore();
	const api = load(store);
	api.allItems = items3;
	api.completedItems = new Set(['ex-1', 'ex-2']);
	api.saveState('2026-07-14-legs-A');
	const raw = JSON.parse(store.getItem('ws-2026-07-14-legs-A'));
	assert.strictEqual(raw.v, 1, 'stored value carries v:1');
	assert.strictEqual(raw.n, 3, 'stored value carries item count');
	assert.deepStrictEqual(raw.done.sort(), ['ex-1', 'ex-2']);
	const set = api.loadState('2026-07-14-legs-A');
	assert.deepStrictEqual([...set].sort(), ['ex-1', 'ex-2']);
	assert.strictEqual(api.definitionChanged, false);
	console.log('PASS 2: envelope round-trip stable, carries v/n');
}

// 3. n-mismatch: an exercise was inserted (count grew). Unknown ids dropped,
//    known ids kept, definitionChanged flagged. Ticks never re-bind.
{
	// Saved when there were 3 items, ticking ex-2 and ex-3.
	const store = makeStore({
		'ws-2026-07-14-legs-A': JSON.stringify({ v: 1, n: 3, done: ['ex-2', 'ex-3'] }),
	});
	const api = load(store);
	// Now the list has 4 items (one inserted) — ex-3 no longer exists; a 4th did.
	api.allItems = [{ id: 'ex-1' }, { id: 'ex-2' }, { id: 'ex-3' }, { id: 'ex-4' }];
	const set = api.loadState('2026-07-14-legs-A');
	// ex-2 and ex-3 both still exist in the 4-item list, so both kept here...
	assert.strictEqual(api.definitionChanged, true, 'n-mismatch must flag change');
	assert.ok(set.has('ex-2') && set.has('ex-3'));
	console.log('PASS 3a: n-mismatch flags definitionChanged');
}

// 3b. n-mismatch that drops an id no longer present (removal shrank the list).
{
	const store = makeStore({
		'ws-2026-07-14-legs-A': JSON.stringify({ v: 1, n: 3, done: ['ex-1', 'ex-2', 'ex-3'] }),
	});
	const api = load(store);
	api.allItems = [{ id: 'ex-1' }, { id: 'ex-2' }]; // ex-3 removed
	const set = api.loadState('2026-07-14-legs-A');
	assert.strictEqual(api.definitionChanged, true);
	assert.deepStrictEqual([...set].sort(), ['ex-1', 'ex-2'], 'unknown id ex-3 dropped');
	assert.ok(!set.has('ex-3'), 'dropped id must not survive');
	console.log('PASS 3b: n-mismatch drops now-unknown ids');
}

// 4. Corrupt record is quarantined, not silently overwritten.
{
	const store = makeStore({ 'ws-2026-07-14-legs-A': '{not json' });
	const api = load(store);
	api.allItems = items3;
	const set = api.loadState('2026-07-14-legs-A');
	assert.strictEqual(set.size, 0);
	assert.strictEqual(store.getItem('ws-corrupt-2026-07-14-legs-A'), '{not json');
	console.log('PASS 4: corrupt record quarantined (regression guard for #51)');
}

// 5. pruneOldBorrows (#59): past-dated borrow keys removed at boot; today's and
//    future-dated keys survive; ws- records untouched; round-trip still works.
{
	const store = makeStore({
		'day-borrow': JSON.stringify({
			'2026-07-12': '2026-07-15', // past — orphan from the two-clock bug
			'2026-07-13': '2026-07-16', // past
			'2026-07-14': '2026-07-18', // today — must survive
			'2026-07-20': '2026-07-22', // future — must survive
		}),
		'ws-2026-07-10-legs-A': JSON.stringify({ v: 1, n: 3, done: ['ex-1'] }),
	});
	const api = load(store, '2026-07-14');
	api.pruneOldBorrows();
	const b = api.loadBorrows();
	assert.deepStrictEqual(
		Object.keys(b).sort(),
		['2026-07-14', '2026-07-20'],
		'only today+future borrows survive'
	);
	assert.strictEqual(b['2026-07-14'], '2026-07-18', 'today borrow still resolves');
	assert.strictEqual(b['2026-07-20'], '2026-07-22', 'future borrow preserved');
	// ws- record untouched by borrow pruning.
	assert.ok(store.getItem('ws-2026-07-10-legs-A'), 'ws- record untouched');
	console.log('PASS 5: pruneOldBorrows drops past-dated keys only (#59)');
}

// 5b. No-op safety: empty/absent map and an all-future map must not throw and
//     must not rewrite storage needlessly.
{
	const store = makeStore(); // no day-borrow at all
	const api = load(store, '2026-07-14');
	api.pruneOldBorrows();
	assert.strictEqual(Object.keys(api.loadBorrows()).length, 0, 'absent map stays empty');
	assert.strictEqual(store.getItem('day-borrow'), null, 'no needless write when nothing to prune');
	console.log('PASS 5b: pruneOldBorrows is a safe no-op with no dead entries (#59)');
}

// 6. Concurrent-tab merge (#61): a context that loaded empty ticks one item and
//    must NOT clobber the ticks another context already persisted. The final
//    stored set is the UNION of both sessions' completions.
{
	// Context A already persisted ex-1..ex-3 for this workout.
	const store = makeStore({
		'ws-2026-07-14-legs-A': JSON.stringify({ v: 1, n: 3, done: ['ex-1', 'ex-2', 'ex-3'] }),
	});
	// Context B rendered before A saved, so its in-memory set is empty.
	const api = load(store);
	api.allItems = items3;
	api.completedItems = new Set(); // stale empty view
	// B ticks ex-3 (already done in storage) — an untick from B's stale view is
	// still authoritative for that one id; every other id comes from storage.
	// Simpler additive case: B ticks a fresh id and A's ticks must survive.
	api.allItems = [{ id: 'ex-1' }, { id: 'ex-2' }, { id: 'ex-3' }, { id: 'ex-4' }];
	// Re-seed with matching n so no definition-change drop interferes.
	store.setItem('ws-2026-07-14-legs-A', JSON.stringify({ v: 1, n: 4, done: ['ex-1', 'ex-2', 'ex-3'] }));
	api.toggleAndSave('2026-07-14-legs-A', 'ex-4');
	const raw = JSON.parse(store.getItem('ws-2026-07-14-legs-A'));
	assert.deepStrictEqual(raw.done.sort(), ['ex-1', 'ex-2', 'ex-3', 'ex-4'], 'union of both sessions survives');
	assert.deepStrictEqual([...api.completedItems].sort(), ['ex-1', 'ex-2', 'ex-3', 'ex-4']);
	console.log('PASS 6: concurrent tick merges (union), no clobber (#61)');
}

// 6b. Per-item authority: an UNtick from one context removes only that id and
//     leaves the other context's ticks intact.
{
	const store = makeStore({
		'ws-2026-07-14-legs-A': JSON.stringify({ v: 1, n: 3, done: ['ex-1', 'ex-2', 'ex-3'] }),
	});
	const api = load(store);
	api.allItems = items3;
	api.completedItems = new Set(['ex-1', 'ex-2', 'ex-3']); // this context sees all done
	api.toggleAndSave('2026-07-14-legs-A', 'ex-2'); // untick ex-2
	const raw = JSON.parse(store.getItem('ws-2026-07-14-legs-A'));
	assert.deepStrictEqual(raw.done.sort(), ['ex-1', 'ex-3'], 'only the toggled id removed');
	console.log('PASS 6b: untick is per-item, spares other ticks (#61)');
}

// 6c. Storage-failure path (#51): when storageOK is false the re-read is skipped
//     so in-memory ticks are NOT dropped, and the write still records failure.
{
	const store = makeStore();
	const api = load(store);
	api.allItems = items3;
	api.storageOK = false; // pretend the boot probe failed
	api.completedItems = new Set(['ex-1', 'ex-2']); // ticks held only in memory
	api.toggleAndSave('2026-07-14-legs-A', 'ex-3'); // tick a third, in memory
	assert.deepStrictEqual(
		[...api.completedItems].sort(),
		['ex-1', 'ex-2', 'ex-3'],
		'broken store must keep all in-memory ticks (no re-read wipe)'
	);
	console.log('PASS 6c: storage-failure path keeps in-memory ticks (#51 x #61)');
}

// 7. saveBorrows throwing (#173): reports failure to the caller AND flips
//    storageOK, mirroring saveState — no false "borrow saved" success.
{
	const store = makeStore();
	store.setItem = () => {
		throw new Error('quota');
	};
	const api = load(store);
	const ok = api.saveBorrows({ '2026-07-14': '2026-07-18' });
	assert.strictEqual(ok, false, 'saveBorrows reports failure');
	assert.strictEqual(api.storageOK, false, 'saveBorrows flips storageOK on failure (#173)');
	console.log('PASS 7: saveBorrows throwing reports failure and flips storageOK (#173)');
}

// 8. loadBorrows with corrupt JSON (#173): resets to {} (as before) but now
//    flags borrowsCorrupted so the UI can explain why.
{
	const store = makeStore({ 'day-borrow': '{not json' });
	const api = load(store);
	const b = api.loadBorrows();
	assert.strictEqual(JSON.stringify(b), '{}', 'corrupt day-borrow resets to {}');
	assert.strictEqual(api.borrowsCorrupted, true, 'corrupt day-borrow flags borrowsCorrupted (#173)');
	console.log('PASS 8: loadBorrows with corrupt JSON flags borrowsCorrupted (#173)');
}

// 8b. A healthy loadBorrows call must not leave a stale flag set.
{
	const store = makeStore({ 'day-borrow': '{}' });
	const api = load(store);
	api.loadBorrows();
	assert.strictEqual(api.borrowsCorrupted, false, 'healthy load leaves borrowsCorrupted false (#173)');
	console.log('PASS 8b: loadBorrows healthy path leaves borrowsCorrupted false (#173)');
}

// 9. loadState with corrupt JSON (#173): flags stateCorrupted (quarantine
//    itself already covered by PASS 4) so the UI can raise a notice.
{
	const store = makeStore({ 'ws-2026-07-14-legs-A': '{not json' });
	const api = load(store);
	api.allItems = items3;
	api.loadState('2026-07-14-legs-A');
	assert.strictEqual(api.stateCorrupted, true, 'corrupt ws-* record flags stateCorrupted (#173)');
	assert.strictEqual(api.quarantineFailed, null, 'quarantine succeeded, so quarantineFailed stays null (#173)');
	console.log('PASS 9: loadState with corrupt JSON flags stateCorrupted (#173)');
}

// 10. loadState where even the quarantine write fails (#173): nothing more
//     to do, but the failure must be reported, not swallowed.
{
	const store = makeStore({ 'ws-2026-07-14-legs-A': '{not json' });
	const realSetItem = store.setItem;
	store.setItem = (k, v) => {
		if (k.startsWith('ws-corrupt-')) throw new Error('quota');
		return realSetItem(k, v);
	};
	const api = load(store);
	api.allItems = items3;
	api.loadState('2026-07-14-legs-A');
	assert.strictEqual(api.stateCorrupted, true);
	assert.ok(api.quarantineFailed, 'quarantineFailed carries the throw when quarantining itself fails (#173)');
	console.log('PASS 10: loadState reports a failed quarantine write via quarantineFailed (#173)');
}

// 11. serializeBackup with a store that throws partway through iteration
//     (#173): must return truncated:true, never a clean schema-1 backup that
//     looks complete but silently drops days on restore.
{
	const store = makeStore({
		'ws-2026-07-01': JSON.stringify({ v: 1, n: 1, done: [] }),
		'ws-2026-07-02': JSON.stringify({ v: 1, n: 1, done: [] }),
	});
	let calls = 0;
	store.getItem = (k) => {
		calls++;
		if (calls === 2) throw new Error('device unplugged');
		return store.map.has(k) ? store.map.get(k) : null;
	};
	const api = load(store);
	const backup = api.serializeBackup();
	assert.strictEqual(backup.truncated, true, 'a mid-iteration throw marks the backup truncated (#173)');
	assert.ok(backup.error, 'the throw is carried for the caller to describe (#173)');
	console.log('PASS 11: serializeBackup marks a mid-iteration failure truncated, never a clean backup (#173)');
}

// 12. pruneOldState (#194): it used to run only once the program was over
//     (`todayKey() > PROGRAM_END` in main.js). With an open-ended schedule that
//     gate never fires, so it now runs EVERY boot against a rolling window.
//     Two things must hold: it still deletes genuinely old day records, and the
//     window is long enough that a workout variation's last session — 28 days
//     back at most — is never the thing it deletes.
{
	const NOW = '2027-06-15T09:00:00';
	const store = makeStore({
		'ws-2026-05-25-rest-x': JSON.stringify({ v: 1, n: 1, done: [] }),      // >1y old — goes
		'ws-2026-06-01-legs-quads-B': JSON.stringify({ v: 1, n: 1, done: [] }), // >1y old — goes
		'ws-2027-06-01-back-A': JSON.stringify({ v: 1, n: 1, done: ['ex-1'] }), // 14 days ago — MUST survive
		'ws-2027-05-18-chest-B': JSON.stringify({ v: 1, n: 1, done: ['ex-2'] }), // 28 days ago — MUST survive
		'ws-corrupt-2026-06-02-back-A': '{bad',   // quarantined — never pruned
		'day-borrow': JSON.stringify({ '2027-06-15': '2027-06-18' }),
	});
	const api = load(store, '2027-06-15', NOW);
	// Seeded AFTER load: storage.js writes and clears its own ws-probe at boot.
	store.setItem('ws-probe', '1');
	assert.strictEqual(api.STATE_RETENTION_DAYS, 365, 'retention window is a year');
	assert.ok(api.STATE_RETENTION_DAYS > 28, 'the window must exceed the 28-day variation cycle');
	api.pruneOldState();
	assert.strictEqual(store.getItem('ws-2026-05-25-rest-x'), null, 'a record older than the window is pruned');
	assert.strictEqual(store.getItem('ws-2026-06-01-legs-quads-B'), null, 'a record older than the window is pruned');
	assert.ok(store.getItem('ws-2027-06-01-back-A'), 'last fortnight survives');
	assert.ok(store.getItem('ws-2027-05-18-chest-B'), 'the previous run of this variation (28d) survives — progression reads it');
	assert.strictEqual(store.getItem('ws-probe'), '1', 'the boot probe is not a day key');
	assert.strictEqual(store.getItem('ws-corrupt-2026-06-02-back-A'), '{bad', 'quarantined records are never pruned');
	assert.ok(store.getItem('day-borrow'), 'the borrow map is not a ws- day record');
	console.log('PASS 12: pruneOldState keeps a year rolling window, sparing the 28-day cycle (#194)');
}

console.log('\nALL TESTS PASSED');
