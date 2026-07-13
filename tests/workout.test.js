// Standalone unit test for js/workout.js splitReps (#56).
// splitReps' contract comment once claimed free-text reps ('1 length') return
// x:null; the regex actually splits any LEADING-number value. This table pins
// the REAL behaviour for every distinct reps shape in data.js so a future regex
// change that re-buckets a real value fails loudly with the value named.
// The repo has no test framework; run with: node tests/workout.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const workoutSrc = fs.readFileSync(path.join(__dirname, '../js/workout.js'), 'utf8');

// Load workout.js in a fresh context and pull out splitReps. data.js is not
// needed — splitReps is a pure string function with no external dependency.
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(workoutSrc + '\nthis.__splitReps = splitReps;', ctx);
const splitReps = ctx.__splitReps;
assert.strictEqual(typeof splitReps, 'function', 'splitReps must exist in js/workout.js');

// Regression table: every distinct reps shape that exists in js/data.js, mapped
// to splitReps' exact current output. Keyed by the literal reps value.
const table = [
	// [input, expected x, expected rest]
	[12, '12', ''],                              // bare numeric → scheme, no qualifier
	['7→10', '7→10', ''],                         // arrow range → scheme, no qualifier
	['10 each leg', '10', 'each leg'],            // scheme path with qualifier
	['25 sec each', '25 sec', 'each'],            // timed scheme with qualifier
	['45 sec', '45 sec', ''],                     // timed scheme, no qualifier
	['15 steps each direction', '15', 'steps each direction'],
	['10 each foot', '10', 'each foot'],
	['8 each side', '8', 'each side'],
	['10 steps', '10', 'steps'],
	['1–2 min', '1–2', 'min'],                    // en-dash range → scheme + qualifier
	// The contract that #56 corrected: a LEADING number always splits, even for
	// what reads as free text. This is x:'1', NOT x:null.
	['1 length', '1', 'length'],
	// No leading digit-run the regex accepts → x:null, whole value is rest.
	['max', null, 'max'],
	['one pass each foot', null, 'one pass each foot'],
	// '30m' → the 'm' immediately after the digits blocks the match → x:null.
	['30m → 20m → 10m', null, '30m → 20m → 10m'],
];

for (const [input, x, rest] of table) {
	const got = splitReps(input);
	assert.strictEqual(got.x, x, `splitReps(${JSON.stringify(input)}).x expected ${JSON.stringify(x)}, got ${JSON.stringify(got.x)}`);
	assert.strictEqual(got.rest, rest, `splitReps(${JSON.stringify(input)}).rest expected ${JSON.stringify(rest)}, got ${JSON.stringify(got.rest)}`);
}
console.log(`PASS 1: ${table.length} distinct reps shapes split exactly as documented`);

// Pin the specific contract fix from #56: comment and behaviour now agree that
// '1 length' splits (x:'1'), and that a truly non-numeric value returns x:null.
{
	const one = splitReps('1 length');
	assert.strictEqual(one.x, '1');
	assert.strictEqual(one.rest, 'length');
	const m = splitReps('max');
	assert.strictEqual(m.x, null);
	assert.strictEqual(m.rest, 'max');
	console.log('PASS 2: leading-number values split; non-numeric values return x:null');
}

console.log('\nALL WORKOUT TESTS PASSED');
