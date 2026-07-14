// Standalone unit test for the per-exercise log store (exlog) in js/storage.js
// (#86). The repo has no test framework; run with: node tests/exlog.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

// Values returned from the vm context carry that realm's Object.prototype, so
// assert.deepStrictEqual (which compares prototypes) reports a false mismatch.
// Compare by JSON shape instead — this store is plain JSON anyway.
function eq(actual, expected, msg) {
	assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

function makeStore(seed = {}) {
	const map = new Map(Object.entries(seed));
	return {
		map,
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => map.set(k, String(v)),
		removeItem: (k) => map.delete(k),
		get length() {
			return map.size;
		},
		key: (i) => [...map.keys()][i],
	};
}

// A store whose setItem always throws (private mode / quota), to prove the
// storageOK-off path never throws and records the failure.
function makeBrokenStore(seed = {}) {
	const s = makeStore(seed);
	s.setItem = () => {
		throw new Error('QuotaExceeded');
	};
	return s;
}

// Load storage.js in a fresh context and expose the exlog accessors + storageOK.
function load(store, today = '2026-07-14') {
	const ctx = { localStorage: store, console, todayKey: () => today };
	vm.createContext(ctx);
	vm.runInContext(
		src +
			'\nthis.__api = { loadExlog, exlogEntries, lastExlogEntry, appendExlog, get storageOK(){return storageOK;}, set storageOK(v){storageOK=v;}, EXLOG_KEY, EXLOG_CAP };',
		ctx,
	);
	return ctx.__api;
}

// 1. Append round-trip: a new exercise gets an entry; it reads back verbatim,
//    newest last, under the plain `exlog` key (NOT ws- prefixed).
{
	const store = makeStore();
	const api = load(store);
	const ok = api.appendExlog('Romanian deadlift', {
		d: '2026-07-14',
		w: 32.5,
		r: 12,
		e: true,
	});
	assert.strictEqual(ok, true, 'append returns true on success');
	assert.ok(store.getItem('exlog'), 'writes to the exlog key');
	assert.strictEqual(store.getItem('ws-exlog'), null, 'is NOT ws- prefixed');
	const arr = api.exlogEntries('Romanian deadlift');
	eq(arr, [{ d: '2026-07-14', w: 32.5, r: 12, e: true }]);
	console.log('PASS 1: append round-trips under the exlog key');
}

// 2. Newest-last ordering + lastExlogEntry returns the most recent.
{
	const store = makeStore();
	const api = load(store);
	api.appendExlog('Bench press', { d: '2026-07-10', w: 40, r: 10, e: false });
	api.appendExlog('Bench press', { d: '2026-07-14', w: 42.5, r: 8, e: true });
	const arr = api.exlogEntries('Bench press');
	assert.strictEqual(arr.length, 2);
	assert.strictEqual(arr[arr.length - 1].w, 42.5, 'newest is last');
	eq(api.lastExlogEntry('Bench press'), { d: '2026-07-14', w: 42.5, r: 8, e: true });
	console.log('PASS 2: newest-last ordering, lastExlogEntry is most recent');
}

// 3. 10-entry cap: appending an 11th drops the OLDEST, keeps the last 10.
{
	const store = makeStore();
	const api = load(store);
	for (let i = 1; i <= 12; i++) {
		api.appendExlog('Squat', { d: `2026-07-${String(i).padStart(2, '0')}`, w: 50 + i, r: 5, e: false });
	}
	const arr = api.exlogEntries('Squat');
	assert.strictEqual(arr.length, 10, 'capped at 10 entries');
	assert.strictEqual(arr[0].d, '2026-07-03', 'oldest kept is the 3rd (1&2 dropped)');
	assert.strictEqual(arr[arr.length - 1].d, '2026-07-12', 'newest kept is the 12th');
	console.log('PASS 3: 10-entry cap drops oldest');
}

// 4. Name-keying: the same exercise across A/B variations shares ONE history;
//    a different name is a separate list. (Keyed by name, not item id.)
{
	const store = makeStore();
	const api = load(store);
	api.appendExlog('Romanian deadlift', { d: '2026-07-01', w: 30, r: 12, e: false });
	api.appendExlog('Romanian deadlift', { d: '2026-07-15', w: 32.5, r: 12, e: true });
	api.appendExlog('Leg press', { d: '2026-07-15', w: 120, r: 10, e: false });
	assert.strictEqual(api.exlogEntries('Romanian deadlift').length, 2, 'same name accumulates');
	assert.strictEqual(api.exlogEntries('Leg press').length, 1, 'different name is separate');
	assert.strictEqual(api.exlogEntries('Never logged').length, 0, 'unknown name is empty');
	assert.strictEqual(api.lastExlogEntry('Never logged'), null, 'unknown name last is null');
	console.log('PASS 4: keyed by exercise name, one history per movement');
}

// 5. storageOK-off / broken store: appendExlog must NOT throw, must return false,
//    and must flip storageOK so the UI can warn (mirrors saveState, #51).
{
	const store = makeBrokenStore();
	const api = load(store);
	let threw = false;
	let ret;
	try {
		ret = api.appendExlog('Bench press', { d: '2026-07-14', w: 40, r: 10, e: false });
	} catch (e) {
		threw = true;
	}
	assert.strictEqual(threw, false, 'append never throws on a broken store');
	assert.strictEqual(ret, false, 'append returns false on write failure');
	assert.strictEqual(api.storageOK, false, 'failed write flips storageOK');
	console.log('PASS 5: broken store — no throw, returns false, flips storageOK');
}

// 6. Corrupt / wrong-shape store falls back to empty rather than throwing.
{
	const store = makeStore({ exlog: '{not json' });
	const api = load(store);
	eq(api.loadExlog(), {}, 'corrupt JSON reads as empty');
	eq(api.exlogEntries('anything'), [], 'entries empty on corrupt store');
	// An array at the top level is the wrong shape — also treated as empty.
	store.setItem('exlog', JSON.stringify(['nope']));
	eq(load(store).loadExlog(), {}, 'wrong-shape (array) reads as empty');
	console.log('PASS 6: corrupt / wrong-shape store falls back to empty');
}

// 7. Blank numerals (w/r null) round-trip — bodyweight or reps-only entries.
{
	const store = makeStore();
	const api = load(store);
	api.appendExlog('Plank', { d: '2026-07-14', w: null, r: 60, e: false });
	eq(api.lastExlogEntry('Plank'), { d: '2026-07-14', w: null, r: 60, e: false });
	console.log('PASS 7: null weight round-trips (bodyweight/reps-only)');
}

console.log('\nALL EXLOG TESTS PASSED');
