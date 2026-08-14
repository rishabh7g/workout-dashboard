// Standalone unit test for the PWA manifest baseline (#171): the fields a
// standards-compliant install prompt needs, plus the one assertion that
// catches real drift — theme_color agreeing across the three files that each
// retype it by hand (no build step generates them from one source).
// The repo has no test framework; run with: node tests/manifest.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const html = read('index.html');
const css = read('css/styles.css');

// Every baseline key is present and non-empty.
const requiredKeys = [
	'name',
	'short_name',
	'id',
	'start_url',
	'scope',
	'display',
	'orientation',
	'background_color',
	'theme_color',
	'description',
	'icons',
];
for (const key of requiredKeys) {
	assert.ok(
		manifest[key] !== undefined && manifest[key] !== null && manifest[key] !== '',
		`manifest.json is missing required key "${key}"`,
	);
}
console.log(`PASS 1: all ${requiredKeys.length} baseline keys are present and non-empty`);

// start_url / scope stay relative, so a sub-path deploy (GitHub Pages) still
// resolves.
assert.strictEqual(manifest.start_url, './', `manifest.json start_url must be "./", got "${manifest.start_url}"`);
assert.strictEqual(manifest.scope, './', `manifest.json scope must be "./", got "${manifest.scope}"`);
console.log('PASS 2: start_url and scope are the relative "./"');

// display must be standalone — it is what makes the shell rules (safe-area,
// 100dvh, zoom lock) matter at all.
assert.strictEqual(manifest.display, 'standalone', `manifest.json display must be "standalone", got "${manifest.display}"`);
console.log('PASS 3: display is "standalone"');

// The theme-colour chain: manifest.json, index.html's <meta name="theme-color">
// and css/styles.css's --color-bg token must all agree. Nothing generates
// these from one source, so this is the only thing stopping them drifting
// apart.
const metaMatch = html.match(/<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/);
assert.ok(metaMatch, 'index.html: expected <meta name="theme-color" content="#..."> not found');
const metaThemeColor = metaMatch[1];

const cssMatch = css.match(/--color-bg:\s*(#[0-9a-fA-F]{3,8})/);
assert.ok(cssMatch, 'css/styles.css: expected --color-bg: #... token not found');
const cssBg = cssMatch[1];

assert.strictEqual(
	manifest.theme_color,
	metaThemeColor,
	`theme colour drift — manifest.json theme_color is "${manifest.theme_color}", index.html <meta name="theme-color"> is "${metaThemeColor}", css/styles.css --color-bg is "${cssBg}"`,
);
assert.strictEqual(
	manifest.theme_color,
	cssBg,
	`theme colour drift — manifest.json theme_color is "${manifest.theme_color}", index.html <meta name="theme-color"> is "${metaThemeColor}", css/styles.css --color-bg is "${cssBg}"`,
);
console.log(`PASS 4: theme_color agrees across manifest.json, index.html and css/styles.css (${manifest.theme_color})`);

console.log('\nALL MANIFEST BASELINE TESTS PASSED');
