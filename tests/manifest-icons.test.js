// Standalone unit test for the manifest icon purposes (#153): a full-bleed
// bitmap cannot also be a proper maskable icon — Android adaptive launchers
// crop maskable icons to a circle/squircle, so anything declared maskable must
// keep its content inside the central ~80% safe zone. The app therefore ships
// the full-bleed PNGs as "any" and one padded PNG as "maskable", never both
// purposes on one entry.
// The repo has no test framework; run with: node tests/manifest-icons.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const icons = manifest.icons;

assert.ok(Array.isArray(icons) && icons.length > 0, 'manifest must declare icons[]');

// Every entry is complete and points at a file that exists — a manifest icon
// 404 is invisible until an install prompt silently drops the icon.
for (const icon of icons) {
	for (const key of ['src', 'sizes', 'type', 'purpose']) {
		assert.ok(icon[key], `icon ${icon.src || '(no src)'} is missing "${key}"`);
	}
	assert.ok(
		fs.existsSync(path.join(ROOT, icon.src)),
		`${icon.src} is declared in manifest.json but missing on disk`,
	);
}
console.log(`PASS 1: all ${icons.length} manifest icons are complete and exist on disk`);

// The split itself: no entry claims both purposes.
for (const icon of icons) {
	const purposes = icon.purpose.trim().split(/\s+/);
	for (const p of purposes) {
		assert.ok(
			['any', 'maskable', 'monochrome'].includes(p),
			`${icon.src} declares unknown purpose "${p}"`,
		);
	}
	assert.ok(
		!(purposes.includes('any') && purposes.includes('maskable')),
		`${icon.src} declares both "any" and "maskable" — a full-bleed icon gets cropped as maskable; use a separate padded file`,
	);
}
console.log('PASS 2: no icon declares both "any" and "maskable"');

// Both purposes are still covered, at the size each platform wants.
const has = (purpose, size) =>
	icons.some((i) => i.purpose.trim().split(/\s+/).includes(purpose) && i.sizes === size);
assert.ok(has('any', '192x192'), 'expected a 192x192 icon with purpose "any"');
assert.ok(has('any', '512x512'), 'expected a 512x512 icon with purpose "any"');
assert.ok(has('maskable', '512x512'), 'expected a 512x512 icon with purpose "maskable"');
console.log('PASS 3: "any" (192 + 512) and "maskable" (512) are all declared');

// The maskable file must actually be padded, not the full-bleed bitmap under a
// new name: its corners should be the app background colour, because the pad
// is what keeps the artwork inside the safe zone.
const maskable = icons.find((i) => i.purpose.trim().split(/\s+/).includes('maskable'));
const png = fs.readFileSync(path.join(ROOT, maskable.src));
assert.ok(png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `${maskable.src} is not a PNG`);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
assert.strictEqual(`${width}x${height}`, maskable.sizes, `${maskable.src} is ${width}x${height}, declared ${maskable.sizes}`);
const other = icons.find((i) => i.src !== maskable.src && i.sizes === maskable.sizes);
assert.ok(
	!png.equals(fs.readFileSync(path.join(ROOT, other.src))),
	`${maskable.src} is byte-identical to ${other.src} — the maskable icon must be padded, not a copy`,
);
console.log(`PASS 4: ${maskable.src} is a distinct ${width}x${height} PNG, not a copy of ${other.src}`);

console.log('\nALL MANIFEST ICON TESTS PASSED');
