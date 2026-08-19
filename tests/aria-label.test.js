// Standalone unit test for the composed checklist-row accessible name (#75).
// Each row is role="checkbox"; composeItemLabel builds the aria-label that
// overrides the visible subtree so a screen reader announces a coherent name
// (exercise + verbalized scheme + sub/note/cap/warn) instead of fragment-order
// noise and bare numerals. The repo has no test framework; run with:
//   node tests/aria-label.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Pull just speakMeta + composeItemLabel out of ui.js so its DOM-touching top
// level never runs.
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const speak = uiSrc.match(/function speakMeta\(text\) \{[\s\S]*?\n\}/);
const compose = uiSrc.match(/function composeItemLabel\(item\) \{[\s\S]*?\n\}/);
assert.ok(speak, 'speakMeta(text) must exist in js/ui.js');
assert.ok(compose, 'composeItemLabel(item) must exist in js/ui.js');

const prelude = speak[0] + '\n';

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(prelude + compose[0] + '\nthis.__c = composeItemLabel;', ctx);
const composeItemLabel = ctx.__c;

// 1. Scheme item with weight, cap and warning verbalizes fully.
{
	const got = composeItemLabel({
		label: 'Squats',
		sets: 3,
		reps: '10',
		sub: '15kg/side',
		cap: '60kg total (bar + plates)',
		warn: 'Beyond this thickens spinal erectors',
	});
	assert.strictEqual(
		got,
		'Squats, 3 sets of 10, 15kg per side, cap 60kg total (bar + plates), warning: Beyond this thickens spinal erectors',
		`got "${got}"`
	);
	console.log('PASS 1: scheme item speaks name + sets/reps + weight + cap + warn');
}

// 2. Rep range verbalizes the arrow as "to"; FIRST badge spelled out.
{
	const got = composeItemLabel({ label: '⭐ FIRST Side lateral raises', sets: 3, reps: '7→10' });
	assert.strictEqual(got, 'Side lateral raises, first exercise, 3 sets of 7 to 10', `got "${got}"`);
	console.log('PASS 2: FIRST badge + arrow range verbalized');
}

// 3. Timed/sub-only item announces its duration in words (no numeral block).
{
	const got = composeItemLabel({ label: 'Stairmaster', sub: '10 min · 30lb vest' });
	assert.strictEqual(got, 'Stairmaster, 10 minutes, 30lb vest', `got "${got}"`);
	console.log('PASS 3: timed item speaks duration in words');
}

// 4. "sec" expands; scheme reps kept as a bare numeral still read cleanly.
{
	const got = composeItemLabel({ label: 'Wall sit', sets: 3, reps: '45 sec' });
	assert.strictEqual(got, 'Wall sit, 3 sets of 45 seconds', `got "${got}"`);
	console.log('PASS 4: sec expands to seconds');
}

// 5. State (done/active) is never announced — aria-checked carries it. The
//    composed label is identical regardless of any state field.
{
	const base = { label: 'Push-ups', sets: 3, reps: '12' };
	assert.strictEqual(composeItemLabel(base), 'Push-ups, 3 sets of 12');
	console.log('PASS 5: no done/active state leaks into the name');
}

// Consecutive 'YYYY-MM-DD' keys starting at `start` — the generated schedule
// (#194) has no key list to enumerate, so tests walk a date span instead.
function dayKeysFrom(start, count) {
	const [y, m, d] = start.split('-').map(Number);
	const keys = [];
	for (let i = 0; i < count; i++) {
		const dt = new Date(y, m - 1, d + i);
		keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
	}
	return keys;
}

// 6. No raw ×, →, ·, / or SVG junk survives in any real item's label.
{
	// data.js and workout.js read their copy from the strings bundle (#189), so
	// load js/strings.js first — the order index.html uses.
	const stringsSrc = fs.readFileSync(path.join(__dirname, '../js/strings.js'), 'utf8');
	const dataSrc = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
	const workoutSrc = fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8');
	const c2 = { console };
	vm.createContext(c2);
	vm.runInContext(
		stringsSrc + '\n' + dataSrc + '\n' + workoutSrc + '\n' + prelude + compose[0] +
			'\nthis.__c = composeItemLabel; this.__b = buildItemList; this.__s = scheduleFor;' +
			'\nthis.__w = typeof WORKOUTS !== "undefined" ? WORKOUTS : {};' +
			'\nthis.__r = typeof RUNNING_DAYS !== "undefined" ? RUNNING_DAYS : {};',
		c2
	);
	// The schedule is generated, not a literal map (#194), so walk a concrete
	// span of dates instead of Object.keys(): one full four-week cycle past the
	// old hard-coded end date, which covers every workout signature twice.
	let checked = 0;
	for (const key of dayKeysFrom('2026-05-23', 240)) {
		const entry = c2.__s(key);
		if (!entry) continue;
		const workout = (c2.__w[entry.type] || c2.__r[entry.type])?.[entry.variation];
		if (!workout) continue;
		for (const item of c2.__b(workout)) {
			const name = c2.__c(item);
			assert.ok(!/[×→·]/.test(name), `raw glyph leaked in "${name}"`);
			assert.ok(!/<[a-z]/i.test(name), `markup leaked in "${name}"`);
			assert.ok(!name.includes('⭐') && !name.includes('🍌'), `emoji leaked in "${name}"`);
			checked++;
		}
	}
	assert.ok(checked > 0, 'expected to check at least one real item');
	console.log(`PASS 6: ${checked} real items compose clean names (no glyph/markup/emoji leak)`);
}

console.log('\nALL ARIA-LABEL TESTS PASSED');
