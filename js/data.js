/*
 * data.js — The "database" of the app.
 *
 * No DOM and no localStorage — just the constants that describe the program,
 * plus the one pure resolver that turns a date into a day of it. Loading this
 * first means every other file can call scheduleFor() and read WORKOUTS /
 * RUNNING_DAYS without caring how they were built.
 *
 * scheduleFor(key) — 'YYYY-MM-DD' -> { type, variation }, generated from
 *              CYCLE_ANCHOR so the program repeats indefinitely (#194)
 * WORKOUTS   — gym workouts, looked up as WORKOUTS[type][variation]
 * RUNNING_DAYS — Sat/Sun running days, same [type][variation] shape
 * CORE       — the shared core block reused across several gym days
 * DRILLS     — the shared running-day drill list
 */

// ─── Node-only strings bootstrap (inert in the browser) ─────────────────────
// In the browser js/strings.js is a classic <script> loaded FIRST, so t() is
// already on the shared global scope by the time this file runs. Under Node
// each file gets its own module scope, so pull the bundle onto globalThis
// before the trees below evaluate their t() calls. `typeof t` on an undeclared
// identifier is safe, so this is a no-op in the browser.
if (typeof module !== 'undefined' && module.exports && typeof t === 'undefined') {
	Object.assign(globalThis, require('./strings.js'));
}

// ─── Program constants ──────────────────────────────────────────────────────
// The program has a START but deliberately NO END (#194): it repeats the same
// four-week cycle for as long as the user keeps training. PROGRAM_LABEL is the
// start date in prose, for the one screen that explains a pre-start date.
const PROGRAM_START  = '2026-05-23';
const PROGRAM_LABEL  = t('data.programLabel');
const CYCLE_ANCHOR   = new Date(2026, 4, 25); // Mon May 25 — cycle week 1. weekNumber() counts Mondays from here; getWeekType's internal parity index 0 = Back Week.
const CYCLE_WEEKS    = 4;

// ─── Schedule ──────────────────────────────────────────────────────────────
// A GENERATED map, not a literal one. Until #194 this was 184 hand-written
// date keys ending on 2026-11-22, and the day after the last key the app had
// nothing to render — the program simply stopped. The 184 entries were never
// bespoke, though: every one of them is a pure function of the date's offset
// from CYCLE_ANCHOR, so the table below IS those entries, folded into the one
// four-week cycle they always repeated. scheduleFor() replays it forever.
//
// Rows are the four cycle weeks; columns are Mon–Sun (index 0 = Monday, which
// is why CYCLE_ANCHOR must stay a Monday). Var A/B alternates A-B-B-A across
// the four weeks, so a given workout variant recurs every 28 days — the
// interval the "add 2.5 kg when 12 reps feels easy" progression assumes.
const CYCLE_TYPES = [
	['rest', 'legs-hamstrings', 'back',  'arms-triceps', 'shoulders', 'running', 'recovery'],
	['rest', 'legs-quads',      'chest', 'arms-biceps',  'shoulders', 'running', 'recovery'],
	['rest', 'legs-hamstrings', 'back',  'arms-triceps', 'shoulders', 'running', 'recovery'],
	['rest', 'legs-quads',      'chest', 'arms-biceps',  'shoulders', 'running', 'recovery'],
];
const CYCLE_VARIATIONS = ['A', 'B', 'B', 'A'];

// The one schedule lookup: a 'YYYY-MM-DD' key -> { type, variation }, or
// undefined for anything before PROGRAM_START or not a real calendar date.
// Replaces every former `SCHEDULE[key]` index, and never returns undefined for
// a valid date on or after the start — that is the whole point of #194.
//
// Rest days carry NO variation, exactly as the old literal wrote them: the
// storage key is `ws-<date>-<type>-<variation||'x'>` (js/storage.js), so
// adding one would silently orphan every saved rest-day record.
function scheduleFor(key) {
	if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
	if (key < PROGRAM_START) return undefined;
	const [y, m, d] = key.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	// Reject a rolled-over date ('2026-02-31' → Mar 3) so a corrupt stored key
	// still fails the lookup instead of resolving to some other day's workout.
	if (fmtDayKey(date) !== key) return undefined;
	// Math.round, not a floor divide: a DST boundary between the anchor and the
	// date makes the difference 23 or 25 hours, and rounding absorbs it. Same
	// idiom weekNumber() (js/workout.js) uses.
	const days = Math.round((date - CYCLE_ANCHOR) / 86400000);
	const cycleDays = CYCLE_WEEKS * 7;
	const i = ((days % cycleDays) + cycleDays) % cycleDays; // negative-safe (opening weekend precedes the anchor)
	const week = Math.floor(i / 7);
	const type = CYCLE_TYPES[week][i % 7];
	return type === 'rest' ? { type } : { type, variation: CYCLE_VARIATIONS[week] };
}

// A Date -> 'YYYY-MM-DD' in LOCAL time (toISOString would shift the day for
// anyone east or west of UTC). workout.js's todayKey() is the same formatter
// over `new Date()`; this one exists here because scheduleFor() loads first.
function fmtDayKey(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// ─── Exercise Database ──────────────────────────────────────────────────────
// Every user-facing string below is a t() lookup into the keyed bundle
// (js/strings.js, #189): the shape of these trees is unchanged, only the
// literals moved out. `coreType` stays a literal — it is an internal branch
// discriminator workout.js compares with ===, never rendered copy.
const CORE = [
	{ name: t('data.core.0.name'), sets: 3, reps: 10 },
	{ name: t('data.core.1.name'), sets: 3, reps: 12 },
	{
		name: t('data.core.2.name'),
		sets: 3,
		reps: 15,
		note: t('data.core.2.note'),
	},
];

const WORKOUTS = {
	'legs-quads': {
		A: {
			title: t('data.workouts.legsQuadsA.title'),
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: t('data.workouts.legsQuadsA.exercises.0.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.legsQuadsA.exercises.0.weight'),
					cap: t('data.workouts.legsQuadsA.exercises.0.cap'),
					warn: t('data.workouts.legsQuadsA.exercises.0.warn'),
				},
				{
					name: t('data.workouts.legsQuadsA.exercises.1.name'),
					sets: 3,
					reps: 12,
					cap: t('data.workouts.legsQuadsA.exercises.1.cap'),
				},
				{
					name: t('data.workouts.legsQuadsA.exercises.2.name'),
					sets: 3,
					reps: 12,
					note: t('data.workouts.legsQuadsA.exercises.2.note'),
					cap: t('data.workouts.legsQuadsA.exercises.2.cap'),
				},
				{
					name: t('data.workouts.legsQuadsA.exercises.3.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.legsQuadsA.exercises.3.weight'),
					note: t('data.workouts.legsQuadsA.exercises.3.note'),
				},
			],
		},
		B: {
			title: t('data.workouts.legsQuadsB.title'),
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: t('data.workouts.legsQuadsB.exercises.0.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.legsQuadsB.exercises.1.name'),
					sets: 3,
					reps: t('data.workouts.legsQuadsB.exercises.1.reps'),
					note: t('data.workouts.legsQuadsB.exercises.1.note'),
					cap: t('data.workouts.legsQuadsB.exercises.1.cap'),
					warn: t('data.workouts.legsQuadsB.exercises.1.warn'),
				},
				{
					name: t('data.workouts.legsQuadsB.exercises.2.name'),
					sets: 3,
					reps: 12,
					cap: t('data.workouts.legsQuadsB.exercises.2.cap'),
				},
			],
		},
	},
	'legs-hamstrings': {
		A: {
			title: t('data.workouts.legsHamstringsA.title'),
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: t('data.workouts.legsHamstringsA.exercises.0.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.legsHamstringsA.exercises.0.weight'),
					cap: t('data.workouts.legsHamstringsA.exercises.0.cap'),
					warn: t('data.workouts.legsHamstringsA.exercises.0.warn'),
				},
				{
					name: t('data.workouts.legsHamstringsA.exercises.1.name'),
					sets: 3,
					reps: 10,
					cap: t('data.workouts.legsHamstringsA.exercises.1.cap'),
				},
				{
					name: t('data.workouts.legsHamstringsA.exercises.2.name'),
					sets: 3,
					reps: 12,
					note: t('data.workouts.legsHamstringsA.exercises.2.note'),
					cap: t('data.workouts.legsHamstringsA.exercises.2.cap'),
				},
				{
					name: t('data.workouts.legsHamstringsA.exercises.3.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.legsHamstringsA.exercises.3.weight'),
				},
			],
		},
		B: {
			title: t('data.workouts.legsHamstringsB.title'),
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: t('data.workouts.legsHamstringsB.exercises.0.name'),
					sets: 3,
					reps: 10,
					cap: t('data.workouts.legsHamstringsB.exercises.0.cap'),
				},
				{
					name: t('data.workouts.legsHamstringsB.exercises.1.name'),
					sets: 3,
					reps: t('data.workouts.legsHamstringsB.exercises.1.reps'),
					note: t('data.workouts.legsHamstringsB.exercises.1.note'),
					cap: t('data.workouts.legsHamstringsB.exercises.1.cap'),
					warn: t('data.workouts.legsHamstringsB.exercises.1.warn'),
				},
				{
					name: t('data.workouts.legsHamstringsB.exercises.2.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.legsHamstringsB.exercises.2.weight'),
				},
			],
		},
	},
	chest: {
		A: {
			title: t('data.workouts.chestA.title'),
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.chestA.exercises.0.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.chestA.exercises.1.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.chestA.exercises.1.weight'),
					cap: t('data.workouts.chestA.exercises.1.cap'),
					warn: t('data.workouts.chestA.exercises.1.warn'),
				},
				{
					name: t('data.workouts.chestA.exercises.2.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.chestA.exercises.3.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.chestA.exercises.4.name'),
					sets: 3,
					reps: 15,
					weight: t('data.workouts.chestA.exercises.4.weight'),
				},
			],
		},
		B: {
			title: t('data.workouts.chestB.title'),
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.chestB.exercises.0.name'),
					sets: 3,
					reps: 15,
				},
				{
					name: t('data.workouts.chestB.exercises.1.name'),
					sets: 3,
					reps: 10,
					cap: t('data.workouts.chestB.exercises.1.cap'),
				},
				{
					name: t('data.workouts.chestB.exercises.2.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.chestB.exercises.3.name'),
					sets: 3,
					reps: 12,
					cap: t('data.workouts.chestB.exercises.3.cap'),
				},
				{
					name: t('data.workouts.chestB.exercises.4.name'),
					sets: 3,
					reps: 15,
					weight: t('data.workouts.chestB.exercises.4.weight'),
				},
			],
		},
	},
	back: {
		A: {
			title: t('data.workouts.backA.title'),
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.backA.exercises.0.name'),
					sets: 3,
					reps: t('data.workouts.backA.exercises.0.reps'),
					note: t('data.workouts.backA.exercises.0.note'),
				},
				{
					name: t('data.workouts.backA.exercises.1.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.backA.exercises.2.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.backA.exercises.3.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.backA.exercises.3.weight'),
					cap: t('data.workouts.backA.exercises.3.cap'),
					warn: t('data.workouts.backA.exercises.3.warn'),
				},
				{
					name: t('data.workouts.backA.exercises.4.name'),
					sets: 3,
					reps: 15,
					weight: t('data.workouts.backA.exercises.4.weight'),
				},
			],
		},
		B: {
			title: t('data.workouts.backB.title'),
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.backB.exercises.0.name'),
					sets: 3,
					reps: 10,
					note: t('data.workouts.backB.exercises.0.note'),
				},
				{
					name: t('data.workouts.backB.exercises.1.name'),
					sets: 3,
					reps: t('data.workouts.backB.exercises.1.reps'),
					note: t('data.workouts.backB.exercises.1.note'),
					cap: t('data.workouts.backB.exercises.1.cap'),
				},
				{
					name: t('data.workouts.backB.exercises.2.name'),
					sets: 3,
					reps: 15,
				},
				{
					name: t('data.workouts.backB.exercises.3.name'),
					sets: 3,
					reps: 10,
					cap: t('data.workouts.backB.exercises.3.cap'),
					warn: t('data.workouts.backB.exercises.3.warn'),
				},
				{
					name: t('data.workouts.backB.exercises.4.name'),
					sets: 3,
					reps: 15,
					weight: t('data.workouts.backB.exercises.4.weight'),
				},
			],
		},
	},
	'arms-biceps': {
		A: {
			title: t('data.workouts.armsBicepsA.title'),
			hasStairmaster: true,
			// 'armConditioning' = the arm-day conditioning slot — it emits the Ankle Stability block (running prehab), not arm work.
			armConditioning: true,
			exercises: [
				{
					name: t('data.workouts.armsBicepsA.exercises.0.name'),
					sets: 3,
					reps: t('data.workouts.armsBicepsA.exercises.0.reps'),
				},
				{
					name: t('data.workouts.armsBicepsA.exercises.1.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.armsBicepsA.exercises.1.weight'),
				},
				{
					name: t('data.workouts.armsBicepsA.exercises.2.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.armsBicepsA.exercises.2.weight'),
				},
				{
					name: t('data.workouts.armsBicepsA.exercises.3.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.armsBicepsA.exercises.3.weight'),
				},
			],
		},
		B: {
			title: t('data.workouts.armsBicepsB.title'),
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{
					name: t('data.workouts.armsBicepsB.exercises.0.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.armsBicepsB.exercises.0.weight'),
				},
				{
					name: t('data.workouts.armsBicepsB.exercises.1.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.armsBicepsB.exercises.2.name'),
					sets: 3,
					reps: 12,
					weight: t('data.workouts.armsBicepsB.exercises.2.weight'),
				},
				{
					name: t('data.workouts.armsBicepsB.exercises.3.name'),
					sets: 3,
					reps: 12,
				},
			],
		},
	},
	'arms-triceps': {
		A: {
			title: t('data.workouts.armsTricepsA.title'),
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{
					name: t('data.workouts.armsTricepsA.exercises.0.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.armsTricepsA.exercises.1.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.armsTricepsA.exercises.2.name'),
					sets: 3,
					reps: 12,
				},
			],
		},
		B: {
			title: t('data.workouts.armsTricepsB.title'),
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{
					name: t('data.workouts.armsTricepsB.exercises.0.name'),
					sets: 3,
					reps: 12,
				},
				{
					name: t('data.workouts.armsTricepsB.exercises.1.name'),
					sets: 3,
					reps: 15,
				},
				{
					name: t('data.workouts.armsTricepsB.exercises.2.name'),
					sets: 3,
					reps: 12,
				},
			],
		},
	},
	shoulders: {
		A: {
			title: t('data.workouts.shouldersA.title'),
			hasCore: true,
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.shouldersA.exercises.0.name'),
					sets: 4,
					reps: 15,
					weight: t('data.workouts.shouldersA.exercises.0.weight'),
					note: t('data.workouts.shouldersA.exercises.0.note'),
				},
				{
					name: t('data.workouts.shouldersA.exercises.1.name'),
					sets: 3,
					reps: 10,
					weight: t('data.workouts.shouldersA.exercises.1.weight'),
					cap: t('data.workouts.shouldersA.exercises.1.cap'),
					warn: t('data.workouts.shouldersA.exercises.1.warn'),
				},
				{
					name: t('data.workouts.shouldersA.exercises.2.name'),
					sets: 3,
					reps: 15,
					note: t('data.workouts.shouldersA.exercises.2.note'),
				},
				{
					name: t('data.workouts.shouldersA.exercises.3.name'),
					sets: 2,
					reps: 20,
					weight: t('data.workouts.shouldersA.exercises.3.weight'),
				},
			],
		},
		B: {
			title: t('data.workouts.shouldersB.title'),
			hasCore: true,
			hasInclineTreadmill: true,
			exercises: [
				{
					name: t('data.workouts.shouldersB.exercises.0.name'),
					sets: 4,
					reps: 15,
					weight: t('data.workouts.shouldersB.exercises.0.weight'),
					note: t('data.workouts.shouldersB.exercises.0.note'),
				},
				{
					name: t('data.workouts.shouldersB.exercises.1.name'),
					sets: 3,
					reps: 12,
					cap: t('data.workouts.shouldersB.exercises.1.cap'),
					note: t('data.workouts.shouldersB.exercises.1.note'),
				},
				{
					name: t('data.workouts.shouldersB.exercises.2.name'),
					sets: 3,
					reps: t('data.workouts.shouldersB.exercises.2.reps'),
				},
				{
					name: t('data.workouts.shouldersB.exercises.3.name'),
					sets: 3,
					reps: 15,
					note: t('data.workouts.shouldersB.exercises.3.note'),
				},
				{
					name: t('data.workouts.shouldersB.exercises.4.name'),
					sets: 2,
					reps: 20,
					weight: t('data.workouts.shouldersB.exercises.4.weight'),
				},
			],
		},
	},
};

// Shared drill list — referenced by every running-day variation below.
const DRILLS = [
	{ name: t('data.drills.0.name'), reps: t('data.drills.0.reps') },
	{ name: t('data.drills.1.name'), reps: t('data.drills.1.reps') },
	{ name: t('data.drills.2.name'), reps: t('data.drills.2.reps') },
	{ name: t('data.drills.3.name'), reps: t('data.drills.3.reps') },
	{ name: t('data.drills.4.name'), reps: t('data.drills.4.reps') },
	{ name: t('data.drills.5.name'), reps: t('data.drills.5.reps') },
	{ name: t('data.drills.6.name'), reps: t('data.drills.6.reps') },
	{
		name: t('data.drills.7.name'),
		reps: t('data.drills.7.reps'),
		note: t('data.drills.7.note'),
	},
	{ name: t('data.drills.8.name'), reps: t('data.drills.8.reps') },
];

const RUNNING_DAYS = {
	running: {
		A: {
			title: t('data.runningDays.runningA.title'),
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{
					name: t('data.runningDays.runningA.stretching.0.name'),
					reps: t('data.runningDays.runningA.stretching.0.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.1.name'),
					reps: t('data.runningDays.runningA.stretching.1.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.2.name'),
					reps: t('data.runningDays.runningA.stretching.2.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.3.name'),
					reps: t('data.runningDays.runningA.stretching.3.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.4.name'),
					reps: t('data.runningDays.runningA.stretching.4.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.5.name'),
					reps: t('data.runningDays.runningA.stretching.5.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.6.name'),
					reps: t('data.runningDays.runningA.stretching.6.reps'),
				},
				{
					name: t('data.runningDays.runningA.stretching.7.name'),
					reps: t('data.runningDays.runningA.stretching.7.reps'),
				},
			],
			cooldown: [
				{
					name: t('data.runningDays.runningA.cooldown.0.name'),
					reps: t('data.runningDays.runningA.cooldown.0.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.1.name'),
					reps: t('data.runningDays.runningA.cooldown.1.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.2.name'),
					reps: t('data.runningDays.runningA.cooldown.2.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.3.name'),
					reps: t('data.runningDays.runningA.cooldown.3.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.4.name'),
					reps: t('data.runningDays.runningA.cooldown.4.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.5.name'),
					reps: t('data.runningDays.runningA.cooldown.5.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.6.name'),
					reps: t('data.runningDays.runningA.cooldown.6.reps'),
				},
				{
					name: t('data.runningDays.runningA.cooldown.7.name'),
					reps: t('data.runningDays.runningA.cooldown.7.reps'),
				},
			],
		},
		B: {
			title: t('data.runningDays.runningB.title'),
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{
					name: t('data.runningDays.runningB.stretching.0.name'),
					reps: t('data.runningDays.runningB.stretching.0.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.1.name'),
					reps: t('data.runningDays.runningB.stretching.1.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.2.name'),
					reps: t('data.runningDays.runningB.stretching.2.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.3.name'),
					reps: t('data.runningDays.runningB.stretching.3.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.4.name'),
					reps: t('data.runningDays.runningB.stretching.4.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.5.name'),
					reps: t('data.runningDays.runningB.stretching.5.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.6.name'),
					reps: t('data.runningDays.runningB.stretching.6.reps'),
				},
				{
					name: t('data.runningDays.runningB.stretching.7.name'),
					reps: t('data.runningDays.runningB.stretching.7.reps'),
				},
			],
			cooldown: [
				{
					name: t('data.runningDays.runningB.cooldown.0.name'),
					reps: t('data.runningDays.runningB.cooldown.0.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.1.name'),
					reps: t('data.runningDays.runningB.cooldown.1.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.2.name'),
					reps: t('data.runningDays.runningB.cooldown.2.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.3.name'),
					reps: t('data.runningDays.runningB.cooldown.3.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.4.name'),
					reps: t('data.runningDays.runningB.cooldown.4.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.5.name'),
					reps: t('data.runningDays.runningB.cooldown.5.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.6.name'),
					reps: t('data.runningDays.runningB.cooldown.6.reps'),
				},
				{
					name: t('data.runningDays.runningB.cooldown.7.name'),
					reps: t('data.runningDays.runningB.cooldown.7.reps'),
				},
			],
		},
	},
	recovery: {
		A: {
			title: t('data.runningDays.recoveryA.title'),
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{
					name: t('data.runningDays.recoveryA.stretching.0.name'),
					reps: t('data.runningDays.recoveryA.stretching.0.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.1.name'),
					reps: t('data.runningDays.recoveryA.stretching.1.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.2.name'),
					reps: t('data.runningDays.recoveryA.stretching.2.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.3.name'),
					reps: t('data.runningDays.recoveryA.stretching.3.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.4.name'),
					reps: t('data.runningDays.recoveryA.stretching.4.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.5.name'),
					reps: t('data.runningDays.recoveryA.stretching.5.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.6.name'),
					reps: t('data.runningDays.recoveryA.stretching.6.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.stretching.7.name'),
					reps: t('data.runningDays.recoveryA.stretching.7.reps'),
				},
			],
			cooldown: [
				{
					name: t('data.runningDays.recoveryA.cooldown.0.name'),
					reps: t('data.runningDays.recoveryA.cooldown.0.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.1.name'),
					reps: t('data.runningDays.recoveryA.cooldown.1.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.2.name'),
					reps: t('data.runningDays.recoveryA.cooldown.2.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.3.name'),
					reps: t('data.runningDays.recoveryA.cooldown.3.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.4.name'),
					reps: t('data.runningDays.recoveryA.cooldown.4.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.5.name'),
					reps: t('data.runningDays.recoveryA.cooldown.5.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.6.name'),
					reps: t('data.runningDays.recoveryA.cooldown.6.reps'),
				},
				{
					name: t('data.runningDays.recoveryA.cooldown.7.name'),
					reps: t('data.runningDays.recoveryA.cooldown.7.reps'),
				},
			],
		},
		B: {
			title: t('data.runningDays.recoveryB.title'),
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{
					name: t('data.runningDays.recoveryB.stretching.0.name'),
					reps: t('data.runningDays.recoveryB.stretching.0.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.1.name'),
					reps: t('data.runningDays.recoveryB.stretching.1.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.2.name'),
					reps: t('data.runningDays.recoveryB.stretching.2.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.3.name'),
					reps: t('data.runningDays.recoveryB.stretching.3.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.4.name'),
					reps: t('data.runningDays.recoveryB.stretching.4.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.5.name'),
					reps: t('data.runningDays.recoveryB.stretching.5.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.6.name'),
					reps: t('data.runningDays.recoveryB.stretching.6.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.stretching.7.name'),
					reps: t('data.runningDays.recoveryB.stretching.7.reps'),
				},
			],
			cooldown: [
				{
					name: t('data.runningDays.recoveryB.cooldown.0.name'),
					reps: t('data.runningDays.recoveryB.cooldown.0.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.1.name'),
					reps: t('data.runningDays.recoveryB.cooldown.1.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.2.name'),
					reps: t('data.runningDays.recoveryB.cooldown.2.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.3.name'),
					reps: t('data.runningDays.recoveryB.cooldown.3.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.4.name'),
					reps: t('data.runningDays.recoveryB.cooldown.4.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.5.name'),
					reps: t('data.runningDays.recoveryB.cooldown.5.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.6.name'),
					reps: t('data.runningDays.recoveryB.cooldown.6.reps'),
				},
				{
					name: t('data.runningDays.recoveryB.cooldown.7.name'),
					reps: t('data.runningDays.recoveryB.cooldown.7.reps'),
				},
			],
		},
	},
};

// ─── Node-only test exports ──────────────────────────────────────────────────
// In the browser this whole block is inert: `module` is not declared in a
// classic script, and `typeof` on an undeclared identifier is safe ('undefined').
// Under Node's require() each file gets its own module scope instead of the
// one shared global scope classic <script> tags give us — so besides exporting,
// re-create that shared scope by copying the consts onto globalThis. That lets
// workout.js resolve CORE / CYCLE_WEEKS / CYCLE_ANCHOR at call time, exactly
// like it does in the browser.
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		PROGRAM_START,
		PROGRAM_LABEL,
		CYCLE_ANCHOR,
		CYCLE_WEEKS,
		CYCLE_TYPES,
		CYCLE_VARIATIONS,
		scheduleFor,
		fmtDayKey,
		CORE,
		WORKOUTS,
		DRILLS,
		RUNNING_DAYS,
	};
	Object.assign(globalThis, module.exports);
}
