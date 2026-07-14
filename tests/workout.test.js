// Standalone unit test for js/workout.js (#56, #64).
// The repo has no test framework; run with: node tests/workout.test.js
//
// Covers three contracts:
//   1. splitReps — reshaped (#64) to expose the bare reps numeral and any
//      trailing "each …" qualifier separately, so the Modernist row can render
//      sets and reps as SEPARATE fields (WD blueprint, design/workout-data.js).
//   2. buildItemList item SHAPE — every strength item exposes `sets`/`reps`
//      separately with `sub` carrying weight + qualifier; timed cardio and
//      free-text items use `sub` alone.
//   3. ID STABILITY — the positional item ids (`${sec}-${counts[sec]}`) are the
//      localStorage tick keys (js/storage.js v1 envelope). This test pins the
//      id sequence of every schedule workout so a refactor can NEVER silently
//      re-bind a saved tick to a different exercise.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Load data.js + workout.js in a fresh context. data.js supplies SCHEDULE /
// WORKOUTS / RUNNING_DAYS / CORE; workout.js supplies buildItemList + splitReps.
const ctx = { console, Date };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8'), ctx);
// `const` declarations don't attach to the vm context object, so re-export the
// globals we need onto `this` from inside the context.
vm.runInContext(
	'this.__splitReps = splitReps; this.__buildItemList = buildItemList;' +
		'this.__SCHEDULE = SCHEDULE; this.__WORKOUTS = WORKOUTS; this.__RUNNING_DAYS = RUNNING_DAYS;',
	ctx,
);
const splitReps = ctx.__splitReps;
const buildItemList = ctx.__buildItemList;
const SCHEDULE = ctx.__SCHEDULE;
const WORKOUTS = ctx.__WORKOUTS;
const RUNNING_DAYS = ctx.__RUNNING_DAYS;
assert.strictEqual(typeof splitReps, 'function', 'splitReps must exist in js/workout.js');
assert.strictEqual(typeof buildItemList, 'function', 'buildItemList must exist in js/workout.js');

// ─── 1. splitReps contract (#64) ─────────────────────────────────────────────
// New contract: splitReps only peels a trailing "each …" qualifier off a bare
// leading number ('10 each leg' → {reps:'10', sub:'each leg'}). Everything else
// — ranges, timed reps, 'steps' qualifiers, 'max', free text — passes through
// whole as `reps` with sub:null, so ranges and 'max' still land in the numeral
// block and fixed-qualifier conditioning items carry their split at the call
// site. Keyed by the literal reps value from js/data.js.
const table = [
	// [input, expected reps, expected sub]
	[12, '12', null],                                   // bare numeric → whole numeral
	['7→10', '7→10', null],                              // arrow range → whole numeral, no split
	['10 each leg', '10', 'each leg'],                   // the one shape that splits
	['12 each side', '12', 'each side'],
	['8 each side', '8', 'each side'],
	['10 each foot', '10', 'each foot'],
	['10 each direction', '10', 'each direction'],
	['25 sec each', '25 sec each', null],                // group must start with 'each' → no split
	['45 sec', '45 sec', null],                          // timed, no 'each' → whole numeral
	['15 steps each direction', '15 steps each direction', null], // 'steps' blocks the split
	['10 steps', '10 steps', null],
	['1–2 min', '1–2 min', null],                        // en-dash range → whole, no split
	['1 length', '1 length', null],                      // free text with leading number → whole
	['max', 'max', null],                                // no leading digit-run → whole (renders 3×max)
	['one pass each foot', 'one pass each foot', null],  // no leading digit → whole
	['30m → 20m → 10m', '30m → 20m → 10m', null],        // 'm' after digits → whole
];

for (const [input, reps, sub] of table) {
	const got = splitReps(input);
	assert.strictEqual(got.reps, reps, `splitReps(${JSON.stringify(input)}).reps expected ${JSON.stringify(reps)}, got ${JSON.stringify(got.reps)}`);
	assert.strictEqual(got.sub, sub, `splitReps(${JSON.stringify(input)}).sub expected ${JSON.stringify(sub)}, got ${JSON.stringify(got.sub)}`);
}
console.log(`PASS 1: ${table.length} distinct reps shapes split exactly as documented`);

// ─── 2. buildItemList item shape (#64) ───────────────────────────────────────
// Build one representative gym day (arms-biceps A carries the 'max' case) and
// assert the new contract: sets/reps separate, sub = weight + qualifier.
{
	const w = WORKOUTS['arms-biceps']['A'];
	const items = buildItemList(w);
	const byId = Object.fromEntries(items.map((i) => [i.id, i]));

	// Pull-ups reps 'max' → now a numeral block (3×max), not fused into meta.
	const pullups = items.find((i) => i.label === 'Pull-ups');
	assert.ok(pullups, 'arms-biceps A must contain Pull-ups');
	assert.strictEqual(pullups.sets, 3, 'Pull-ups sets exposed');
	assert.strictEqual(pullups.reps, 'max', "Pull-ups reps flow through as 'max' → renders 3×max");

	// A weighted exercise: sub = weight + qualifier joined with ' · '.
	const cableCurl = items.find((i) => i.label === 'Cable curl');
	assert.ok(cableCurl, 'arms-biceps A must contain Cable curl');
	assert.strictEqual(cableCurl.reps, '12', 'reps kept separate from sets');
	assert.strictEqual(cableCurl.sub, '15kg', 'weight lands in sub');

	// Ankle conditioning: fixed-qualifier item split literally at the call site.
	const bandWalks = byId['ankle-3'];
	assert.strictEqual(bandWalks.reps, '15', 'band walks numeral byte-identical (3×15)');
	assert.strictEqual(bandWalks.sub, 'steps each direction', 'qualifier moved to sub');

	// Timed cardio: no numeral block; duration lives in the sub line.
	const cardio = byId['cardio-1'];
	assert.strictEqual(cardio.sets, undefined, 'timed cardio exposes no sets');
	assert.ok(/^10 min/.test(cardio.sub), 'timed cardio duration in sub line');

	// No item carries the retired scheme/meta fields.
	for (const it of items) {
		assert.strictEqual(it.scheme, undefined, `${it.id} must not carry the old scheme field`);
		assert.strictEqual(it.meta, undefined, `${it.id} must not carry the old meta field`);
	}
	console.log('PASS 2: item shape exposes sets/reps separately with sub; no scheme/meta fields');
}

// ─── 3. ID STABILITY across the whole schedule (#64) ─────────────────────────
// Golden id sequences captured from the pre-#64 code, keyed by workout
// signature (`type|variation`). Item ids are purely positional, so identical
// workouts produce identical id sequences; asserting per unique signature and
// iterating all schedule days proves every one of the 158 non-rest entries is
// byte-identical before/after the refactor (stored ticks keep their meaning).
const GOLDEN_IDS = {
	strength10a: ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ex-5', 'core-1', 'core-2', 'core-3', 'core-4', 'cardio-1'],
	strength8: ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'core-1', 'core-2', 'core-3', 'cardio-1'],
	strength9: ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ex-5', 'core-1', 'core-2', 'core-3', 'cardio-1'],
	arms3: ['ex-1', 'ex-2', 'ex-3', 'ankle-1', 'ankle-2', 'ankle-3', 'cardio-1'],
	arms4: ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ankle-1', 'ankle-2', 'ankle-3', 'cardio-1'],
	legs4: ['warmup-1', 'warmup-2', 'warmup-3', 'ex-1', 'ex-2', 'ex-3', 'ex-4', 'finisher-1', 'finisher-2', 'cardio-1'],
	legs3: ['warmup-1', 'warmup-2', 'warmup-3', 'ex-1', 'ex-2', 'ex-3', 'finisher-1', 'finisher-2', 'cardio-1'],
	run: ['stretch-1', 'stretch-2', 'stretch-3', 'stretch-4', 'stretch-5', 'stretch-6', 'stretch-7', 'stretch-8', 'drills-1', 'drills-2', 'drills-3', 'drills-4', 'drills-5', 'drills-6', 'drills-7', 'drills-8', 'drills-9', 'run-1', 'cooldown-1', 'cooldown-2', 'cooldown-3', 'cooldown-4', 'cooldown-5', 'cooldown-6', 'cooldown-7', 'cooldown-8'],
};
const SIG_GOLDEN = {
	'running|A': GOLDEN_IDS.run,
	'running|B': GOLDEN_IDS.run,
	'recovery|A': GOLDEN_IDS.run,
	'recovery|B': GOLDEN_IDS.run,
	'legs-hamstrings|A': GOLDEN_IDS.legs4,
	'legs-hamstrings|B': GOLDEN_IDS.legs3,
	'legs-quads|A': GOLDEN_IDS.legs4,
	'legs-quads|B': GOLDEN_IDS.legs3,
	'back|A': GOLDEN_IDS.strength10a,
	'back|B': GOLDEN_IDS.strength10a,
	'chest|A': GOLDEN_IDS.strength10a,
	'chest|B': GOLDEN_IDS.strength10a,
	'shoulders|A': GOLDEN_IDS.strength8,
	'shoulders|B': GOLDEN_IDS.strength9,
	'arms-triceps|A': GOLDEN_IDS.arms3,
	'arms-triceps|B': GOLDEN_IDS.arms3,
	'arms-biceps|A': GOLDEN_IDS.arms4,
	'arms-biceps|B': GOLDEN_IDS.arms4,
};

let resolved = 0;
let restDays = 0;
const seenSigs = new Set();
for (const dayKey of Object.keys(SCHEDULE)) {
	const e = SCHEDULE[dayKey];
	const sig = `${e.type}|${e.variation || 'x'}`;
	const table = WORKOUTS[e.type] || RUNNING_DAYS[e.type];
	const workout = table ? table[e.variation] : null;
	if (!workout) {
		restDays++;
		continue;
	}
	seenSigs.add(sig);
	const golden = SIG_GOLDEN[sig];
	assert.ok(golden, `No golden id sequence pinned for signature ${sig} — add it to SIG_GOLDEN`);
	const ids = buildItemList(workout).map((i) => i.id);
	// JSON compare sidesteps vm cross-realm Array prototype mismatch.
	assert.strictEqual(
		JSON.stringify(ids),
		JSON.stringify(golden),
		`ID sequence changed for ${dayKey} (${sig}) — stored ticks would re-bind to different exercises`,
	);
	resolved++;
}
assert.strictEqual(resolved, 158, `expected 158 non-rest schedule entries, saw ${resolved}`);
assert.strictEqual(resolved + restDays, 184, 'expected 184 total schedule days');
assert.strictEqual(seenSigs.size, 18, `expected 18 unique non-rest workout signatures, saw ${seenSigs.size}`);
console.log(`PASS 3: id sequences byte-identical across all ${resolved} non-rest schedule days (${seenSigs.size} signatures)`);

console.log('\nALL WORKOUT TESTS PASSED');
