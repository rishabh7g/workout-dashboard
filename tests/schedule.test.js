// Standalone schedule-integrity test for js/data.js (#35).
//
// js/data.js is a hand-edited ~794-line file that IS the app: SCHEDULE (184
// days), 14 workout variants, CORE, DRILLS. render() (js/ui.js) does
//   const workout = (WORKOUTS[type] || RUNNING_DAYS[type])?.[variation];
//   if (!workout) return;
// so a typo'd date key, a `variation: 'C'`, or a `type: 'leg-quads'` renders a
// BLANK screen — and a wrong-but-resolvable entry renders with full confidence.
// Nothing enforced that data stayed clean; this suite does.
//
// Style: the repo has no test runner. Each tests/*.test.js is a standalone
// script that PRINTS a per-check PASS/FAIL line and exits NON-ZERO on any
// failure; scripts/verify.sh (#33) and CI (#34) run them via
//   for f in tests/*.test.js; do node "$f" || exit 1; done
// so dropping this file in makes the TEST stage pick it up automatically.
// Run directly with: node tests/schedule.test.js
//
// Loads the guarded #31 exports: require('../js/data.js') populates its own
// module.exports AND copies the consts onto globalThis, so require('../js/
// workout.js') — whose pure functions read the data.js globals at call time —
// resolves WORKOUTS / CORE / CYCLE_ANCHOR exactly as the browser's shared
// classic-<script> scope does.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = require('../js/data.js'); // first — populates globalThis
const w = require('../js/workout.js');

const {
	SCHEDULE,
	WORKOUTS,
	RUNNING_DAYS,
	CORE,
	DRILLS,
	PROGRAM_START,
	PROGRAM_END,
	PROGRAM_LABEL,
	CYCLE_ANCHOR,
} = data;
const { buildItemList, weekNumber, getWeekType, TOTAL_WEEKS } = w;

// Mirror of workout.js topRep (not exported): the highest number in a reps
// value, or null when it carries no digits at all (pure free text like 'max').
const hasNumericTarget = (reps) => /\d/.test(String(reps));

const DATA_SRC = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const WORKOUT_SRC = fs.readFileSync(
	path.join(__dirname, '../js/workout.js'),
	'utf8',
);

// ─── tiny harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(name, fn) {
	try {
		fn();
		passed++;
		console.log(`PASS  ${name}`);
	} catch (e) {
		failed++;
		console.error(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`);
	}
}

// ─── date helpers (locale-free, ISO string ops) ─────────────────────────────
const parseKey = (k) => k.split('-').map(Number);
const fmt = (y, m, d) =>
	`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fmtDate = (dt) => fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
const dowOf = (key) => {
	const [y, m, d] = parseKey(key);
	return new Date(y, m - 1, d).getDay();
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sanity: the exports we depend on actually loaded.
check('data.js + workout.js exports load', () => {
	assert.ok(SCHEDULE && WORKOUTS && RUNNING_DAYS && CORE && DRILLS, 'data exports present');
	assert.equal(typeof buildItemList, 'function', 'buildItemList exported');
	assert.equal(typeof weekNumber, 'function', 'weekNumber exported');
	assert.equal(typeof getWeekType, 'function', 'getWeekType exported');
	assert.equal(TOTAL_WEEKS, 26, 'TOTAL_WEEKS is 26');
});

// ─── (a) Coverage ────────────────────────────────────────────────────────────
check('(a) coverage: 184 days, no gaps, in-range, self-formatting, no dup source keys', () => {
	const keys = Object.keys(SCHEDULE);

	assert.equal(keys.length, 184, `expected 184 schedule days, saw ${keys.length}`);

	// Keys are stored in chronological order.
	assert.deepEqual(keys, [...keys].sort(), 'SCHEDULE keys are not in ascending order');

	// Every stored key re-formats to itself (catches non-padded / rolled-over dates).
	for (const k of keys) {
		const [y, m, d] = parseKey(k);
		assert.equal(fmt(y, m, d), k, `${k}: key does not re-format to itself (non-padded or invalid)`);
		const dt = new Date(y, m - 1, d);
		assert.equal(fmtDate(dt), k, `${k}: not a real calendar date (rolled over)`);
	}

	// Every calendar day PROGRAM_START..PROGRAM_END is present — no gaps.
	const [sy, sm, sd] = parseKey(PROGRAM_START);
	const [ey, em, ed] = parseKey(PROGRAM_END);
	const end = new Date(ey, em - 1, ed);
	for (let cur = new Date(sy, sm - 1, sd); cur <= end; cur.setDate(cur.getDate() + 1)) {
		const k = fmtDate(cur);
		assert.ok(k in SCHEDULE, `missing schedule day ${k} (a gap in the program)`);
	}

	// No out-of-range keys.
	for (const k of keys) {
		assert.ok(k >= PROGRAM_START && k <= PROGRAM_END, `${k}: outside PROGRAM_START..PROGRAM_END`);
	}

	// Duplicate SOURCE keys: runtime objects silently keep only the last value,
	// so regex the data.js source text instead.
	const seen = new Map();
	for (const m of DATA_SRC.matchAll(/'(\d{4}-\d{2}-\d{2})':\s*\{/g)) {
		seen.set(m[1], (seen.get(m[1]) || 0) + 1);
	}
	const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
	assert.equal(dups.length, 0, `duplicate date keys in data.js source: ${dups.join(', ')}`);
	assert.equal(seen.size, 184, `expected 184 distinct source keys, saw ${seen.size}`);
});

// ─── (b) Weekday map + per-type counts ──────────────────────────────────────
check('(b) weekday map + per-type counts', () => {
	// Mon rest · Tue legs · Wed back|chest · Thu arms · Fri shoulders · Sat run · Sun recovery.
	const familyByDow = {
		0: ['recovery'],
		2: ['legs-hamstrings', 'legs-quads'],
		3: ['back', 'chest'],
		4: ['arms-triceps', 'arms-biceps'],
		5: ['shoulders'],
		6: ['running'],
	};
	for (const [day, e] of Object.entries(SCHEDULE)) {
		const dow = dowOf(day);
		if (dow === 1) {
			assert.equal(e.type, 'rest', `${day}: Monday must be rest, got ${e.type}`);
			continue;
		}
		assert.ok(
			familyByDow[dow].includes(e.type),
			`${day}: dow ${dow} expected one of [${familyByDow[dow]}], got ${e.type}`,
		);
	}

	const EXPECT = {
		rest: 26, running: 27, recovery: 27, shoulders: 26,
		back: 13, chest: 13, 'legs-hamstrings': 13, 'legs-quads': 13,
		'arms-triceps': 13, 'arms-biceps': 13,
	};
	const tally = {};
	for (const e of Object.values(SCHEDULE)) tally[e.type] = (tally[e.type] || 0) + 1;
	assert.deepEqual(tally, EXPECT, `per-type counts mismatch: ${JSON.stringify(tally)}`);
});

// ─── (c) Week comments are honest, load-bearing docs ────────────────────────
check('(c) week comments agree with entries + getWeekType', () => {
	const lines = DATA_SRC.split('\n');
	const commentRe = /\/\/ Week of .+? — (Front|Back) Week .* Var ([AB])/;
	const entryRe = /'(\d{4}-\d{2}-\d{2})':\s*\{\s*type:\s*'([^']+)'(?:,\s*variation:\s*'([AB])')?\s*\}/;
	let blocks = 0;

	for (let i = 0; i < lines.length; i++) {
		const cm = commentRe.exec(lines[i]);
		if (!cm) continue;
		const [, label, varLetter] = cm;
		// Collect the 7 entry lines that follow this comment.
		const entries = [];
		for (let j = i + 1; j < lines.length && entries.length < 7; j++) {
			const em = entryRe.exec(lines[j]);
			if (em) entries.push({ date: em[1], type: em[2], variation: em[3] });
			else if (commentRe.test(lines[j])) break; // next block started early
		}
		assert.equal(entries.length, 7, `block "${label} · Var ${varLetter}" near line ${i + 1}: expected 7 entries, saw ${entries.length}`);

		const [mon, tue, wed, thu, fri, sat, sun] = entries;
		assert.equal(mon.type, 'rest', `${mon.date}: block Monday must be rest`);
		if (label === 'Back') {
			assert.equal(tue.type, 'legs-hamstrings', `${tue.date}: Back week Tue must be legs-hamstrings`);
			assert.equal(wed.type, 'back', `${wed.date}: Back week Wed must be back`);
			assert.equal(thu.type, 'arms-triceps', `${thu.date}: Back week Thu must be arms-triceps`);
		} else {
			assert.equal(tue.type, 'legs-quads', `${tue.date}: Front week Tue must be legs-quads`);
			assert.equal(wed.type, 'chest', `${wed.date}: Front week Wed must be chest`);
			assert.equal(thu.type, 'arms-biceps', `${thu.date}: Front week Thu must be arms-biceps`);
		}
		assert.equal(fri.type, 'shoulders', `${fri.date}: Fri must be shoulders`);
		assert.equal(sat.type, 'running', `${sat.date}: Sat must be running`);
		assert.equal(sun.type, 'recovery', `${sun.date}: Sun must be recovery`);

		// Every non-rest entry carries the comment's declared variation.
		for (const e of entries.slice(1)) {
			assert.equal(e.variation, varLetter, `${e.date}: comment says Var ${varLetter} but entry is ${e.variation}`);
		}

		// getWeekType must agree with the comment's Front/Back label — including
		// the weekly shoulders parity (computed from CYCLE_ANCHOR).
		assert.equal(getWeekType(wed.type), `${label} Week`, `${wed.date}: getWeekType(${wed.type}) disagrees with comment "${label} Week"`);
		assert.equal(getWeekType('shoulders', fri.date), `${label} Week`, `${fri.date}: shoulders parity disagrees with comment "${label} Week"`);
		blocks++;
	}
	assert.equal(blocks, 26, `expected 26 full-week comment blocks, parsed ${blocks}`);
});

// ─── (d) Variation formula (AABB cycle, opening weekend = A) ─────────────────
check('(d) variation follows weekNumber % 4 ∈ {0,1} → A else B', () => {
	for (const [day, e] of Object.entries(SCHEDULE)) {
		if (e.type === 'rest') continue;
		const r = weekNumber(day) % 4;
		const expected = r === 0 || r === 1 ? 'A' : 'B';
		assert.equal(e.variation, expected, `${day}: week ${weekNumber(day)} → expected Var ${expected}, got ${e.variation}`);
	}
});

// ─── (e) Render reachability + unique item ids ──────────────────────────────
check('(e) every non-rest entry resolves, builds a non-empty item list, unique ids', () => {
	for (const [day, e] of Object.entries(SCHEDULE)) {
		if (e.type === 'rest') continue;
		const table = e.type === 'running' || e.type === 'recovery' ? RUNNING_DAYS : WORKOUTS;
		const workout = table[e.type]?.[e.variation];
		assert.ok(workout, `${day}: ${e.type}/${e.variation} not found — render() would blank the screen`);
		const items = buildItemList(workout);
		assert.ok(items.length > 0, `${day}: ${e.type}/${e.variation} builds an EMPTY item list`);
		const ids = items.map((it) => it.id);
		assert.equal(new Set(ids).size, ids.length, `${day}: duplicate item ids — stored ticks would collide`);
	}
});

// Collect every strength exercise (WORKOUTS + CORE) with a locating context,
// and every conditioning item (running stretches / cooldowns / drills).
const strength = []; // { ctx, ex }
for (const [type, vars] of Object.entries(WORKOUTS)) {
	for (const [v, wk] of Object.entries(vars)) {
		for (const ex of wk.exercises || []) strength.push({ ctx: `${type}/${v} "${ex.name}"`, ex });
	}
}
CORE.forEach((ex) => strength.push({ ctx: `CORE "${ex.name}"`, ex }));

const conditioning = []; // { ctx, item }
for (const [type, vars] of Object.entries(RUNNING_DAYS)) {
	for (const [v, wk] of Object.entries(vars)) {
		for (const key of ['stretching', 'cooldown', 'drills']) {
			for (const item of wk[key] || []) conditioning.push({ ctx: `${type}/${v} ${key} "${item.name}"`, item });
		}
	}
}
DRILLS.forEach((d) => conditioning.push({ ctx: `DRILLS "${d.name}"`, item: d }));

// ─── (f) Exercise shape ──────────────────────────────────────────────────────
check('(f) strength exercise shape: name/sets/reps/weight, allowlisted free-text, no stray fields', () => {
	const ALLOWED = new Set(['name', 'sets', 'reps', 'weight', 'note', 'cap', 'capKg', 'warn', 'stepKg', 'noIncrease']);
	const FREE_TEXT_REPS = new Set(['max']); // only intentional non-numeric reps
	const WEIGHT_RE = /^\d+(–\d+)?kg(\/side)?$/;

	for (const { ctx, ex } of strength) {
		assert.ok(typeof ex.name === 'string' && ex.name.trim(), `${ctx}: empty/non-string name`);
		assert.ok(Number.isInteger(ex.sets) && ex.sets > 0, `${ctx}: sets must be an integer > 0, got ${ex.sets}`);
		assert.ok(ex.reps !== undefined && ex.reps !== null, `${ctx}: reps missing`);
		// Free-text reps (no numeric target) must be intentional.
		if (!hasNumericTarget(ex.reps)) {
			assert.ok(FREE_TEXT_REPS.has(String(ex.reps)), `${ctx}: unintentional free-text reps ${JSON.stringify(ex.reps)}`);
		}
		if (ex.weight !== undefined) {
			assert.ok(WEIGHT_RE.test(ex.weight), `${ctx}: weight ${JSON.stringify(ex.weight)} fails /^\\d+(–\\d+)?kg(\\/side)?$/`);
		}
		for (const k of Object.keys(ex)) {
			assert.ok(ALLOWED.has(k), `${ctx}: stray field '${k}' (allowed: ${[...ALLOWED].join('/')})`);
		}
	}
});

check('(f) conditioning item shape: name/reps present, only name/reps/note fields', () => {
	const ALLOWED = new Set(['name', 'reps', 'note']);
	for (const { ctx, item } of conditioning) {
		assert.ok(typeof item.name === 'string' && item.name.trim(), `${ctx}: empty/non-string name`);
		assert.ok(item.reps !== undefined && item.reps !== null, `${ctx}: reps missing`);
		for (const k of Object.keys(item)) {
			assert.ok(ALLOWED.has(k), `${ctx}: stray field '${k}'`);
		}
	}
});

// ─── (f, F04-5 fold) XSS data-gate: no raw < > & in any display string ──────
check('(f) no display string contains a raw <, > or & (unescaped innerHTML gate)', () => {
	const BAD = /[<>&]/;
	const scan = (ctx, obj, fields) => {
		for (const f of fields) {
			const val = obj[f];
			if (typeof val === 'string' && BAD.test(val)) {
				assert.fail(`${ctx}: field '${f}' contains a raw <, > or & — would corrupt the card via innerHTML: ${JSON.stringify(val)}`);
			}
		}
	};
	for (const { ctx, ex } of strength) scan(ctx, ex, ['name', 'note', 'cap', 'warn', 'weight']);
	for (const { ctx, item } of conditioning) scan(ctx, item, ['name', 'note', 'reps']);
	// Workout titles also flow into the DOM.
	for (const [type, vars] of Object.entries({ ...WORKOUTS, ...RUNNING_DAYS })) {
		for (const [v, wk] of Object.entries(vars)) scan(`${type}/${v} title`, wk, ['title']);
	}
});

// ─── (g) Duplicates ──────────────────────────────────────────────────────────
check('(g) no duplicate exercise names within a workout; A/B never byte-identical', () => {
	const allTables = { ...WORKOUTS, ...RUNNING_DAYS };
	for (const [type, vars] of Object.entries(allTables)) {
		for (const [v, wk] of Object.entries(vars)) {
			const names = (wk.exercises || []).map((e) => e.name);
			assert.equal(new Set(names).size, names.length, `${type}/${v}: duplicate exercise name`);
		}
		if (vars.A && vars.B) {
			assert.notEqual(
				JSON.stringify(vars.A),
				JSON.stringify(vars.B),
				`${type}: A and B variations are byte-identical — one is a copy-paste mistake`,
			);
		}
	}
});

// ─── (h) coreType audit ──────────────────────────────────────────────────────
check('(h) coreType values are handled, handled branches are used', () => {
	// Branch-handled coreTypes, read from the workout.js source.
	const handled = new Set([...WORKOUT_SRC.matchAll(/coreType === '([^']+)'/g)].map((m) => m[1]));
	assert.ok(handled.has('anti-rotation'), 'workout.js should handle anti-rotation');

	// coreType values actually used in the data, with counts.
	const used = {};
	for (const vars of Object.values(WORKOUTS)) {
		for (const wk of Object.values(vars)) {
			if (wk.coreType) used[wk.coreType] = (used[wk.coreType] || 0) + 1;
		}
	}

	// Every data coreType must be handled by a branch.
	for (const ct of Object.keys(used)) {
		assert.ok(handled.has(ct), `coreType '${ct}' is set in data but no buildItemList branch handles it`);
	}

	// Every handled branch must be used by ≥1 workout — EXCEPT deliberately-dead
	// branches whitelisted here. 'anti-extension' was dropped from shoulders in
	// commit 239847b; its branch (if still present) is dead. Ticket
	// 03-trust-and-logic/08-anti-extension-cleanup.md removes the branch AND this
	// whitelist entry together.
	const DEAD_OK = new Set(['anti-extension']);
	for (const ct of handled) {
		if (used[ct]) continue;
		assert.ok(DEAD_OK.has(ct), `coreType branch '${ct}' is handled in workout.js but no workout uses it`);
	}

	// anti-rotation is used exactly 4× (chest A/B, back A/B).
	assert.equal(used['anti-rotation'], 4, `anti-rotation should be used 4×, saw ${used['anti-rotation']}`);

	// shoulders A/B intentionally have hasCore WITHOUT coreType (base CORE only).
	for (const v of ['A', 'B']) {
		assert.equal(WORKOUTS.shoulders[v].hasCore, true, `shoulders ${v} must have hasCore`);
		assert.equal(WORKOUTS.shoulders[v].coreType, undefined, `shoulders ${v} must NOT set a coreType (base CORE only)`);
	}
});

// ─── (i) Program constants ───────────────────────────────────────────────────
check('(i) program constants: label ↔ dates, anchor Monday, week numbers, DRILLS identity', () => {
	// PROGRAM_LABEL echoes START and END.
	const [sy, sm, sd] = parseKey(PROGRAM_START);
	const [ey, em, ed] = parseKey(PROGRAM_END);
	assert.ok(PROGRAM_LABEL.includes(`${MONTHS[sm - 1]} ${sd}`), `PROGRAM_LABEL missing start "${MONTHS[sm - 1]} ${sd}"`);
	assert.ok(PROGRAM_LABEL.includes(`${MONTHS[em - 1]} ${ed}`), `PROGRAM_LABEL missing end "${MONTHS[em - 1]} ${ed}"`);
	assert.ok(PROGRAM_LABEL.includes(String(ey)), `PROGRAM_LABEL missing year ${ey}`);

	// CYCLE_ANCHOR is the first Monday after PROGRAM_START.
	const start = new Date(sy, sm - 1, sd);
	const daysToMon = (1 - start.getDay() + 7) % 7 || 7; // strictly AFTER start
	const expectedAnchor = new Date(sy, sm - 1, sd + daysToMon);
	assert.equal(CYCLE_ANCHOR.getDay(), 1, 'CYCLE_ANCHOR must be a Monday');
	assert.equal(CYCLE_ANCHOR.getTime(), expectedAnchor.getTime(), `CYCLE_ANCHOR should be ${fmtDate(expectedAnchor)}, got ${fmtDate(CYCLE_ANCHOR)}`);

	// Week numbering pins.
	assert.equal(weekNumber(PROGRAM_START), 0, 'PROGRAM_START is week 0 (opening weekend)');
	assert.equal(weekNumber(fmtDate(CYCLE_ANCHOR)), 1, 'CYCLE_ANCHOR is week 1');
	assert.equal(weekNumber(PROGRAM_END), TOTAL_WEEKS, `PROGRAM_END should be week ${TOTAL_WEEKS}`);
	assert.equal(TOTAL_WEEKS, 26, 'TOTAL_WEEKS is 26');

	// All 4 running variants reference the shared DRILLS array by identity.
	const runners = [RUNNING_DAYS.running.A, RUNNING_DAYS.running.B, RUNNING_DAYS.recovery.A, RUNNING_DAYS.recovery.B];
	for (const r of runners) {
		assert.equal(r.drills, DRILLS, `${r.title}: drills must be the shared DRILLS array (identity)`);
	}
});

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'ALL SCHEDULE TESTS PASSED' : 'SCHEDULE TESTS FAILED'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
