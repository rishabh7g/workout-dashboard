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

// ─── Program constants ──────────────────────────────────────────────────────
const PROGRAM_START  = '2026-05-23';
const PROGRAM_END    = '2026-11-22';
const PROGRAM_LABEL  = 'May 23 – Nov 22, 2026';
const CYCLE_ANCHOR   = new Date(2026, 4, 25); // Mon May 25 = Back Week, week 0

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
const CORE = [
	{ name: 'Hanging leg raise', sets: 3, reps: 10 },
	{ name: 'Hanging knee raise', sets: 3, reps: 12 },
	{
		name: 'Kneeling cable crunch',
		sets: 3,
		reps: 15,
		note: 'Rope behind head, hands facing down — crunch by contracting abs, not pulling with arms',
	},
];

const WORKOUTS = {
	'legs-quads': {
		A: {
			title: 'Legs — Quads',
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: 'Squats',
					sets: 3,
					reps: 10,
					weight: '15kg/side',
					cap: '60kg total (bar + plates)',
					warn: 'Beyond this thickens spinal erectors',
				},
				{ name: 'Hack squat', sets: 3, reps: 12, cap: '80kg total' },
				{
					name: 'Leg press',
					sets: 3,
					reps: 12,
					note: 'Feet LOW = quads',
					cap: '80kg total',
				},
				{
					name: 'Leg extension',
					sets: 3,
					reps: 12,
					weight: '20–25kg',
					note: 'Slow lowering',
				},
			],
		},
		B: {
			title: 'Legs — Quads',
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{ name: 'Goblet squat', sets: 3, reps: 12 },
				{
					name: 'Walking lunges',
					sets: 3,
					reps: '10 each leg',
					note: 'With dumbbells',
					cap: '10kg per dumbbell',
					warn: 'Heavy lunges bulk glutes and widen hips',
				},
				{ name: 'Hack squat', sets: 3, reps: 12, cap: '80kg total' },
			],
		},
	},
	'legs-hamstrings': {
		A: {
			title: 'Legs — Hamstrings',
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: 'Squats',
					sets: 3,
					reps: 10,
					weight: '15kg/side',
					cap: '60kg total (bar + plates)',
					warn: 'Beyond this thickens spinal erectors',
				},
				{
					name: 'Romanian deadlift',
					sets: 3,
					reps: 10,
					cap: '20kg/side (40kg total)',
				},
				{
					name: 'Leg press',
					sets: 3,
					reps: 12,
					note: 'Feet HIGH = hamstrings',
					cap: '100kg total',
				},
				{
					name: 'Lying leg curl',
					sets: 3,
					reps: 12,
					weight: '32–40kg',
				},
			],
		},
		B: {
			title: 'Legs — Hamstrings',
			hasStairmaster: true,
			legConditioning: true,
			exercises: [
				{
					name: 'Romanian deadlift',
					sets: 3,
					reps: 10,
					cap: '20kg/side (40kg total)',
				},
				{
					name: 'Walking lunges',
					sets: 3,
					reps: '10 each leg',
					note: 'With dumbbells',
					cap: '10kg per dumbbell',
					warn: 'Heavy lunges bulk glutes and widen hips',
				},
				{
					name: 'Lying leg curl',
					sets: 3,
					reps: 12,
					weight: '32–40kg',
				},
			],
		},
	},
	chest: {
		A: {
			title: 'Chest + Core',
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{ name: 'Push-ups', sets: 3, reps: 12 },
				{
					name: 'Incline dumbbell press',
					sets: 3,
					reps: 10,
					weight: '10kg',
					cap: '14kg',
					warn: 'Chest size is not your V-shape lever',
				},
				{ name: 'High cable fly', sets: 3, reps: 12 },
				{ name: 'Mid cable fly', sets: 3, reps: 12 },
				{
					name: 'Side lateral raises',
					sets: 3,
					reps: 15,
					weight: '5kg',
				},
			],
		},
		B: {
			title: 'Chest + Core',
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{ name: 'Push-ups', sets: 3, reps: 15 },
				{ name: 'Flat dumbbell press', sets: 3, reps: 10, cap: '14kg' },
				{ name: 'Incline cable fly', sets: 3, reps: 12 },
				{
					name: 'Incline dumbbell fly',
					sets: 3,
					reps: 12,
					cap: '12kg',
				},
				{
					name: 'Side lateral raises',
					sets: 3,
					reps: 15,
					weight: '5kg',
				},
			],
		},
	},
	back: {
		A: {
			title: 'Back + Core',
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: 'Pull-ups',
					sets: 3,
					reps: '7→10',
					note: 'No cap — add weight progressively. Primary lat width builder.',
				},
				{ name: 'Straight-arm pulldown', sets: 3, reps: 12 },
				{ name: 'Reverse pec deck', sets: 3, reps: 12 },
				{
					name: 'Seated cable row',
					sets: 3,
					reps: 10,
					weight: '25–30kg',
					cap: '40kg',
					warn: 'Beyond this recruits traps for thickness, not lats for width',
				},
				{
					name: 'Side lateral raises',
					sets: 3,
					reps: 15,
					weight: '5kg',
				},
			],
		},
		B: {
			title: 'Back + Core',
			hasCore: true,
			coreType: 'anti-rotation',
			hasInclineTreadmill: true,
			exercises: [
				{
					name: 'Lat pulldown (wide grip)',
					sets: 3,
					reps: 10,
					note: 'No cap — progress freely. Builds lat width.',
				},
				{
					name: 'Single-arm cable row',
					sets: 3,
					reps: '10 each side',
					note: 'Cable at low position, elbow back, squeeze lat at contraction',
					cap: '40kg',
				},
				{ name: 'Cable face pull', sets: 3, reps: 15 },
				{
					name: 'Wide grip seated cable row',
					sets: 3,
					reps: 10,
					cap: '40kg',
					warn: 'Beyond this recruits traps for thickness, not lats for width',
				},
				{
					name: 'Side lateral raises',
					sets: 3,
					reps: 15,
					weight: '5kg',
				},
			],
		},
	},
	'arms-biceps': {
		A: {
			title: 'Arms — Biceps',
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{ name: 'Pull-ups', sets: 3, reps: 'max' },
				{ name: 'Cable curl', sets: 3, reps: 12, weight: '15kg' },
				{
					name: 'Reverse cable curl',
					sets: 3,
					reps: 12,
					weight: '10kg',
				},
				{
					name: 'Incline dumbbell curl',
					sets: 3,
					reps: 10,
					weight: '7–8kg',
				},
			],
		},
		B: {
			title: 'Arms — Biceps',
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{ name: 'Hammer curl', sets: 3, reps: 12, weight: '8–10kg' },
				{ name: 'Preacher curl', sets: 3, reps: 12 },
				{
					name: 'Concentration curl',
					sets: 3,
					reps: 12,
					weight: '6–8kg',
				},
				{ name: 'Cable curl (rope attachment)', sets: 3, reps: 12 },
			],
		},
	},
	'arms-triceps': {
		A: {
			title: 'Arms — Triceps',
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{ name: 'Cable pushdown', sets: 3, reps: 12 },
				{ name: 'Single-hand pushdown', sets: 3, reps: 12 },
				{ name: 'Overhead cable extension', sets: 3, reps: 12 },
			],
		},
		B: {
			title: 'Arms — Triceps',
			hasStairmaster: true,
			armConditioning: true,
			exercises: [
				{ name: 'Skull crushers (EZ bar)', sets: 3, reps: 12 },
				{ name: 'Close grip push-ups', sets: 3, reps: 15 },
				{
					name: 'Dumbbell overhead tricep extension',
					sets: 3,
					reps: 12,
				},
			],
		},
	},
	shoulders: {
		A: {
			title: 'Shoulders + Core',
			hasCore: true,
			hasInclineTreadmill: true,
			exercises: [
				{
					name: 'Side lateral raises ⭐ FIRST',
					sets: 4,
					reps: 15,
					weight: '5kg',
					note: 'Strict form — do NOT increase weight',
				},
				{
					name: 'Dumbbell shoulder press',
					sets: 3,
					reps: 10,
					weight: '8–10kg',
					cap: '12kg',
					warn: 'Heavier shifts load to front delts and traps',
				},
				{
					name: 'Lying cable face pull',
					sets: 3,
					reps: 15,
					note: 'Rope. Lie on floor/bench, head close to stack, pull toward face with elbows flaring wide',
				},
				{
					name: 'Side lateral raises (burnout)',
					sets: 2,
					reps: 20,
					weight: '3–4kg',
				},
			],
		},
		B: {
			title: 'Shoulders + Core',
			hasCore: true,
			hasInclineTreadmill: true,
			exercises: [
				{
					name: 'Side lateral raises ⭐ FIRST',
					sets: 4,
					reps: 15,
					weight: '5kg',
					note: 'Strict form — do NOT increase weight',
				},
				{
					name: 'Seated dumbbell lateral raise',
					sets: 3,
					reps: 12,
					cap: '6kg',
					note: 'Strict isolation, zero trap involvement',
				},
				{
					name: 'Unilateral cable lateral raise',
					sets: 3,
					reps: '12 each side',
				},
				{
					name: 'Reverse pec deck',
					sets: 3,
					reps: 15,
					note: 'Sit facing machine, chest against pad, squeeze at widest point, slow return',
				},
				{
					name: 'Side lateral raises (burnout)',
					sets: 2,
					reps: 20,
					weight: '3–4kg',
				},
			],
		},
	},
};

// Shared drill list — referenced by every running-day variation below.
const DRILLS = [
	{ name: 'High knees', reps: '1 length' },
	{ name: 'Walk → back kicks (cone to cone)', reps: '1 length' },
	{ name: 'Sideways walk left + right → back', reps: '1 length' },
	{ name: 'Backward walk + Frankenstein leg swing', reps: '1 length' },
	{ name: 'Hip circles (light jog outside)', reps: '1 length' },
	{ name: 'Side ankle touch outside', reps: '1 length' },
	{ name: 'Side frog jumps', reps: '1 length' },
	{ name: 'Suicide runs', reps: '30m → 20m → 10m', note: '3 rounds' },
	{ name: 'Sideways shuffles', reps: '1 length' },
];

const RUNNING_DAYS = {
	running: {
		A: {
			title: 'Running Day — Saturday',
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{ name: 'Light jog / shuttle jog', reps: '1 min' },
				{
					name: 'Ankle circles, both directions',
					reps: '10 each foot',
				},
				{ name: 'Leg swings front-to-back', reps: '10 each leg' },
				{ name: 'Leg swings side-to-side', reps: '10 each leg' },
				{ name: 'Walking knee hugs', reps: '10 steps' },
				{ name: 'Walking heel-to-glute pulls', reps: '10 steps' },
				{ name: 'Hip circles (standing)', reps: '10 each direction' },
				{ name: 'Lateral lunges with reach', reps: '8 each side' },
			],
			cooldown: [
				{ name: 'Standing quad stretch', reps: '30 sec each leg' },
				{
					name: 'Kneeling hip flexor stretch',
					reps: '30 sec each side',
				},
				{ name: 'Seated butterfly / adductor stretch', reps: '30 sec' },
				{ name: 'Figure-4 glute stretch', reps: '30 sec each side' },
				{
					name: 'Standing IT band stretch (cross-leg side bend)',
					reps: '30 sec each side',
				},
				{ name: 'Calf stretch against wall', reps: '30 sec each leg' },
				{
					name: 'Foam roll: quads, IT band, calves',
					reps: '1 min each',
				},
				{ name: 'Deep breathing', reps: '1–2 min' },
			],
		},
		B: {
			title: 'Running Day — Saturday',
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{ name: 'Light jog', reps: '1 min' },
				{ name: 'Inchworm walkouts', reps: '5 reps' },
				{
					name: "World's greatest stretch (lunge + rotation)",
					reps: '5 each side',
				},
				{ name: 'High knee march with arm drive', reps: '10 steps' },
				{ name: 'Butt kick march', reps: '10 steps' },
				{
					name: 'Lateral shuffle (light)',
					reps: '20 sec each direction',
				},
				{ name: 'Standing dynamic figure-4', reps: '5 each side' },
				{ name: 'Calf raises with march', reps: '10 reps' },
			],
			cooldown: [
				{
					name: 'Lying hamstring stretch (strap/towel)',
					reps: '30 sec each leg',
				},
				{ name: 'Pigeon pose', reps: '30 sec each side' },
				{ name: 'Lying figure-4 stretch', reps: '30 sec each side' },
				{
					name: 'Standing calf stretch, bent knee (soleus)',
					reps: '30 sec each leg',
				},
				{
					name: 'Hip flexor stretch with overhead reach',
					reps: '30 sec each side',
				},
				{ name: 'Lying spinal twist', reps: '30 sec each side' },
				{
					name: 'Foam roll: hamstrings, glutes, lower back',
					reps: '1 min each',
				},
				{ name: 'Deep breathing', reps: '1–2 min' },
			],
		},
	},
	recovery: {
		A: {
			title: 'Running Day — Sunday',
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{ name: 'Brisk walk / light jog', reps: '1–2 min' },
				{
					name: 'Arm circles, forward/backward',
					reps: '10 each direction',
				},
				{ name: 'Standing torso twists', reps: '10 each side' },
				{ name: 'Leg swings front-to-back', reps: '10 each leg' },
				{ name: 'Standing cat-cow', reps: '8 reps' },
				{ name: 'Standing hamstring scoop/reach', reps: '8 each leg' },
				{ name: 'Ankle alphabet', reps: 'one pass each foot' },
				{ name: 'Walking lunges (no rotation)', reps: '6 each leg' },
			],
			cooldown: [
				{ name: 'Cat-cow stretch', reps: '8 reps' },
				{ name: "Child's pose", reps: '1 min' },
				{
					name: 'Seated forward fold (hamstrings + lower back)',
					reps: '1 min',
				},
				{
					name: 'Cross-body shoulder stretch',
					reps: '30 sec each arm',
				},
				{ name: 'Standing quad stretch', reps: '30 sec each leg' },
				{
					name: 'Lying knee-to-chest stretch',
					reps: '30 sec each leg',
				},
				{
					name: 'Foam roll: full body (calves, quads, hamstrings, lats, upper back)',
					reps: '1 min each',
				},
				{ name: 'Deep breathing / relaxation', reps: '2–3 min' },
			],
		},
		B: {
			title: 'Running Day — Sunday',
			hasRun: true,
			drills: DRILLS,
			stretching: [
				{ name: 'Brisk walk / light jog', reps: '1–2 min' },
				{ name: 'Shoulder rolls + arm swings', reps: '10 reps' },
				{ name: 'Standing dynamic side bend', reps: '8 each side' },
				{ name: 'Hip circles', reps: '10 each direction' },
				{ name: 'Leg swings side-to-side', reps: '10 each leg' },
				{
					name: 'Frankenstein walk (straight leg kicks to opposite hand)',
					reps: '8 each leg',
				},
				{
					name: 'Deep squat hold with reach (dynamic)',
					reps: '5 reps',
				},
				{ name: 'Toe walks + heel walks', reps: '10 steps each' },
			],
			cooldown: [
				{ name: 'Downward dog', reps: '1 min' },
				{ name: 'Lying spinal twist', reps: '30 sec each side' },
				{ name: 'Seated butterfly stretch', reps: '1 min' },
				{
					name: 'Standing side bend (static hold)',
					reps: '30 sec each side',
				},
				{ name: 'Wrist/forearm stretches', reps: '30 sec each' },
				{
					name: 'Thread the needle (thoracic mobility)',
					reps: '30 sec each side',
				},
				{ name: 'Foam roll: full body', reps: '1 min each area' },
				{ name: 'Deep breathing / relaxation', reps: '2–3 min' },
			],
		},
	},
};
