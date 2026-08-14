#!/usr/bin/env node
// make-icons.js — cuts the raster icon set from assets/icon-512.svg (#170).
//
// Run BY HAND after touching assets/icon-512.svg or the CSS colour tokens it
// uses; commit the regenerated PNGs. This script is NOT wired into
// scripts/verify.sh, .github/workflows/checks.yml or any deploy path — an
// icon set that regenerates on every build is a binary diff nobody reads.
//
//   node scripts/make-icons.js
//
// Zero dependencies: pure Node (fs + zlib), no rsvg-convert / ImageMagick, no
// npm. assets/icon-512.svg is the only geometry source (one brand mark, never
// redrawn); colours are resolved from css/styles.css's :root tokens at run
// time so a token change flows into the icons with no hex retyped here.
//
// Emits: assets/icon-192.png, assets/icon-512.png,
// assets/apple-touch-icon-180.png, assets/icon-512-maskable.png.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

// ── Minimal PNG encoder (8-bit, colortype 2=RGB / 6=RGBA, no filtering) ────
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, pixels, colortype) {
	const channels = colortype === 6 ? 4 : 3;
	const stride = width * channels;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0; // filter: none
		pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
	}
	const idat = zlib.deflateSync(raw, { level: 9 });
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = colortype;
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', idat),
		pngChunk('IEND', Buffer.alloc(0)),
	]);
}

// ── Token-resolved colours (read at generation time, never hardcoded here) ─
function readToken(cssSrc, name) {
	const m = cssSrc.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
	if (!m) throw new Error(`css/styles.css: token ${name} not found`);
	return m[1];
}

function hexToRgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── Geometry: read the rects from icon-512.svg (the one source) ───────────
// The first <rect> is the full-bleed field (background); every rect after it
// is the mark (the barbell). Fill colours in the file are ignored on purpose
// — they are substituted from the CSS tokens below, so drift in the SVG's
// literal hex cannot leak into the generated PNGs.
function parseRects(svgSrc) {
	const rects = [];
	const re = /<rect\s+([^>]*?)\/?>/g;
	let m;
	while ((m = re.exec(svgSrc))) {
		const attrs = {};
		const attrRe = /([\w-]+)="([^"]*)"/g;
		let am;
		while ((am = attrRe.exec(m[1]))) attrs[am[1]] = am[2];
		rects.push({
			x: parseFloat(attrs.x || '0'),
			y: parseFloat(attrs.y || '0'),
			w: parseFloat(attrs.width),
			h: parseFloat(attrs.height),
		});
	}
	if (rects.length < 2) throw new Error('icon-512.svg: expected a field rect plus at least one mark rect');
	return rects;
}

// ── Rasterise with 8x supersampling, box-filtered down to the output size ──
const SS = 8;

function rasterize(rects, size, { scale, offsetX, offsetY, fieldRGB, markRGB, padRGB }) {
	const hi = size * SS;
	const hiPx = Buffer.alloc(hi * hi * 3);
	const fill = (x0, y0, x1, y1, rgb) => {
		const xs = Math.max(0, Math.round(x0)),
			xe = Math.min(hi, Math.round(x1));
		const ys = Math.max(0, Math.round(y0)),
			ye = Math.min(hi, Math.round(y1));
		for (let y = ys; y < ye; y++) {
			for (let x = xs; x < xe; x++) {
				const i = (y * hi + x) * 3;
				hiPx[i] = rgb[0];
				hiPx[i + 1] = rgb[1];
				hiPx[i + 2] = rgb[2];
			}
		}
	};

	fill(0, 0, hi, hi, padRGB);
	rects.forEach((r, idx) => {
		const rgb = idx === 0 ? fieldRGB : markRGB;
		const x0 = (r.x * scale + offsetX) * SS;
		const y0 = (r.y * scale + offsetY) * SS;
		const x1 = x0 + r.w * scale * SS;
		const y1 = y0 + r.h * scale * SS;
		fill(x0, y0, x1, y1, rgb);
	});

	// Box-downsample hi -> size, RGB.
	const out = Buffer.alloc(size * size * 3);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let r = 0,
				g = 0,
				b = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const i = ((y * SS + sy) * hi + (x * SS + sx)) * 3;
					r += hiPx[i];
					g += hiPx[i + 1];
					b += hiPx[i + 2];
				}
			}
			const n = SS * SS;
			const oi = (y * size + x) * 3;
			out[oi] = Math.round(r / n);
			out[oi + 1] = Math.round(g / n);
			out[oi + 2] = Math.round(b / n);
		}
	}
	return out;
}

function rgbToRgba(rgb, size) {
	const out = Buffer.alloc(size * size * 4);
	for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
		out[j] = rgb[i];
		out[j + 1] = rgb[i + 1];
		out[j + 2] = rgb[i + 2];
		out[j + 3] = 255;
	}
	return out;
}

// ── Main ────────────────────────────────────────────────────────────────
const cssSrc = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const accent = hexToRgb(readToken(cssSrc, '--color-accent'));
const surface = hexToRgb(readToken(cssSrc, '--color-surface'));
const bg = hexToRgb(readToken(cssSrc, '--color-bg'));

const svgSrc = fs.readFileSync(path.join(ROOT, 'assets/icon-512.svg'), 'utf8');
const rects = parseRects(svgSrc);

const outputs = [
	{ file: 'icon-192.png', size: 192, alpha: true },
	{ file: 'icon-512.png', size: 512, alpha: true },
	{ file: 'apple-touch-icon-180.png', size: 180, alpha: true },
];

for (const o of outputs) {
	const scale = o.size / 512;
	const rgb = rasterize(rects, o.size, {
		scale,
		offsetX: 0,
		offsetY: 0,
		fieldRGB: accent,
		markRGB: surface,
		padRGB: accent, // full-bleed field covers the whole canvas; no pad shows
	});
	const px = o.alpha ? rgbToRgba(rgb, o.size) : rgb;
	const png = encodePNG(o.size, o.size, px, o.alpha ? 6 : 2);
	fs.writeFileSync(path.join(ROOT, 'assets', o.file), png);
	console.log(`wrote assets/${o.file} (${o.size}x${o.size}, ${png.length} bytes)`);
}

// Maskable: geometry scaled to the central 80% safe zone, padded with the
// app background token so an Android circle/squircle crop never clips the
// barbell.
{
	const size = 512;
	const safeScale = 0.8;
	const offset = (size - size * safeScale) / 2;
	const rgb = rasterize(rects, size, {
		scale: safeScale,
		offsetX: offset,
		offsetY: offset,
		fieldRGB: accent,
		markRGB: surface,
		padRGB: bg,
	});
	const png = encodePNG(size, size, rgb, 2);
	fs.writeFileSync(path.join(ROOT, 'assets/icon-512-maskable.png'), png);
	console.log(`wrote assets/icon-512-maskable.png (${size}x${size}, ${png.length} bytes)`);
}
