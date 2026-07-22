// Standalone unit test for the shared two-tap arm/disarm helper (#157).
// createTwoTapArm() is the single implementation behind both the destructive
// "Reset progress" and "Restore backup" confirms: a first tap only arms
// (swap label, add .armed, start a windowMs disarm timer) — never runs the
// destructive action — and a second, distinct tap inside the window is what
// the call site treats as consent to act. If no second tap comes, the timer
// disarms and a later single tap must arm again, not run the action. This
// test is the regression guard against a two-tap gate silently becoming
// single-tap. The repo has no test framework; run with:
//   node tests/two-tap-arm.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
const m = uiSrc.match(/function createTwoTapArm\([\s\S]*?\n\}/);
assert.ok(m, 'createTwoTapArm(...) must exist in js/ui.js');

// A minimal fake button: one class set + one label child, enough for
// createTwoTapArm's classList.add/remove + querySelector(labelSelector).
function makeFakeBtn() {
	const classes = new Set();
	const label = { textContent: '' };
	return {
		classList: {
			add: (c) => classes.add(c),
			remove: (c) => classes.delete(c),
			contains: (c) => classes.has(c),
		},
		querySelector: (sel) => (sel === '.label' ? label : null),
		label,
	};
}

// Fake timer queue: createTwoTapArm only ever holds one live timer at a time
// (arm() overwrites `timer`), so a single pending slot is enough. `flush()`
// simulates the window elapsing with no second tap; a real setTimeout is
// never started, so the test runs instantly and deterministically.
function makeCtx() {
	const btn = makeFakeBtn();
	let pending = null; // { cb, delay }
	const ctx = {
		console,
		document: { querySelector: (sel) => (sel === '.btn' ? btn : null) },
		setTimeout: (cb, delay) => {
			pending = { cb, delay };
			return 1;
		},
		clearTimeout: () => {
			pending = null;
		},
	};
	vm.createContext(ctx);
	vm.runInContext(m[0] + '\nthis.__create = createTwoTapArm;', ctx);
	return {
		create: (...args) => ctx.__create(...args),
		btn,
		flush: () => {
			assert.ok(pending, 'expected a pending disarm timer to flush');
			const cb = pending.cb;
			pending = null;
			cb();
		},
		pendingDelay: () => pending && pending.delay,
		hasPending: () => pending !== null,
	};
}

// A minimal stand-in for a call site's click handler (resetProgress /
// importBackup both follow this exact dispatch): unarmed -> arm only;
// armed -> disarm + "run" the action. Returns which branch ran.
function tap(arm) {
	if (!arm.isArmed()) {
		arm.arm();
		return 'armed';
	}
	arm.disarm();
	return 'executed';
}

// 1. First tap arms only — does not execute, label/class flip to armed.
{
	const h = makeCtx();
	const arm = h.create('.btn', '.label', 'Tap again', 'Idle', 3000);
	assert.strictEqual(arm.isArmed(), false, 'starts unarmed');
	const result = tap(arm);
	assert.strictEqual(result, 'armed', 'first tap only arms, never executes');
	assert.strictEqual(arm.isArmed(), true, 'isArmed() true after first tap');
	assert.strictEqual(h.btn.classList.contains('armed'), true, 'armed class applied');
	assert.strictEqual(h.btn.label.textContent, 'Tap again', 'label swapped to armed text');
	console.log('PASS 1: first tap arms without executing the action');
}

// 2. Second tap within the window executes and disarms (class/label revert).
{
	const h = makeCtx();
	const arm = h.create('.btn', '.label', 'Tap again', 'Idle', 3000);
	tap(arm); // arm
	const result = tap(arm); // within window
	assert.strictEqual(result, 'executed', 'second tap within the window executes');
	assert.strictEqual(arm.isArmed(), false, 'disarmed after executing');
	assert.strictEqual(h.btn.classList.contains('armed'), false, 'armed class removed');
	assert.strictEqual(h.btn.label.textContent, 'Idle', 'label reverted to unarmed text');
	console.log('PASS 2: second tap within the window executes and disarms');
}

// 3. THE regression guard: no second tap before the window elapses -> the arm
//    times out and disarms; a subsequent single tap must arm again, NOT
//    execute. A two-tap gate must never collapse into single-tap.
{
	const h = makeCtx();
	const arm = h.create('.btn', '.label', 'Tap again', 'Idle', 3000);
	tap(arm); // first tap arms
	assert.strictEqual(arm.isArmed(), true, 'armed immediately after first tap');
	assert.strictEqual(h.pendingDelay(), 3000, 'disarm timer scheduled for the 3000ms window');

	h.flush(); // simulate the window elapsing with no second tap

	assert.strictEqual(arm.isArmed(), false, 'timeout disarms automatically');
	assert.strictEqual(h.btn.classList.contains('armed'), false, 'armed class cleared by timeout');
	assert.strictEqual(h.btn.label.textContent, 'Idle', 'label reverted by timeout');

	// A lone tap AFTER the timeout must only re-arm, never execute — proves the
	// gate re-requires two fresh taps rather than "remembering" the old arm.
	const result = tap(arm);
	assert.strictEqual(result, 'armed', 'post-timeout single tap only re-arms, never executes');
	assert.strictEqual(arm.isArmed(), true, 're-armed by the post-timeout tap');
	console.log('PASS 3: timeout disarms, and a lone tap after it only re-arms (no single-tap regression)');
}

// 4. Explicit disarm() (not just the timeout) also clears the pending timer,
//    so a stale timeout can never fire after the state has already moved on.
{
	const h = makeCtx();
	const arm = h.create('.btn', '.label', 'Tap again', 'Idle', 3000);
	arm.arm();
	assert.strictEqual(h.hasPending(), true, 'timer scheduled on arm');
	arm.disarm();
	assert.strictEqual(h.hasPending(), false, 'explicit disarm clears the pending timer');
	console.log('PASS 4: explicit disarm clears the scheduled timeout (no stale auto-disarm)');
}

// 5. onDisarm runs on every disarm — explicit AND timeout-driven — mirroring
//    the import call site's use of it to null out its pending-file state.
{
	const h = makeCtx();
	let disarmCount = 0;
	const arm = h.create('.btn', '.label', 'Tap again', 'Idle', 3000, () => {
		disarmCount++;
	});
	arm.arm();
	arm.disarm();
	assert.strictEqual(disarmCount, 1, 'onDisarm runs on explicit disarm');
	arm.arm();
	h.flush();
	assert.strictEqual(disarmCount, 2, 'onDisarm also runs on timeout-driven disarm');
	console.log('PASS 5: onDisarm fires on both explicit and timeout disarm');
}

// 6. Real call sites still use the shared helper with the historic 3000ms
//    window (not silently narrowed/widened by the refactor).
{
	assert.ok(
		/const resetArm = createTwoTapArm\(\s*'\.reset-btn',\s*'\.reset-btn-label',\s*'Tap again to reset',\s*'Reset progress',\s*3000,?\s*\);/.test(
			uiSrc,
		),
		'resetProgress must wire createTwoTapArm with the original 3000ms window',
	);
	assert.ok(
		/const importArm = createTwoTapArm\(\s*'\.import-btn',\s*'\.reset-btn-label',\s*'Tap again to replace all data',\s*'Restore backup',\s*3000,/.test(
			uiSrc,
		),
		'importBackup must wire createTwoTapArm with the original 3000ms window',
	);
	console.log('PASS 6: both real call sites keep the original 3000ms two-tap window');
}

console.log('\nALL TWO-TAP-ARM TESTS PASSED');
