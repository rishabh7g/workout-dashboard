// Standalone unit test for entryLabel — the short accessible/visible label
// shown on swap-sheet rows (#80). Historically a running/recovery day with no
// variation set rendered `Var ?`, which a screen reader announces as "var
// question mark" — meaningless in any modality. The fallback is now the word
// "TBC". This test guards that no entry ever renders a bare "?" fallback.
// The repo has no test framework; run with:
//   node tests/entry-label.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Pull just entryLabel out of ui.js so its DOM-touching top level never runs.
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const entry = uiSrc.match(/function entryLabel\(entry\) \{[\s\S]*?\n\}/);
assert.ok(entry, 'entryLabel(entry) must exist in js/ui.js');

const ctx = {
	console,
	// entryLabel reads the WORKOUTS global for keyed workout days.
	WORKOUTS: { push: { A: { title: 'Push Day' } } },
};
vm.createContext(ctx);
vm.runInContext(entry[0] + '\nthis.__e = entryLabel;', ctx);
const entryLabel = ctx.__e;

// 1. A running day with a missing variation falls back to "TBC", never "?".
{
	const got = entryLabel({ type: 'running' });
	assert.strictEqual(got, 'Running · Sat · Var TBC', `got "${got}"`);
	assert.ok(!got.includes('?'), 'no bare "?" fallback allowed');
	console.log('PASS 1: running day w/ no variation → "Var TBC"');
}

// 2. Recovery day, same fallback.
{
	const got = entryLabel({ type: 'recovery' });
	assert.strictEqual(got, 'Running · Sun · Var TBC', `got "${got}"`);
	console.log('PASS 2: recovery day w/ no variation → "Var TBC"');
}

// 3. A running day WITH a variation keeps its letter.
{
	assert.strictEqual(entryLabel({ type: 'running', variation: 'B' }), 'Running · Sat · Var B');
	console.log('PASS 3: running day keeps its variation letter');
}

// 4. Rest and outside-schedule stay literal, no "?".
{
	assert.strictEqual(entryLabel({ type: 'rest' }), 'Rest Day');
	assert.strictEqual(entryLabel(null), 'Outside schedule');
	console.log('PASS 4: rest / outside-schedule labels intact');
}

// 5. A keyed workout day reads its title + variation.
{
	assert.strictEqual(entryLabel({ type: 'push', variation: 'A' }), 'Push Day · Var A');
	console.log('PASS 5: keyed workout day → title + variation');
}

// 6. Belt-and-braces: no entry label the app can produce contains a "?".
{
	for (const e of [null, { type: 'rest' }, { type: 'running' }, { type: 'recovery' }, { type: 'push', variation: 'A' }]) {
		assert.ok(!entryLabel(e).includes('?'), `"?" leaked for ${JSON.stringify(e)}`);
	}
	console.log('PASS 6: no "?" leaks across all entry shapes');
}

console.log('\nALL ENTRY-LABEL TESTS PASSED');
