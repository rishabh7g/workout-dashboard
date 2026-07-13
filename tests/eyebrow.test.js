// Standalone unit test for the header eyebrow's week label (#55).
// The week fragment must reflect the REAL calendar position (realKey) while the
// Front/Back parity keeps describing the borrowed workout's home week
// (effectiveKey). The repo has no test framework; run with:
//   node tests/eyebrow.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Load the pure domain deps (data.js + workout.js), then pull just the
// eyebrowLabel function out of ui.js so ui.js's DOM-touching top level never
// runs. The extracted function closes over weekNumber/TOTAL_WEEKS/getWeekType.
const dataSrc = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const workoutSrc = fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');

const m = uiSrc.match(/function eyebrowLabel\(entry, realKey, effectiveKey\) \{[\s\S]*?\n\}/);
assert.ok(m, 'eyebrowLabel(entry, realKey, effectiveKey) must exist in js/ui.js');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
	dataSrc + '\n' + workoutSrc + '\n' + m[0] + '\nthis.__label = eyebrowLabel; this.__sched = SCHEDULE;',
	ctx
);
const eyebrowLabel = ctx.__label;
const SCHEDULE = ctx.__sched;

// 1. Outside program (past end / far future) — never a count above 26.
{
	assert.strictEqual(eyebrowLabel(SCHEDULE['2026-11-23'], '2026-11-23', '2026-11-23'), 'Outside program');
	assert.strictEqual(eyebrowLabel(SCHEDULE['2026-12-25'], '2026-12-25', '2026-12-25'), 'Outside program');
	console.log('PASS 1: post-program dates render "Outside program"');
}

// 2. Opening weekend (week 0) — never reads "Week 0".
{
	const sat = eyebrowLabel(SCHEDULE['2026-05-23'], '2026-05-23', '2026-05-23');
	const sun = eyebrowLabel(SCHEDULE['2026-05-24'], '2026-05-24', '2026-05-24');
	assert.ok(sat.startsWith('Opening Weekend'), `expected Opening Weekend, got "${sat}"`);
	assert.ok(sun.startsWith('Opening Weekend'), `expected Opening Weekend, got "${sun}"`);
	console.log('PASS 2: opening weekend renders "Opening Weekend"');
}

// 3. Normal in-program dates render the true week count.
{
	assert.ok(eyebrowLabel(SCHEDULE['2026-05-25'], '2026-05-25', '2026-05-25').startsWith('Week 1 / 26'));
	assert.ok(eyebrowLabel(SCHEDULE['2026-11-22'], '2026-11-22', '2026-11-22').startsWith('Week 26 / 26'));
	console.log('PASS 3: normal dates render the true week count');
}

// 4. Borrowed day: real week (8) with the borrowed workout's parity/Var.
//    2026-07-14 (week 8) borrowing 2026-07-21 (week 9, Back Week, Var A).
{
	const borrowed = eyebrowLabel(SCHEDULE['2026-07-21'], '2026-07-14', '2026-07-21');
	assert.strictEqual(borrowed, 'Week 8 / 26 · Back Week · Var A', `got "${borrowed}"`);
	// After undo the real day shows its own parity (Front Week, Var A).
	const undone = eyebrowLabel(SCHEDULE['2026-07-14'], '2026-07-14', '2026-07-14');
	assert.strictEqual(undone, 'Week 8 / 26 · Front Week · Var A', `got "${undone}"`);
	console.log('PASS 4: borrowed day uses real week + borrowed parity');
}

console.log('\nALL EYEBROW TESTS PASSED');
