// Contrast verification for the Modernist token foundation (issue #62).
// WCAG 2.x relative-luminance + contrast-ratio formula. No deps; run:
//   node tests/contrast.test.js
// Fails (exit 1) if any required pair drops below 4.5:1.

const T = {
	bg: '#dddbd9',
	surface: '#f7f6f5',
	text: '#201e1d',
	accent: '#ec3013',
	'accent-100': '#fbe0da',
	'accent-700': '#b0240e',
	'accent-800': '#8f1d0b',
	'neutral-600': '#5f5a55',
	'neutral-700': '#524e4b',
};

function channel(c) {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
	const n = parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]
const REQUIRED = [
	['text', 'bg', 4.5],
	['accent-700', 'bg', 4.5],
	['accent-800', 'accent-100', 4.5],
	['neutral-600', 'bg', 4.5],
	['neutral-700', 'bg', 4.5],
];

let failed = 0;
console.log('Modernist contrast table (WCAG 2.x):');
for (const [fg, bg, min] of REQUIRED) {
	const r = ratio(T[fg], T[bg]);
	const ok = r >= min;
	if (!ok) failed++;
	console.log(
		`  ${fg} on ${bg}: ${r.toFixed(2)}:1  (min ${min})  ${ok ? 'PASS' : 'FAIL'}`
	);
}
// Informational (large-text/graphics only, not gated):
console.log(
	`  [info] accent on bg: ${ratio(T.accent, T.bg).toFixed(2)}:1 (large/graphics only)`
);

if (failed) {
	console.error(`\n${failed} pair(s) below 4.5:1`);
	process.exit(1);
}
console.log('\nAll required pairs >= 4.5:1');
