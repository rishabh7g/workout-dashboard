// Standalone schedule-integrity test for js/data.js (#35, #194).
//
// js/data.js is a hand-edited file that IS the app: the generated schedule,
// 14 workout variants, CORE, DRILLS. render() (js/ui.js) does
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

const {
	scheduleFor,
	WORKOUTS,
	RUNNING_DAYS,
	CORE,
	DRILLS,
	PROGRAM_START,
	PROGRAM_LABEL,
	CYCLE_ANCHOR,
	CYCLE_WEEKS,
} = data;
const { buildItemList, weekNumber, getWeekType, cycleWeek } = w;

// The 184 days the schedule used to be a literal map of (2026-05-23 …
// 2026-11-22), frozen at the commit that replaced it (#194). Every check that
// used to iterate SCHEDULE's keys iterates this instead, and check (c) below
// asserts the generator reproduces it entry for entry — that file is the
// contract that existing `ws-<date>-<type>-<var>` records still resolve.
const LEGACY = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'schedule-2026-legacy.json'), 'utf8'),
);
const LEGACY_END = '2026-11-22';

// Consecutive 'YYYY-MM-DD' keys from `start` — the generated schedule has no
// key list to enumerate, so every walk below is over a date span.
function dayKeysFrom(start, count) {
	const [y, m, d] = parseKey(start);
	const keys = [];
	for (let i = 0; i < count; i++) keys.push(fmtDate(new Date(y, m - 1, d + i)));
	return keys;
}

// The span the shape checks run over: the original program plus four more
// years, so every check that used to see 184 days now also sees the days the
// generator invents past the old end.
const SPAN = dayKeysFrom(PROGRAM_START, 184 + 365 * 4);
const SCHEDULE = Object.fromEntries(SPAN.map((k) => [k, scheduleFor(k)]));

// Whether a reps value carries any numeric target at all (a bare number, a
// range, or a qualified count) versus pure free text like 'max'.
const hasNumericTarget = (reps) => /\d/.test(String(reps));

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

// Sanity: the exports we depend on actually loaded.
check('data.js + workout.js exports load', () => {
	assert.ok(WORKOUTS && RUNNING_DAYS && CORE && DRILLS, 'data exports present');
	assert.equal(typeof scheduleFor, 'function', 'scheduleFor exported');
	assert.equal(typeof buildItemList, 'function', 'buildItemList exported');
	assert.equal(typeof weekNumber, 'function', 'weekNumber exported');
	assert.equal(typeof getWeekType, 'function', 'getWeekType exported');
	assert.equal(typeof cycleWeek, 'function', 'cycleWeek exported');
	assert.equal(CYCLE_WEEKS, 4, 'CYCLE_WEEKS is 4');
});

// ─── (a) Coverage: the schedule never runs out (#194) ───────────────────────
check('(a) every date from PROGRAM_START on resolves, forever; nothing before it does', () => {
	// The bug this replaced: SCHEDULE was a literal map whose last key was
	// 2026-11-22, so 2026-11-23 resolved to nothing and the app showed the
	// "outside the current program" screen from then on, permanently.
	assert.ok(scheduleFor('2026-11-23'), 'the day after the old end date must resolve');

	// Four years of days, every one of them a real entry pointing at a real
	// workout table (rest days carry no variation, exactly as before).
	const TYPES = new Set([
		'rest', 'legs-hamstrings', 'legs-quads', 'back', 'chest',
		'arms-triceps', 'arms-biceps', 'shoulders', 'running', 'recovery',
	]);
	for (const k of SPAN) {
		const e = scheduleFor(k);
		assert.ok(e, `${k}: no entry — the schedule ran out`);
		assert.ok(TYPES.has(e.type), `${k}: unknown type ${e.type}`);
		if (e.type === 'rest') {
			assert.equal(e.variation, undefined, `${k}: rest days must carry no variation (storage key is ws-<date>-rest-x)`);
		} else {
			assert.ok(e.variation === 'A' || e.variation === 'B', `${k}: variation must be A or B, got ${e.variation}`);
		}
	}

	// A decade out, still nothing but real training days.
	for (const k of dayKeysFrom('2036-01-01', 366)) {
		assert.ok(scheduleFor(k), `${k}: no entry a decade out`);
	}

	// Before the program began, and for junk keys, the lookup must still MISS —
	// resolveEffectiveEntry (js/ui.js) self-heals a dangling borrow on exactly
	// this, and a rolled-over date must never silently answer as another day.
	for (const k of ['2026-05-22', '2025-12-31', '1999-01-01']) {
		assert.equal(scheduleFor(k), undefined, `${k}: dates before PROGRAM_START must not resolve`);
	}
	for (const k of ['2026-02-31', 'tomorrow', '2026-5-25', '', null, undefined]) {
		assert.equal(scheduleFor(k), undefined, `${JSON.stringify(k)}: invalid key must not resolve`);
	}
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

	// Per-type counts over the ORIGINAL 184-day program — pinned exactly as
	// before, now as a property of the generator rather than of a literal map.
	const EXPECT = {
		rest: 26, running: 27, recovery: 27, shoulders: 26,
		back: 13, chest: 13, 'legs-hamstrings': 13, 'legs-quads': 13,
		'arms-triceps': 13, 'arms-biceps': 13,
	};
	const tally = {};
	for (const k of Object.keys(LEGACY)) {
		const e = scheduleFor(k);
		tally[e.type] = (tally[e.type] || 0) + 1;
	}
	assert.deepEqual(tally, EXPECT, `per-type counts mismatch: ${JSON.stringify(tally)}`);

	// And over any whole number of cycles the mix is exactly even: one of each
	// gym day per 28 days, four rests, four runs, four recoveries.
	const cycle = {};
	for (const k of dayKeysFrom('2026-05-25', 28)) {
		const e = scheduleFor(k);
		cycle[e.type] = (cycle[e.type] || 0) + 1;
	}
	assert.deepEqual(
		cycle,
		{
			rest: 4, running: 4, recovery: 4, shoulders: 4,
			back: 2, chest: 2, 'legs-hamstrings': 2, 'legs-quads': 2,
			'arms-triceps': 2, 'arms-biceps': 2,
		},
		`one cycle's mix is uneven: ${JSON.stringify(cycle)}`,
	);
});

// ─── (c) Regression: the generator reproduces the old literal map ───────────
// THE load-bearing check of #194. The 184 hand-written entries this generator
// replaced are frozen in tests/schedule-2026-legacy.json. Every one must come
// back byte-identical — not just the type, but the presence/absence of
// `variation` too, because the localStorage key is `ws-<date>-<type>-<var||x>`
// (stateKey, js/storage.js). One drifted entry silently orphans a real day of
// saved progress and hands back a different workout's ticks.
check('(c) all 184 legacy entries regenerate byte-identically (saved state still resolves)', () => {
	const legacyKeys = Object.keys(LEGACY);
	assert.equal(legacyKeys.length, 184, `fixture should hold 184 days, has ${legacyKeys.length}`);
	assert.equal(legacyKeys[0], PROGRAM_START, 'fixture starts at PROGRAM_START');
	assert.equal(legacyKeys[legacyKeys.length - 1], LEGACY_END, `fixture ends at ${LEGACY_END}`);

	// The fixture must cover that span with no gaps, or "all 184 match" would
	// be a weaker claim than it reads as.
	assert.deepEqual(legacyKeys, dayKeysFrom(PROGRAM_START, 184), 'fixture is not the contiguous 184-day span');

	const drift = [];
	for (const k of legacyKeys) {
		const got = scheduleFor(k);
		if (JSON.stringify(got) !== JSON.stringify(LEGACY[k])) {
			drift.push(`${k}: was ${JSON.stringify(LEGACY[k])}, now ${JSON.stringify(got)}`);
		}
	}
	assert.deepEqual(drift, [], `generated schedule differs from the frozen literal:\n      ${drift.slice(0, 10).join('\n      ')}`);

	// The storage keys themselves, spelled out — the thing the user's saved
	// progress is actually filed under.
	const sk = (k, e) => (e ? `ws-${k}-${e.type}-${e.variation || 'x'}` : `ws-${k}`);
	for (const k of legacyKeys) {
		assert.equal(sk(k, scheduleFor(k)), sk(k, LEGACY[k]), `${k}: storage key changed — saved progress would be orphaned`);
	}

	// Negative control: the comparison above is capable of failing. A key
	// shifted by one day must NOT match, or the loop is proving nothing.
	assert.notEqual(
		JSON.stringify(scheduleFor('2026-05-26')),
		JSON.stringify(LEGACY['2026-05-27']),
		'sanity: adjacent days should differ — the comparison would pass on anything',
	);
});

// ─── (c2) The cycle repeats exactly, forever ────────────────────────────────
check('(c2) every date resolves identically to the date 28 days before it', () => {
	// The whole open-ended promise in one line: the schedule is periodic with a
	// 28-day period from PROGRAM_START on, so "what do I do in 2031?" has the
	// same answer shape as week 1 and can never run out.
	const span = dayKeysFrom('2026-06-20', 365 * 5);
	for (const k of span) {
		const [y, m, d] = parseKey(k);
		const prev = fmtDate(new Date(y, m - 1, d - 28));
		assert.deepEqual(scheduleFor(k), scheduleFor(prev), `${k}: differs from ${prev}, 28 days earlier`);
	}
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
	const ALLOWED = new Set(['name', 'sets', 'reps', 'weight', 'note', 'cap', 'warn']);
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
	// PROGRAM_LABEL names the start date and nothing else — there is no end
	// date to echo any more (#194), and a label claiming one would be a lie on
	// the only screen that shows it.
	const [sy, sm, sd] = parseKey(PROGRAM_START);
	assert.ok(PROGRAM_LABEL.includes(String(sd)), `PROGRAM_LABEL missing start day "${sd}"`);
	assert.ok(PROGRAM_LABEL.includes(MONTHS[sm - 1]), `PROGRAM_LABEL missing start month "${MONTHS[sm - 1]}"`);
	assert.ok(PROGRAM_LABEL.includes(String(sy)), `PROGRAM_LABEL missing year ${sy}`);

	// CYCLE_ANCHOR is the first Monday after PROGRAM_START.
	const start = new Date(sy, sm - 1, sd);
	const daysToMon = (1 - start.getDay() + 7) % 7 || 7; // strictly AFTER start
	const expectedAnchor = new Date(sy, sm - 1, sd + daysToMon);
	assert.equal(CYCLE_ANCHOR.getDay(), 1, 'CYCLE_ANCHOR must be a Monday');
	assert.equal(CYCLE_ANCHOR.getTime(), expectedAnchor.getTime(), `CYCLE_ANCHOR should be ${fmtDate(expectedAnchor)}, got ${fmtDate(CYCLE_ANCHOR)}`);

	// Week numbering pins. weekNumber() still counts program position without a
	// ceiling; cycleWeek() is what the UI shows, and it is always in range.
	assert.equal(weekNumber(PROGRAM_START), 0, 'PROGRAM_START is week 0 (opening weekend)');
	assert.equal(weekNumber(fmtDate(CYCLE_ANCHOR)), 1, 'CYCLE_ANCHOR is week 1');
	assert.equal(weekNumber(LEGACY_END), 26, `${LEGACY_END} is still program week 26`);
	assert.ok(weekNumber('2031-01-06') > 26, 'weekNumber keeps counting past the old program length');
	assert.equal(CYCLE_WEEKS, 4, 'CYCLE_WEEKS is 4');
	assert.equal(cycleWeek(fmtDate(CYCLE_ANCHOR)), 1, 'the anchor week is cycle week 1');
	for (const k of dayKeysFrom(fmtDate(CYCLE_ANCHOR), 365 * 4)) {
		const n = cycleWeek(k);
		assert.ok(n >= 1 && n <= CYCLE_WEEKS, `${k}: cycleWeek ${n} outside 1..${CYCLE_WEEKS}`);
	}

	// All 4 running variants reference the shared DRILLS array by identity.
	const runners = [RUNNING_DAYS.running.A, RUNNING_DAYS.running.B, RUNNING_DAYS.recovery.A, RUNNING_DAYS.recovery.B];
	for (const r of runners) {
		assert.equal(r.drills, DRILLS, `${r.title}: drills must be the shared DRILLS array (identity)`);
	}
});

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'ALL SCHEDULE TESTS PASSED' : 'SCHEDULE TESTS FAILED'} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
