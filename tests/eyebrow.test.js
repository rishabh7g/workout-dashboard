// Standalone unit test for the header eyebrow's week label (#55, #194).
// The week fragment must reflect the REAL calendar position (realKey) while the
// Front/Back parity keeps describing the borrowed workout's home week
// (effectiveKey). Since #194 the number shown is the position inside the
// repeating four-week cycle, not an unbounded count against a program length.
// The repo has no test framework; run with:
//   node tests/eyebrow.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Load the pure domain deps (data.js + workout.js) and the strings bundle
// (js/strings.js, #175 — eyebrowLabel's non-dynamic copy reads t()), then pull
// just the eyebrowLabel function out of ui.js so ui.js's DOM-touching top
// level never runs. The extracted function closes over
// weekNumber/cycleWeek/CYCLE_WEEKS/getWeekType.
const dataSrc = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const workoutSrc = fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8');
const stringsSrc = fs.readFileSync(path.join(__dirname, '../js/strings.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');

const m = uiSrc.match(/function eyebrowLabel\(entry, realKey, effectiveKey\) \{[\s\S]*?\n\}/);
assert.ok(m, 'eyebrowLabel(entry, realKey, effectiveKey) must exist in js/ui.js');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
	stringsSrc + '\n' + dataSrc + '\n' + workoutSrc + '\n' + m[0] + '\nthis.__label = eyebrowLabel; this.__sched = scheduleFor;',
	ctx
);
const eyebrowLabel = ctx.__label;
const scheduleFor = ctx.__sched;
const label = (key, effectiveKey = key) =>
	eyebrowLabel(scheduleFor(effectiveKey), key, effectiveKey);

// 1. Dates the schedule doesn't cover — only pre-start dates, since #194.
//    A date past the old 2026-11-22 end is now an ordinary training day.
{
	assert.strictEqual(label('2026-05-22'), 'Outside program');
	assert.strictEqual(label('2020-01-01'), 'Outside program');
	assert.ok(label('2026-11-23').startsWith('Week '), 'the day after the old end date is a normal week');
	assert.ok(label('2031-03-17').startsWith('Week '), 'years out is still a normal week');
	console.log('PASS 1: only pre-start dates render "Outside program"');
}

// 2. Opening weekend (week 0) — never reads "Week 0".
{
	const sat = label('2026-05-23');
	const sun = label('2026-05-24');
	assert.ok(sat.startsWith('Opening Weekend'), `expected Opening Weekend, got "${sat}"`);
	assert.ok(sun.startsWith('Opening Weekend'), `expected Opening Weekend, got "${sun}"`);
	console.log('PASS 2: opening weekend renders "Opening Weekend"');
}

// 3. The number is the cycle position, and it never exceeds the cycle length.
//    Program weeks 1..5 → cycle weeks 1,2,3,4,1 — and a date a decade out still
//    lands inside 1..4 rather than reading "Week 500 / 26".
{
	assert.ok(label('2026-05-25').startsWith('Week 1 / 4'), `got "${label('2026-05-25')}"`);
	assert.ok(label('2026-06-01').startsWith('Week 2 / 4'), `got "${label('2026-06-01')}"`);
	assert.ok(label('2026-06-08').startsWith('Week 3 / 4'), `got "${label('2026-06-08')}"`);
	assert.ok(label('2026-06-15').startsWith('Week 4 / 4'), `got "${label('2026-06-15')}"`);
	assert.ok(label('2026-06-22').startsWith('Week 1 / 4'), `got "${label('2026-06-22')}"`);
	for (const k of ['2026-11-23', '2027-06-01', '2036-02-29']) {
		const m2 = /^Week (\d+) \/ (\d+)/.exec(label(k));
		assert.ok(m2, `expected a week fragment for ${k}, got "${label(k)}"`);
		assert.ok(Number(m2[1]) >= 1 && Number(m2[1]) <= Number(m2[2]), `${k}: week ${m2[1]} outside 1..${m2[2]}`);
	}
	console.log('PASS 3: the week fragment is a bounded cycle position');
}

// 4. Borrowed day: real week with the borrowed workout's parity/Var.
//    2026-07-14 (cycle week 4) borrowing 2026-07-21 (Back Week, Var A).
{
	const borrowed = label('2026-07-14', '2026-07-21');
	assert.strictEqual(borrowed, 'Week 4 / 4 · Back Week · Var A', `got "${borrowed}"`);
	// After undo the real day shows its own parity (Front Week, Var A).
	const undone = label('2026-07-14');
	assert.strictEqual(undone, 'Week 4 / 4 · Front Week · Var A', `got "${undone}"`);
	console.log('PASS 4: borrowed day uses real week + borrowed parity');
}

console.log('\nALL EYEBROW TESTS PASSED');
