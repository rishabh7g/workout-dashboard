// Standalone unit test for the one raised notice + describeError() (#172).
// js/ui.js touches the DOM at load time (top-level addEventListener calls),
// so — same pattern as tests/two-tap-arm.test.js and tests/aria-label.test.js
// — this pulls just the two functions under test out of the source and runs
// them in an isolated vm context rather than require()-ing the whole file.
// The repo has no test framework; run with: node tests/notice.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const uiSrc = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
// describeError's null/undefined branch reads t() (js/strings.js, #175).
const stringsSrc = fs.readFileSync(path.join(__dirname, '../js/strings.js'), 'utf8');

const noticeMarkupSrc = uiSrc.match(/function noticeMarkup\([\s\S]*?\n\}/);
const describeErrorSrc = uiSrc.match(/function describeError\([\s\S]*?\n\}/);
assert.ok(noticeMarkupSrc, 'noticeMarkup(...) must exist in js/ui.js');
assert.ok(describeErrorSrc, 'describeError(...) must exist in js/ui.js');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(
	`${stringsSrc}\n${noticeMarkupSrc[0]}\n${describeErrorSrc[0]}\nthis.__noticeMarkup = noticeMarkup; this.__describeError = describeError;`,
	ctx
);
const noticeMarkup = ctx.__noticeMarkup;
const describeError = ctx.__describeError;

// 1. Every notice carries role="alert" — the entire point: render() rebuilds
// #app wholesale on every paint, so a warning with no live-region role is
// never announced to a screen-reader user.
{
	const bareHTML = noticeMarkup({ body: 'Plain body only.' });
	assert.ok(bareHTML.includes('role="alert"'), `bare notice missing role="alert": ${bareHTML}`);

	const fullHTML = noticeMarkup({
		title: 'Title',
		body: 'Body.',
		detail: 'Detail.',
		actionLabel: 'Retry',
		actionOnclick: 'retry()',
	});
	assert.ok(fullHTML.includes('role="alert"'), `full notice missing role="alert": ${fullHTML}`);
	assert.ok(fullHTML.includes('Title') && fullHTML.includes('Body.') && fullHTML.includes('Detail.') && fullHTML.includes('Retry'), `full notice dropped a field: ${fullHTML}`);
	console.log('PASS 1: noticeMarkup output always carries role="alert"');
}

// 2. describeError handles every shape a real throw takes in this app,
// without ever using instanceof Error (see PASS 3).
{
	assert.strictEqual(describeError(null), 'Unknown error');
	assert.strictEqual(describeError(undefined), 'Unknown error');
	assert.strictEqual(describeError('plain string'), 'plain string');
	assert.strictEqual(
		describeError({ name: 'SecurityError', message: 'blocked' }),
		'SecurityError: blocked',
		'DOMException-shaped object'
	);
	assert.strictEqual(describeError(new Error('boom')), 'Error: boom', 'a real Error instance');
	console.log('PASS 2: describeError handles null/undefined/string/DOMException-shaped/Error without throwing');
}

// 3. The duck-typing rule is enforced at the source level: `instanceof Error`
// must appear nowhere in js/, or a future edit could silently reintroduce the
// exact bug this issue fixes (a DOMException failing an instanceof check).
{
	const jsDir = path.join(__dirname, '../js');
	const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
	assert.ok(files.length > 0, 'expected js/ to contain source files');
	for (const f of files) {
		const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
		assert.ok(!src.includes('instanceof Error'), `${f} uses "instanceof Error" — use describeError()'s duck typing instead`);
	}
	console.log(`PASS 3: "instanceof Error" appears in none of ${files.length} js/ files`);
}

console.log('\nALL NOTICE TESTS PASSED');
