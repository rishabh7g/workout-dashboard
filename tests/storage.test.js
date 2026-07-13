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
function load(store) {
	const ctx = { localStorage: store, console };
	vm.createContext(ctx);
	vm.runInContext(
		src +
			'\nthis.__api = { saveState, loadState, get definitionChanged(){return definitionChanged;}, set completedItems(v){completedItems=v;}, set allItems(v){allItems=v;}, get storageOK(){return storageOK;} };',
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

console.log('\nALL TESTS PASSED');
