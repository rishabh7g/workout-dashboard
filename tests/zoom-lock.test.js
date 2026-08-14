// Standalone unit test for js/zoom-lock.js (#166, house UI standard §7).
// The repo has no test framework; run with: node tests/zoom-lock.test.js
//
// syncViewport() is the whole component: appends the lock only when
// standalone, amends rather than replaces, and is idempotent (locking then
// unlocking returns the tag to its exact original string — it can't get
// stuck locked). THE assertion that matters is that viewport-fit=cover
// survives the lock: losing it silently turns off every
// env(safe-area-inset-*) read in the app, in exactly the mode this component
// acts on.
const assert = require('assert');
const { syncViewport } = require('../js/zoom-lock.js');

const ORIGINAL = 'width=device-width, initial-scale=1, viewport-fit=cover';

// 1. Standalone: appends both directives and viewport-fit=cover survives.
{
	const meta = { content: ORIGINAL };
	syncViewport(meta, true);
	assert.ok(meta.content.includes('user-scalable=no'), 'user-scalable=no appended');
	assert.ok(meta.content.includes('maximum-scale=1'), 'maximum-scale=1 appended');
	assert.ok(meta.content.includes('viewport-fit=cover'), 'viewport-fit=cover survives the lock');
	assert.ok(meta.content.includes('width=device-width'), 'width=device-width survives');
	assert.ok(meta.content.includes('initial-scale=1'), 'initial-scale=1 survives');
	console.log('PASS 1: standalone=true locks zoom while viewport-fit=cover survives');
}

// 2. Not standalone (browser tab): tag is untouched, byte-identical.
{
	const meta = { content: ORIGINAL };
	syncViewport(meta, false);
	assert.strictEqual(meta.content, ORIGINAL, 'a browser tab leaves the tag byte-identical');
	console.log('PASS 2: standalone=false leaves a browser tab\'s viewport untouched');
}

// 3. THE regression guard: lock then unlock returns to the exact original —
//    it cannot get stuck locked across a display-mode change.
{
	const meta = { content: ORIGINAL };
	syncViewport(meta, true);
	assert.notStrictEqual(meta.content, ORIGINAL, 'sanity: locking actually changed the tag');
	syncViewport(meta, false);
	assert.strictEqual(meta.content, ORIGINAL, 'unlocking after locking restores the exact original string');
	console.log('PASS 3: locking then unlocking returns to the exact original string');
}

// 4. Re-locking an already-locked tag does not duplicate the directives —
//    it reads the CURRENT tag, strips its own directives first, then re-adds
//    them exactly once.
{
	const meta = { content: ORIGINAL };
	syncViewport(meta, true);
	syncViewport(meta, true);
	const scaleCount = (meta.content.match(/maximum-scale=1/g) || []).length;
	const scalableCount = (meta.content.match(/user-scalable=no/g) || []).length;
	assert.strictEqual(scaleCount, 1, 'maximum-scale=1 is not duplicated on re-lock');
	assert.strictEqual(scalableCount, 1, 'user-scalable=no is not duplicated on re-lock');
	console.log('PASS 4: re-locking an already-locked tag does not duplicate directives');
}

console.log('\nALL ZOOM-LOCK TESTS PASSED');
