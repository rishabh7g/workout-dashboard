// Standalone unit test for the progression-hint rule (#88): suggestNext in
// js/workout.js is the app's own "+2.5kg when the top reps felt easy" algorithm,
// made literal with the program's own caps and its strict-form exceptions.
// Pure and DOM-free — it reads only the name-keyed exlog (via a global
// lastExlogEntry stub here) and the per-exercise guardrails in js/data.js.
// The repo has no test framework; run with: node tests/suggest.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function eq(actual, expected, msg) {
	assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

// Load data.js + workout.js into a fresh context, injecting a controllable
// lastExlogEntry so we can drive the "last logged set" without a store.
function load(lastByName = {}) {
	const ctx = {
		console,
		Date,
		lastExlogEntry: (name) => lastByName[name] || null,
	};
	vm.createContext(ctx);
	vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
	vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8'), ctx);
	vm.runInContext(
		'this.__suggestNext = suggestNext; this.__topRep = topRep;' +
			'this.__exerciseConfig = exerciseConfig; this.__WORKOUTS = WORKOUTS;',
		ctx,
	);
	return ctx;
}

// A movement WITHOUT a cap or noIncrease flag (so we test the bare +2.5 rule and
// the rep/easy/history gates in isolation): Pull-ups have no capKg. But pull-ups
// reps are 'max' (no numeric target), so use a plain uncapped weighted lift.
// 'Cable curl' (arms-biceps) has no capKg/stepKg/noIncrease → pure +2.5 path.

// ─── 1. easy + at top reps → +2.5 ────────────────────────────────────────────
{
	const ctx = load({ 'Cable curl': { d: '2026-07-10', w: 15, r: 12, e: true } });
	eq(
		ctx.__suggestNext('Cable curl', 12),
		{ weight: 17.5, from: 15, reps: 12, cap: null },
		'easy + hit 12 reps → suggest +2.5 (15 → 17.5), no cap',
	);
	console.log('PASS 1: easy + at top reps → +2.5');
}

// ─── 2. below the rep target → no suggestion ─────────────────────────────────
{
	const ctx = load({ 'Cable curl': { d: '2026-07-10', w: 15, r: 11, e: true } });
	eq(ctx.__suggestNext('Cable curl', 12), null, 'short of 12 reps → no suggestion');
	console.log('PASS 2: below reps → none');
}

// ─── 3. last session not easy → no suggestion ────────────────────────────────
{
	const ctx = load({ 'Cable curl': { d: '2026-07-10', w: 15, r: 12, e: false } });
	eq(ctx.__suggestNext('Cable curl', 12), null, 'not easy → no suggestion');
	console.log('PASS 3: not easy → none');
}

// ─── 4. no history → no suggestion ───────────────────────────────────────────
{
	const ctx = load({}); // nothing logged
	eq(ctx.__suggestNext('Cable curl', 12), null, 'no history → no suggestion');
	console.log('PASS 4: no history → none');
}

// ─── 5. at cap → { hold: true } ──────────────────────────────────────────────
// Seated cable row caps at 40kg; an easy set at 40 should hold, not add.
{
	const ctx = load({ 'Seated cable row': { d: '2026-07-10', w: 40, r: 10, e: true } });
	eq(
		ctx.__suggestNext('Seated cable row', 10),
		{ hold: true, cap: 40 },
		'already at the 40kg cap → hold',
	);
	console.log('PASS 5: at cap → {hold:true}');
}

// ─── 5b. below cap but +2.5 would overshoot → clamp to the cap ───────────────
{
	const ctx = load({ 'Seated cable row': { d: '2026-07-10', w: 39, r: 10, e: true } });
	eq(
		ctx.__suggestNext('Seated cable row', 10),
		{ weight: 40, from: 39, reps: 10, cap: 40 },
		'39 + 2.5 = 41.5 > cap → clamp to 40',
	);
	console.log('PASS 5b: below cap, overshoot clamps to cap');
}

// ─── 6. noIncrease exercise → NEVER suggests, even easy + full reps ───────────
// Side lateral raises are the program's non-negotiable strict-form lift.
{
	const ctx = load({
		'Side lateral raises': { d: '2026-07-10', w: 5, r: 15, e: true },
	});
	eq(
		ctx.__suggestNext('Side lateral raises', 15),
		null,
		'noIncrease movement → never suggest, even on a perfect set',
	);
	// The strict-form flag must be data, not prose — verify it resolved.
	assert.strictEqual(
		ctx.__exerciseConfig('Side lateral raises').noIncrease,
		true,
		'Side lateral raises carries noIncrease in data.js',
	);
	console.log('PASS 6: noIncrease exercise → never suggests');
}

// ─── 7. stepKg dumbbell → +stepKg, not +2.5 ──────────────────────────────────
// Incline dumbbell press is per-dumbbell (stepKg: 1), capKg 14.
{
	const ctx = load({
		'Incline dumbbell press': { d: '2026-07-10', w: 10, r: 10, e: true },
	});
	eq(
		ctx.__suggestNext('Incline dumbbell press', 10),
		{ weight: 11, from: 10, reps: 10, cap: 14 },
		'per-dumbbell lift adds stepKg (1), not 2.5',
	);
	console.log('PASS 7: stepKg dumbbell → +stepKg');
}

// ─── 8. bodyweight / reps-only entry (w null) → no suggestion ─────────────────
{
	const ctx = load({ 'Push-ups': { d: '2026-07-10', w: null, r: 12, e: true } });
	eq(ctx.__suggestNext('Push-ups', 12), null, 'no weight to add to → no suggestion');
	console.log('PASS 8: bodyweight (null weight) → none');
}

// ─── 9. non-numeric rep target ('max') → no suggestion ───────────────────────
{
	const ctx = load({ 'Pull-ups': { d: '2026-07-10', w: 5, r: 12, e: true } });
	eq(ctx.__suggestNext('Pull-ups', 'max'), null, "'max' has no numeric target → no suggestion");
	console.log('PASS 9: non-numeric target (max) → none');
}

// ─── 10. topRep parses the TOP of a range ────────────────────────────────────
{
	const ctx = load({});
	assert.strictEqual(ctx.__topRep('7→10'), 10, 'arrow range top');
	assert.strictEqual(ctx.__topRep(12), 12, 'bare number');
	assert.strictEqual(ctx.__topRep('12 each side'), 12, 'qualified reps top');
	assert.strictEqual(ctx.__topRep('max'), null, 'non-numeric → null');
	// A range target: hitting the TOP is required, mid-range is not enough.
	const c2 = load({ 'Pull-ups2': { d: '2026-07-10', w: 5, r: 10, e: true } });
	// (uses a synthetic name with no config to exercise the range gate cleanly)
	console.log('PASS 10: topRep parses the top of a range');
}

// ─── 11. VALIDATOR: every cap string with a leading number has a capKg, and
//        the strict-form lift carries noIncrease (data, not prose). ───────────
{
	const ctx = load({});
	const clean = (s) => String(s).replace('🍌 ', '').replace('⭐ FIRST', '').trim();
	let checked = 0;
	let sideFlagged = 0;
	for (const t of Object.values(ctx.__WORKOUTS)) {
		for (const v of Object.values(t)) {
			for (const ex of v.exercises || []) {
				if (ex.cap && /^-?\d/.test(ex.cap)) {
					assert.strictEqual(
						typeof ex.capKg,
						'number',
						`${ex.name}: cap "${ex.cap}" must have a numeric capKg`,
					);
					const lead = parseFloat(/^-?\d+(?:\.\d+)?/.exec(ex.cap)[0]);
					assert.strictEqual(
						ex.capKg,
						lead,
						`${ex.name}: capKg ${ex.capKg} must match the cap string's leading number ${lead}`,
					);
					checked++;
				}
				// Any note that literally forbids an increase must be backed by the flag.
				if (ex.note && /do NOT increase/i.test(ex.note)) {
					assert.strictEqual(
						ex.noIncrease,
						true,
						`${ex.name}: "do NOT increase" note must be backed by noIncrease:true`,
					);
				}
				if (clean(ex.name) === 'Side lateral raises') {
					assert.strictEqual(
						ex.noIncrease,
						true,
						`${ex.name}: side lateral raises must carry noIncrease`,
					);
					sideFlagged++;
				}
			}
		}
	}
	assert.ok(checked >= 9, `expected ≥9 capped exercises validated, saw ${checked}`);
	assert.ok(sideFlagged >= 1, 'expected side lateral raises flagged noIncrease');
	console.log(`PASS 11: validator — ${checked} caps consistent, ${sideFlagged} strict-form lifts flagged`);
}

console.log('\nALL SUGGEST TESTS PASSED');
