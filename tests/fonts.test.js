// Standalone unit test for the (family, weight) font ramp (#174). Asserts, in
// both directions, that the set of bundled faces the CSS can render equals the
// set of @font-face declarations backed by a file under fonts/ — a pair the
// tokens name and the bundle lacks is a fail, and a bundled face nothing
// renders is also a fail (dead payload shipped to every device).
// The repo has no test framework; run with: node tests/fonts.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'css/styles.css');
const CSS_DIR = path.dirname(CSS_PATH);
const css = fs.readFileSync(CSS_PATH, 'utf8');
// Strip comments once, up front, so every regex below reads only real rules —
// a family/weight mentioned only in a comment must never count.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

// ─── @font-face blocks ───────────────────────────────────────────────────────
// Every face this stylesheet bundles: family, weight, font-display, and the
// list of src url(...) targets it names (still relative — resolved to disk
// below, once per src, against css/'s own directory).
function fontFaces() {
	const faces = [];
	for (const m of cssNoComments.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
		const body = m[1];
		const family = body.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1];
		const weight = body.match(/font-weight:\s*(\d{3})/)?.[1];
		const display = body.match(/font-display:\s*([a-z-]+)/)?.[1];
		const src = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(
			(s) => s[1],
		);
		faces.push({ family, weight, display, src, raw: m[0] });
	}
	return faces;
}

// ─── --font-* token stacks ───────────────────────────────────────────────────
// Every quoted family in each --font-* custom property, reading the WHOLE
// stack (not just the head) — --font-heading: 'Archivo', -apple-system, ...
// -> { 'font-heading': ['Archivo'] } (unquoted system keywords contribute no
// family, which is correct: nothing to bundle for them).
function tokenStacks() {
	const stacks = {};
	for (const m of cssNoComments.matchAll(/--(font-[a-z-]+):\s*([^;]+);/g)) {
		stacks[m[1]] = [...m[2].matchAll(/['"]([^'"]+)['"]/g)].map((f) => f[1]);
	}
	return stacks;
}

// ─── bundled vs system ───────────────────────────────────────────────────────
// A family is "bundled" iff some @font-face in this file names it. Everything
// else in a stack is a system/platform face — zero payload, nothing to assert.
function bundledFamilies(faces) {
	return new Set(faces.map((f) => f.family).filter(Boolean));
}

// ─── every rule the ramp actually renders ────────────────────────────────────
// Walk every CSS rule. A rule "selects" a bundled (family, weight) pair only
// when it declares BOTH font-family (resolving a var(--font-*) token to its
// full stack, or reading a literal comma list) AND that declared family is
// bundled — matching this app's own idiom, where every heading rule pairs
// font-family: var(--font-heading) with an explicit font-weight in the same
// block. A rule naming only system families contributes nothing (correct: a
// system stack is zero payload, nothing to bundle or assert). font-weight
// defaults to CSS's initial 400 when the block doesn't set one.
function rampFaces() {
	const stacks = tokenStacks();
	const bundled = bundledFamilies(fontFaces());
	const pairs = new Set();
	for (const m of cssNoComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = m[1].trim();
		if (selector.startsWith('@font-face')) continue; // not a rendering rule
		const body = m[2];
		const famDecl = body.match(/font-family:\s*([^;]+);/)?.[1]?.trim();
		if (!famDecl) continue;
		const varName = famDecl.match(/^var\(--(font-[a-z-]+)\)$/)?.[1];
		const families = varName
			? stacks[varName] || []
			: [...famDecl.matchAll(/['"]([^'"]+)['"]/g)].map((f) => f[1]);
		const bundledHere = families.filter((f) => bundled.has(f));
		if (bundledHere.length === 0) continue;
		const weight = body.match(/font-weight:\s*(\d{3})/)?.[1] || '400';
		for (const family of bundledHere) pairs.add(`${family} ${weight}`);
	}
	return pairs;
}

const faces = fontFaces();
const bundled = bundledFamilies(faces);
const required = rampFaces();
const shipped = new Set(
	faces.map((f) => `${f.family} ${f.weight}`).filter((p) => !p.includes('undefined')),
);

// 1. Every bundled (family, weight) pair the ramp names has a matching
//    @font-face — a pair the tokens name and the bundle lacks is a fail.
{
	const missing = [...required].filter((pair) => !shipped.has(pair));
	assert.deepStrictEqual(
		missing,
		[],
		`ramp names (family, weight) pair(s) with no matching @font-face: ${missing.join(', ')} — add the face, or ship the weight the tokens ask for`,
	);
	console.log('PASS 1: every ramp-required (family, weight) pair has a matching @font-face');
}

// 2. Every @font-face is actually selected by some (family, weight) pair in
//    the ramp — a bundled face nothing renders is dead payload.
{
	const dead = [...shipped].filter((pair) => !required.has(pair));
	assert.deepStrictEqual(
		dead,
		[],
		`@font-face declares (family, weight) pair(s) no rule renders: ${dead.join(', ')} — dead payload shipped to every device`,
	);
	console.log('PASS 2: every @font-face is selected by some rule in the ramp (no dead payload)');
}

// 3. font-display: swap on every @font-face — text is readable before the
//    face arrives.
{
	for (const f of faces) {
		assert.strictEqual(
			f.display,
			'swap',
			`@font-face for ${f.family} ${f.weight} must declare font-display: swap (found: ${f.display || 'none'})`,
		);
	}
	console.log(`PASS 3: font-display: swap on all ${faces.length} @font-face declaration(s)`);
}

// 4. Every src: url(...) in an @font-face resolves to a file on disk — a
//    rename cannot silently ship a stylesheet referencing a missing face.
{
	for (const f of faces) {
		assert.ok(f.src.length > 0, `@font-face for ${f.family} ${f.weight} has no src url(...)`);
		for (const rel of f.src) {
			const resolved = path.join(CSS_DIR, rel);
			assert.ok(
				fs.existsSync(resolved),
				`@font-face for ${f.family} ${f.weight} names a file that does not exist: ${rel} (resolved: ${resolved})`,
			);
		}
	}
	console.log('PASS 4: every @font-face src url(...) resolves to a file on disk');
}

// 5. No third-party font origin anywhere — an offline PWA cannot depend on
//    one. Scan css/, js/, index.html and sw.js.
{
	const banned = [
		/fonts\.googleapis\.com/,
		/fonts\.gstatic\.com/,
		/use\.typekit/,
		/@import\s+(?:url\()?['"]?https?:\/\//,
	];
	const files = [
		'css/styles.css',
		'index.html',
		'sw.js',
		...fs.readdirSync(path.join(ROOT, 'js')).map((f) => path.join('js', f)),
	];
	for (const rel of files) {
		const contents = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		for (const re of banned) {
			assert.ok(
				!re.test(contents),
				`${rel} references a third-party font host (matched ${re}) — self-host and subset instead`,
			);
		}
	}
	console.log(`PASS 5: no third-party font origin in ${files.length} scanned file(s)`);
}

console.log('\nALL FONTS TESTS PASSED');
