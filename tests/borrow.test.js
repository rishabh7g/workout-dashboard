// Standalone unit test for the no-op borrow skip (#60).
// Borrowing a day whose workout is identical to today's (same type +
// variation) collapses onto today's own storage key, so doBorrow must NOT
// write a borrow entry — it just closes the sheet. Borrowing a genuinely
// different day still writes normally. The repo has no test framework; run:
//   node tests/borrow.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Pull just doBorrow out of ui.js so ui.js's DOM-touching top level never runs,
// and provide stubs for its free variables (storage, DOM, render).
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const m = uiSrc.match(/function doBorrow\(targetKey\) \{[\s\S]*?\n\}/);
assert.ok(m, 'doBorrow(targetKey) must exist in js/ui.js');

// Real stateKey from storage.js — the guard compares keys, so use the actual
// implementation rather than reimplementing it.
const storageSrc = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const skMatch = storageSrc.match(/function stateKey\(dayKey, entry\) \{[\s\S]*?\n\}/);
assert.ok(skMatch, 'stateKey must exist in js/storage.js');

function makeCtx(schedule, tk) {
	let saved = null;
	let closed = false;
	let rendered = false;
	const ctx = {
		console,
		SCHEDULE: schedule,
		todayKey: () => tk,
		loadBorrows: () => ({}),
		saveBorrows: (b) => { saved = b; },
		closeSwapSheet: () => { closed = true; },
		render: () => { rendered = true; },
		// doBorrow now announces the swap via the #sr-status live region (#77);
		// stub the helpers it calls so the isolated extraction runs.
		announce: () => {},
		shortDayLabel: () => '',
	};
	vm.createContext(ctx);
	vm.runInContext(skMatch[0] + '\n' + m[0] + '\nthis.__doBorrow = doBorrow;', ctx);
	return {
		doBorrow: ctx.__doBorrow,
		state: () => ({ get saved() { return saved; }, get closed() { return closed; }, get rendered() { return rendered; } }),
	};
}

// 1. Identical workout (same type + variation) — no write, sheet closes, no render.
{
	const sched = { 'T': { type: 'running', variation: 'A' }, 'X': { type: 'running', variation: 'A' } };
	const h = makeCtx(sched, 'T');
	h.doBorrow('X');
	const s = h.state();
	assert.strictEqual(s.saved, null, 'no-op borrow must not write a borrow entry');
	assert.strictEqual(s.closed, true, 'no-op borrow must still close the sheet');
	assert.strictEqual(s.rendered, false, 'no-op borrow must not re-render');
	console.log('PASS 1: identical-workout borrow writes nothing and closes the sheet');
}

// 2. Different workout — normal write under today's key + render.
{
	const sched = { 'T': { type: 'running', variation: 'A' }, 'X': { type: 'shoulders', variation: 'B' } };
	const h = makeCtx(sched, 'T');
	h.doBorrow('X');
	const s = h.state();
	assert.deepStrictEqual(s.saved, { 'T': 'X' }, 'different-workout borrow must persist target under todayKey');
	assert.strictEqual(s.closed, true);
	assert.strictEqual(s.rendered, true, 'different-workout borrow must re-render');
	console.log('PASS 2: different-workout borrow persists and re-renders (borrow path intact)');
}

// 3. Same type but different variation — a real distinction, must still write.
{
	const sched = { 'T': { type: 'shoulders', variation: 'A' }, 'X': { type: 'shoulders', variation: 'B' } };
	const h = makeCtx(sched, 'T');
	h.doBorrow('X');
	assert.deepStrictEqual(h.state().saved, { 'T': 'X' }, 'differing variation is not a no-op');
	console.log('PASS 3: same type / different variation still borrows');
}

// 4. Real schedule regression: the audited identical pair (2026-05-23 vs
//    2026-05-30, both running/A) is a no-op; the different pair still borrows.
{
	const dataSrc = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
	const dctx = { console };
	vm.createContext(dctx);
	vm.runInContext(dataSrc + '\nthis.__s = SCHEDULE;', dctx);
	const SCHEDULE = dctx.__s;

	const same = makeCtx(SCHEDULE, '2026-05-23');
	same.doBorrow('2026-05-30');
	assert.strictEqual(same.state().saved, null, '2026-05-23 borrowing identical 2026-05-30 must be a no-op');

	const diff = makeCtx(SCHEDULE, '2026-07-14');
	diff.doBorrow('2026-07-21');
	assert.deepStrictEqual(diff.state().saved, { '2026-07-14': '2026-07-21' }, 'genuinely different borrow still works');
	console.log('PASS 4: real-schedule identical pair is a no-op; different pair borrows');
}

console.log('\nALL BORROW TESTS PASSED');
