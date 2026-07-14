// Standalone unit test for the one-tap backup store (serialize / validate /
// restore) in js/storage.js (#89). The repo has no test framework; run with:
//   node tests/backup.test.js
//
// Focus: the atomicity contract. Import is replace-all and destructive, so a
// malformed or unversioned file must be rejected BEFORE anything is cleared and
// the state must be left byte-identical. These cases prove round-trip fidelity,
// full pre-clear validation, and replace-all semantics.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

// vm-realm objects carry a foreign prototype; compare by JSON shape.
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

// A snapshot of a store's contents as a plain object, for diffing state.
function dump(store) {
	const out = {};
	for (const [k, v] of store.map) out[k] = v;
	return out;
}

function load(store, today = '2026-07-14') {
	const ctx = { localStorage: store, console, todayKey: () => today };
	vm.createContext(ctx);
	vm.runInContext(
		src +
			'\nthis.__api = { serializeBackup, validateBackup, restoreBackup, recordExport, lastExportDate, get storageOK(){return storageOK;}, set storageOK(v){storageOK=v;} };',
		ctx,
	);
	return ctx.__api;
}

// A representative seed: a v1 tick envelope, a quarantined corrupt record, a
// borrow map, and a prior last-export marker. Covers the ws-, ws-corrupt-,
// day-borrow and non-ws- marker key shapes the generic enumeration must sweep.
function seedState() {
	return {
		'ws-2026-07-14-back-A': JSON.stringify({ v: 1, n: 3, done: ['ex-1', 'ex-2'] }),
		'ws-corrupt-2026-07-01': '{broken',
		'day-borrow': JSON.stringify({ '2026-07-14': '2026-07-18' }),
		'last-export': '2026-07-10T09:00:00.000Z',
	};
}

// 1. Round-trip: export → wipe → import reproduces an identical key set/values.
{
	const seed = seedState();
	const store = makeStore(seed);
	const api = load(store);

	const backup = api.serializeBackup();
	assert.strictEqual(backup.schema, 1, 'export carries schema 1');
	assert.ok(typeof backup.exported === 'string', 'export carries an ISO date');

	// Serialize is read-only: the store is unchanged by the export.
	eq(dump(store), seed, 'serializeBackup does not mutate the store');

	// Wipe the device, then restore from the (JSON-cloned) backup.
	store.map.clear();
	assert.strictEqual(store.length, 0, 'store wiped');
	const ok = api.restoreBackup(JSON.parse(JSON.stringify(backup)));
	assert.strictEqual(ok, true, 'restore of a valid backup succeeds');

	eq(dump(store), seed, 'restore reproduces the exact key set and values');
	console.log('PASS 1: export → wipe → import round-trips identically');
}

// 2. ws-probe (transient boot probe) is excluded from the export set.
{
	const seed = seedState();
	seed['ws-probe'] = '1';
	const store = makeStore(seed);
	const api = load(store);
	const backup = api.serializeBackup();
	assert.strictEqual(
		Object.prototype.hasOwnProperty.call(backup.data, 'ws-probe'),
		false,
		'ws-probe is not serialized',
	);
	assert.ok(backup.data['ws-2026-07-14-back-A'], 'real keys still serialized');
	console.log('PASS 2: ws-probe excluded from export');
}

// 3. Malformed JSON / bad shapes are rejected and NEVER partially apply.
{
	const api = load(makeStore());
	// validateBackup rejects the range of bad shapes.
	assert.strictEqual(api.validateBackup(null), false, 'null rejected');
	assert.strictEqual(api.validateBackup([]), false, 'array rejected');
	assert.strictEqual(api.validateBackup({ data: {} }), false, 'missing schema rejected');
	assert.strictEqual(
		api.validateBackup({ schema: 2, data: {} }),
		false,
		'wrong schema version rejected',
	);
	assert.strictEqual(
		api.validateBackup({ schema: 1 }),
		false,
		'missing data map rejected',
	);
	assert.strictEqual(
		api.validateBackup({ schema: 1, data: [] }),
		false,
		'array data map rejected',
	);
	assert.strictEqual(
		api.validateBackup({ schema: 1, data: { k: 5 } }),
		false,
		'non-string value rejected',
	);
	assert.strictEqual(
		api.validateBackup({ schema: 1, data: { 'ws-x': '{}' } }),
		true,
		'a well-formed backup validates',
	);
	console.log('PASS 3: validation rejects malformed / unversioned shapes');
}

// 4. restoreBackup on an invalid object leaves the store untouched (atomicity):
//    validate fully BEFORE clearing — a bad file must never wipe state.
{
	const seed = seedState();
	const store = makeStore(seed);
	const api = load(store);

	for (const bad of [null, [], { schema: 2, data: {} }, { schema: 1, data: { k: 3 } }, 'not-json']) {
		const ok = api.restoreBackup(bad);
		assert.strictEqual(ok, false, 'invalid backup returns false');
		eq(dump(store), seed, 'invalid restore leaves state fully intact');
	}
	console.log('PASS 4: invalid restore aborts with state untouched');
}

// 5. Replace-all: restore clears pre-existing keys NOT present in the file.
{
	const store = makeStore({
		'ws-2026-01-01-old': JSON.stringify({ v: 1, n: 1, done: ['ex-1'] }),
		'day-borrow': JSON.stringify({ '2026-01-01': '2026-01-05' }),
		'stale-key': 'leftover',
	});
	const api = load(store);
	const backup = {
		schema: 1,
		exported: '2026-07-14T00:00:00.000Z',
		data: { 'ws-2026-07-14-back-A': JSON.stringify({ v: 1, n: 2, done: ['ex-2'] }) },
	};
	const ok = api.restoreBackup(backup);
	assert.strictEqual(ok, true, 'valid restore succeeds');
	eq(
		dump(store),
		{ 'ws-2026-07-14-back-A': JSON.stringify({ v: 1, n: 2, done: ['ex-2'] }) },
		'pre-existing keys absent from the file are cleared',
	);
	console.log('PASS 5: replace-all clears pre-existing keys not in the file');
}

// 6. ws-probe is preserved across a restore (not treated as an app key).
{
	const store = makeStore({ 'ws-old': 'x' });
	const api = load(store);
	// Set the probe AFTER load — the boot round-trip probe removes it at load.
	store.setItem('ws-probe', '1');
	api.restoreBackup({ schema: 1, exported: 'x', data: { 'ws-new': 'y' } });
	assert.strictEqual(store.getItem('ws-probe'), '1', 'ws-probe survives restore');
	assert.strictEqual(store.getItem('ws-old'), null, 'app key cleared');
	assert.strictEqual(store.getItem('ws-new'), 'y', 'file key written');
	console.log('PASS 6: ws-probe untouched by restore-clear');
}

// 7. recordExport / lastExportDate persist under the non-ws- marker key.
{
	const store = makeStore();
	const api = load(store);
	assert.strictEqual(api.lastExportDate(), null, 'no marker initially');
	api.recordExport('2026-07-14T10:00:00.000Z');
	assert.strictEqual(store.getItem('last-export'), '2026-07-14T10:00:00.000Z', 'stored under last-export');
	assert.strictEqual(store.getItem('ws-last-export'), null, 'NOT ws- prefixed');
	assert.strictEqual(api.lastExportDate(), '2026-07-14T10:00:00.000Z', 'reads back');
	console.log('PASS 7: last-export marker persists under a non-ws- key');
}

console.log('\nALL BACKUP TESTS PASSED');
