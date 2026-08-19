/*
 * data.js — The "database" of the app.
 *
 * Pure data only: no DOM, no functions, no localStorage. Just the constants
 * that describe the program. Loading this first means every other file can
 * read SCHEDULE / WORKOUTS / RUNNING_DAYS without caring how they were built.
 *
 * SCHEDULE   — maps a date string -> { type, variation }
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
const PROGRAM_START  = '2026-05-23';
const PROGRAM_END    = '2026-11-22';
const PROGRAM_LABEL  = 'May 23 – Nov 22, 2026';
const CYCLE_ANCHOR   = new Date(2026, 4, 25); // Mon May 25 — cycle anchor. Displayed as Week 1/26 by weekNumber(); getWeekType's internal parity index 0 = Back Week.

// ─── Schedule ──────────────────────────────────────────────────────────────
const SCHEDULE = {
	// Week of May 18 (partial) — Cycle 1 · Var A
	'2026-05-23': { type: 'running', variation: 'A' },
	'2026-05-24': { type: 'recovery', variation: 'A' },
	// Week of May 25 — Back Week · Var A
	'2026-05-25': { type: 'rest' },
	'2026-05-26': { type: 'legs-hamstrings', variation: 'A' },
	'2026-05-27': { type: 'back', variation: 'A' },
	'2026-05-28': { type: 'arms-triceps', variation: 'A' },
	'2026-05-29': { type: 'shoulders', variation: 'A' },
	'2026-05-30': { type: 'running', variation: 'A' },
	'2026-05-31': { type: 'recovery', variation: 'A' },
	// Week of Jun 01 — Front Week · Var B
	'2026-06-01': { type: 'rest' },
	'2026-06-02': { type: 'legs-quads', variation: 'B' },
	'2026-06-03': { type: 'chest', variation: 'B' },
	'2026-06-04': { type: 'arms-biceps', variation: 'B' },
	'2026-06-05': { type: 'shoulders', variation: 'B' },
	'2026-06-06': { type: 'running', variation: 'B' },
	'2026-06-07': { type: 'recovery', variation: 'B' },
	// Week of Jun 08 — Back Week · Var B
	'2026-06-08': { type: 'rest' },
	'2026-06-09': { type: 'legs-hamstrings', variation: 'B' },
	'2026-06-10': { type: 'back', variation: 'B' },
	'2026-06-11': { type: 'arms-triceps', variation: 'B' },
	'2026-06-12': { type: 'shoulders', variation: 'B' },
	'2026-06-13': { type: 'running', variation: 'B' },
	'2026-06-14': { type: 'recovery', variation: 'B' },
	// Week of Jun 15 — Front Week · Var A
	'2026-06-15': { type: 'rest' },
	'2026-06-16': { type: 'legs-quads', variation: 'A' },
	'2026-06-17': { type: 'chest', variation: 'A' },
	'2026-06-18': { type: 'arms-biceps', variation: 'A' },
	'2026-06-19': { type: 'shoulders', variation: 'A' },
	'2026-06-20': { type: 'running', variation: 'A' },
	'2026-06-21': { type: 'recovery', variation: 'A' },
	// Week of Jun 22 — Back Week · Var A
	'2026-06-22': { type: 'rest' },
	'2026-06-23': { type: 'legs-hamstrings', variation: 'A' },
	'2026-06-24': { type: 'back', variation: 'A' },
	'2026-06-25': { type: 'arms-triceps', variation: 'A' },
	'2026-06-26': { type: 'shoulders', variation: 'A' },
	'2026-06-27': { type: 'running', variation: 'A' },
	'2026-06-28': { type: 'recovery', variation: 'A' },
	// Week of Jun 29 — Front Week · Var B
	'2026-06-29': { type: 'rest' },
	'2026-06-30': { type: 'legs-quads', variation: 'B' },
	'2026-07-01': { type: 'chest', variation: 'B' },
	'2026-07-02': { type: 'arms-biceps', variation: 'B' },
	'2026-07-03': { type: 'shoulders', variation: 'B' },
	'2026-07-04': { type: 'running', variation: 'B' },
	'2026-07-05': { type: 'recovery', variation: 'B' },
	// Week of Jul 06 — Back Week · Var B
	'2026-07-06': { type: 'rest' },
	'2026-07-07': { type: 'legs-hamstrings', variation: 'B' },
	'2026-07-08': { type: 'back', variation: 'B' },
	'2026-07-09': { type: 'arms-triceps', variation: 'B' },
	'2026-07-10': { type: 'shoulders', variation: 'B' },
	'2026-07-11': { type: 'running', variation: 'B' },
	'2026-07-12': { type: 'recovery', variation: 'B' },
	// Week of Jul 13 — Front Week · Var A
	'2026-07-13': { type: 'rest' },
	'2026-07-14': { type: 'legs-quads', variation: 'A' },
	'2026-07-15': { type: 'chest', variation: 'A' },
	'2026-07-16': { type: 'arms-biceps', variation: 'A' },
	'2026-07-17': { type: 'shoulders', variation: 'A' },
	'2026-07-18': { type: 'running', variation: 'A' },
	'2026-07-19': { type: 'recovery', variation: 'A' },
	// Week of Jul 20 — Back Week · Var A
	'2026-07-20': { type: 'rest' },
	'2026-07-21': { type: 'legs-hamstrings', variation: 'A' },
	'2026-07-22': { type: 'back', variation: 'A' },
	'2026-07-23': { type: 'arms-triceps', variation: 'A' },
	'2026-07-24': { type: 'shoulders', variation: 'A' },
	'2026-07-25': { type: 'running', variation: 'A' },
	'2026-07-26': { type: 'recovery', variation: 'A' },
	// Week of Jul 27 — Front Week · Var B
	'2026-07-27': { type: 'rest' },
	'2026-07-28': { type: 'legs-quads', variation: 'B' },
	'2026-07-29': { type: 'chest', variation: 'B' },
	'2026-07-30': { type: 'arms-biceps', variation: 'B' },
	'2026-07-31': { type: 'shoulders', variation: 'B' },
	'2026-08-01': { type: 'running', variation: 'B' },
	'2026-08-02': { type: 'recovery', variation: 'B' },
	// Week of Aug 03 — Back Week · Var B
	'2026-08-03': { type: 'rest' },
	'2026-08-04': { type: 'legs-hamstrings', variation: 'B' },
	'2026-08-05': { type: 'back', variation: 'B' },
	'2026-08-06': { type: 'arms-triceps', variation: 'B' },
	'2026-08-07': { type: 'shoulders', variation: 'B' },
	'2026-08-08': { type: 'running', variation: 'B' },
	'2026-08-09': { type: 'recovery', variation: 'B' },
	// Week of Aug 10 — Front Week · Var A
	'2026-08-10': { type: 'rest' },
	'2026-08-11': { type: 'legs-quads', variation: 'A' },
	'2026-08-12': { type: 'chest', variation: 'A' },
	'2026-08-13': { type: 'arms-biceps', variation: 'A' },
	'2026-08-14': { type: 'shoulders', variation: 'A' },
	'2026-08-15': { type: 'running', variation: 'A' },
	'2026-08-16': { type: 'recovery', variation: 'A' },
	// Week of Aug 17 — Back Week · Var A
	'2026-08-17': { type: 'rest' },
	'2026-08-18': { type: 'legs-hamstrings', variation: 'A' },
	'2026-08-19': { type: 'back', variation: 'A' },
	'2026-08-20': { type: 'arms-triceps', variation: 'A' },
	'2026-08-21': { type: 'shoulders', variation: 'A' },
	'2026-08-22': { type: 'running', variation: 'A' },
	'2026-08-23': { type: 'recovery', variation: 'A' },
	// Week of Aug 24 — Front Week · Var B
	'2026-08-24': { type: 'rest' },
	'2026-08-25': { type: 'legs-quads', variation: 'B' },
	'2026-08-26': { type: 'chest', variation: 'B' },
	'2026-08-27': { type: 'arms-biceps', variation: 'B' },
	'2026-08-28': { type: 'shoulders', variation: 'B' },
	'2026-08-29': { type: 'running', variation: 'B' },
	'2026-08-30': { type: 'recovery', variation: 'B' },
	// Week of Aug 31 — Back Week · Var B
	'2026-08-31': { type: 'rest' },
	'2026-09-01': { type: 'legs-hamstrings', variation: 'B' },
	'2026-09-02': { type: 'back', variation: 'B' },
	'2026-09-03': { type: 'arms-triceps', variation: 'B' },
	'2026-09-04': { type: 'shoulders', variation: 'B' },
	'2026-09-05': { type: 'running', variation: 'B' },
	'2026-09-06': { type: 'recovery', variation: 'B' },
	// Week of Sep 07 — Front Week · Var A
	'2026-09-07': { type: 'rest' },
	'2026-09-08': { type: 'legs-quads', variation: 'A' },
	'2026-09-09': { type: 'chest', variation: 'A' },
	'2026-09-10': { type: 'arms-biceps', variation: 'A' },
	'2026-09-11': { type: 'shoulders', variation: 'A' },
	'2026-09-12': { type: 'running', variation: 'A' },
	'2026-09-13': { type: 'recovery', variation: 'A' },
	// Week of Sep 14 — Back Week · Var A
	'2026-09-14': { type: 'rest' },
	'2026-09-15': { type: 'legs-hamstrings', variation: 'A' },
	'2026-09-16': { type: 'back', variation: 'A' },
	'2026-09-17': { type: 'arms-triceps', variation: 'A' },
	'2026-09-18': { type: 'shoulders', variation: 'A' },
	'2026-09-19': { type: 'running', variation: 'A' },
	'2026-09-20': { type: 'recovery', variation: 'A' },
	// Week of Sep 21 — Front Week · Var B
	'2026-09-21': { type: 'rest' },
	'2026-09-22': { type: 'legs-quads', variation: 'B' },
	'2026-09-23': { type: 'chest', variation: 'B' },
	'2026-09-24': { type: 'arms-biceps', variation: 'B' },
	'2026-09-25': { type: 'shoulders', variation: 'B' },
	'2026-09-26': { type: 'running', variation: 'B' },
	'2026-09-27': { type: 'recovery', variation: 'B' },
	// Week of Sep 28 — Back Week · Var B
	'2026-09-28': { type: 'rest' },
	'2026-09-29': { type: 'legs-hamstrings', variation: 'B' },
	'2026-09-30': { type: 'back', variation: 'B' },
	'2026-10-01': { type: 'arms-triceps', variation: 'B' },
	'2026-10-02': { type: 'shoulders', variation: 'B' },
	'2026-10-03': { type: 'running', variation: 'B' },
	'2026-10-04': { type: 'recovery', variation: 'B' },
	// Week of Oct 05 — Front Week · Var A
	'2026-10-05': { type: 'rest' },
	'2026-10-06': { type: 'legs-quads', variation: 'A' },
	'2026-10-07': { type: 'chest', variation: 'A' },
	'2026-10-08': { type: 'arms-biceps', variation: 'A' },
	'2026-10-09': { type: 'shoulders', variation: 'A' },
	'2026-10-10': { type: 'running', variation: 'A' },
	'2026-10-11': { type: 'recovery', variation: 'A' },
	// Week of Oct 12 — Back Week · Var A
	'2026-10-12': { type: 'rest' },
	'2026-10-13': { type: 'legs-hamstrings', variation: 'A' },
	'2026-10-14': { type: 'back', variation: 'A' },
	'2026-10-15': { type: 'arms-triceps', variation: 'A' },
	'2026-10-16': { type: 'shoulders', variation: 'A' },
	'2026-10-17': { type: 'running', variation: 'A' },
	'2026-10-18': { type: 'recovery', variation: 'A' },
	// Week of Oct 19 — Front Week · Var B
	'2026-10-19': { type: 'rest' },
	'2026-10-20': { type: 'legs-quads', variation: 'B' },
	'2026-10-21': { type: 'chest', variation: 'B' },
	'2026-10-22': { type: 'arms-biceps', variation: 'B' },
	'2026-10-23': { type: 'shoulders', variation: 'B' },
	'2026-10-24': { type: 'running', variation: 'B' },
	'2026-10-25': { type: 'recovery', variation: 'B' },
	// Week of Oct 26 — Back Week · Var B
	'2026-10-26': { type: 'rest' },
	'2026-10-27': { type: 'legs-hamstrings', variation: 'B' },
	'2026-10-28': { type: 'back', variation: 'B' },
	'2026-10-29': { type: 'arms-triceps', variation: 'B' },
	'2026-10-30': { type: 'shoulders', variation: 'B' },
	'2026-10-31': { type: 'running', variation: 'B' },
	'2026-11-01': { type: 'recovery', variation: 'B' },
	// Week of Nov 02 — Front Week · Var A
	'2026-11-02': { type: 'rest' },
	'2026-11-03': { type: 'legs-quads', variation: 'A' },
	'2026-11-04': { type: 'chest', variation: 'A' },
	'2026-11-05': { type: 'arms-biceps', variation: 'A' },
	'2026-11-06': { type: 'shoulders', variation: 'A' },
	'2026-11-07': { type: 'running', variation: 'A' },
	'2026-11-08': { type: 'recovery', variation: 'A' },
	// Week of Nov 09 — Back Week · Var A
	'2026-11-09': { type: 'rest' },
	'2026-11-10': { type: 'legs-hamstrings', variation: 'A' },
	'2026-11-11': { type: 'back', variation: 'A' },
	'2026-11-12': { type: 'arms-triceps', variation: 'A' },
	'2026-11-13': { type: 'shoulders', variation: 'A' },
	'2026-11-14': { type: 'running', variation: 'A' },
	'2026-11-15': { type: 'recovery', variation: 'A' },
	// Week of Nov 16 — Front Week · Var B
	'2026-11-16': { type: 'rest' },
	'2026-11-17': { type: 'legs-quads', variation: 'B' },
	'2026-11-18': { type: 'chest', variation: 'B' },
	'2026-11-19': { type: 'arms-biceps', variation: 'B' },
	'2026-11-20': { type: 'shoulders', variation: 'B' },
	'2026-11-21': { type: 'running', variation: 'B' },
	'2026-11-22': { type: 'recovery', variation: 'B' },
};

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
// workout.js resolve CORE / PROGRAM_END / CYCLE_ANCHOR at call time, exactly
// like it does in the browser.
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		PROGRAM_START,
		PROGRAM_END,
		PROGRAM_LABEL,
		CYCLE_ANCHOR,
		SCHEDULE,
		CORE,
		WORKOUTS,
		DRILLS,
		RUNNING_DAYS,
	};
	Object.assign(globalThis, module.exports);
}
