// Standalone unit test for the sw.js icon precache (#152): every icon the app
// actually references — from index.html's <link> tags and manifest.json's
// icons[] — must be in the ASSETS precache list, so an offline cold load never
// misses the favicon / touch icon / manifest icons.
// The repo has no test framework; run with: node tests/sw-icons.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const swSrc = read('sw.js');
const html = read('index.html');
const manifest = JSON.parse(read('manifest.json'));

// The ASSETS literal only — never the rest of sw.js, so a path merely mentioned
// in a comment elsewhere cannot make this test pass.
const start = swSrc.indexOf('const ASSETS = [');
assert.notStrictEqual(start, -1, 'sw.js must declare const ASSETS');
const assetsBlock = swSrc.slice(start, swSrc.indexOf('];', start));
const assets = [...assetsBlock.matchAll(/'([^']+)'/g)]
	.map((m) => m[1])
	.map((p) => p.replace(/^\.\//, ''));

// Every href/src the app points at under assets/, from both reference sites.
const fromHtml = [...html.matchAll(/(?:href|src)="(assets\/[^"]+)"/g)].map((m) => m[1]);
const fromManifest = manifest.icons.map((i) => i.src);
const referenced = [...new Set([...fromHtml, ...fromManifest])];

assert.ok(referenced.length > 0, 'expected index.html/manifest.json to reference icons');

for (const icon of referenced) {
	assert.ok(fs.existsSync(path.join(ROOT, icon)), `${icon} is referenced but missing on disk`);
	assert.ok(assets.includes(icon), `${icon} is referenced by the app but not precached in sw.js ASSETS`);
}
console.log(`PASS 1: all ${referenced.length} referenced icons are precached`);

// The precache must not claim files that do not exist — a typo'd entry makes
// cache.addAll() reject and the whole service worker install fail.
for (const a of assets) {
	if (a === '') continue; // './' — the app shell, not a file on disk
	assert.ok(fs.existsSync(path.join(ROOT, a)), `ASSETS entry ${a} does not exist — addAll() would reject`);
}
console.log(`PASS 2: every ASSETS entry (${assets.length}) exists on disk`);

// Unreferenced assets stay out of the precache: they cost install bandwidth
// for nothing (#152, #158).
const unreferenced = fs
	.readdirSync(path.join(ROOT, 'assets'))
	.map((f) => `assets/${f}`)
	.filter((f) => !referenced.includes(f));
for (const f of unreferenced) {
	assert.ok(!assets.includes(f), `${f} is precached but referenced nowhere — drop it from ASSETS`);
}
console.log(`PASS 3: ${unreferenced.length} unreferenced asset(s) left out of the precache`);

console.log('\nALL SW ICON TESTS PASSED');
