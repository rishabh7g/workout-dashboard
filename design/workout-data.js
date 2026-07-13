/*
 * workout-data.js — data + pure logic lifted verbatim from the user's
 * workout-dashboard codebase (js/data.js, js/workout.js), reshaped only to
 * expose sets/reps separately for the big-numeral layout.
 * Exposed as window.WD. No DOM, no storage.
 */
(function () {
	const DEMO_TODAY = '2026-07-13';
	const PROGRAM_START = '2026-05-23';
	const PROGRAM_END = '2026-11-22';
	const PROGRAM_LABEL = 'May 23 – Nov 22, 2026';
	const TOTAL_WEEKS = 26;

	// Two-week slice of SCHEDULE around the demo date (source: data.js)
	const SCHEDULE = {
		'2026-07-13': { type: 'rest' },
		'2026-07-14': { type: 'legs-quads', variation: 'A' },
		'2026-07-15': { type: 'chest', variation: 'A' },
		'2026-07-16': { type: 'arms-biceps', variation: 'A' },
		'2026-07-17': { type: 'shoulders', variation: 'A' },
		'2026-07-18': { type: 'running', variation: 'A' },
		'2026-07-19': { type: 'recovery', variation: 'A' },
		'2026-07-20': { type: 'rest' },
		'2026-07-21': { type: 'legs-hamstrings', variation: 'A' },
		'2026-07-22': { type: 'back', variation: 'A' },
		'2026-07-23': { type: 'arms-triceps', variation: 'A' },
		'2026-07-24': { type: 'shoulders', variation: 'A' },
		'2026-07-25': { type: 'running', variation: 'A' },
		'2026-07-26': { type: 'recovery', variation: 'A' },
	};

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
					{ name: 'Squats', sets: 3, reps: 10, weight: '15kg/side', cap: '60kg total (bar + plates)', warn: 'Beyond this thickens spinal erectors' },
					{ name: 'Hack squat', sets: 3, reps: 12, cap: '80kg total' },
					{ name: 'Leg press', sets: 3, reps: 12, note: 'Feet LOW = quads', cap: '80kg total' },
					{ name: 'Leg extension', sets: 3, reps: 12, weight: '20–25kg', note: 'Slow lowering' },
				],
			},
			B: {
				title: 'Legs — Quads',
				hasStairmaster: true,
				legConditioning: true,
				exercises: [
					{ name: 'Goblet squat', sets: 3, reps: 12 },
					{ name: 'Walking lunges', sets: 3, reps: '10 each leg', note: 'With dumbbells', cap: '10kg per dumbbell', warn: 'Heavy lunges bulk glutes and widen hips' },
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
					{ name: 'Squats', sets: 3, reps: 10, weight: '15kg/side', cap: '60kg total (bar + plates)', warn: 'Beyond this thickens spinal erectors' },
					{ name: 'Romanian deadlift', sets: 3, reps: 10, cap: '20kg/side (40kg total)' },
					{ name: 'Leg press', sets: 3, reps: 12, note: 'Feet HIGH = hamstrings', cap: '100kg total' },
					{ name: 'Lying leg curl', sets: 3, reps: 12, weight: '32–40kg' },
				],
			},
			B: {
				title: 'Legs — Hamstrings',
				hasStairmaster: true,
				legConditioning: true,
				exercises: [
					{ name: 'Romanian deadlift', sets: 3, reps: 10, cap: '20kg/side (40kg total)' },
					{ name: 'Walking lunges', sets: 3, reps: '10 each leg', note: 'With dumbbells', cap: '10kg per dumbbell', warn: 'Heavy lunges bulk glutes and widen hips' },
					{ name: 'Lying leg curl', sets: 3, reps: 12, weight: '32–40kg' },
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
					{ name: 'Incline dumbbell press', sets: 3, reps: 10, weight: '10kg', cap: '14kg', warn: 'Chest size is not your V-shape lever' },
					{ name: 'High cable fly', sets: 3, reps: 12 },
					{ name: 'Mid cable fly', sets: 3, reps: 12 },
					{ name: 'Side lateral raises', sets: 3, reps: 15, weight: '5kg' },
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
					{ name: 'Incline dumbbell fly', sets: 3, reps: 12, cap: '12kg' },
					{ name: 'Side lateral raises', sets: 3, reps: 15, weight: '5kg' },
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
					{ name: 'Pull-ups', sets: 3, reps: '7→10', note: 'No cap — add weight progressively. Primary lat width builder.' },
					{ name: 'Straight-arm pulldown', sets: 3, reps: 12 },
					{ name: 'Reverse pec deck', sets: 3, reps: 12 },
					{ name: 'Seated cable row', sets: 3, reps: 10, weight: '25–30kg', cap: '40kg', warn: 'Beyond this recruits traps for thickness, not lats for width' },
					{ name: 'Side lateral raises', sets: 3, reps: 15, weight: '5kg' },
				],
			},
			B: {
				title: 'Back + Core',
				hasCore: true,
				coreType: 'anti-rotation',
				hasInclineTreadmill: true,
				exercises: [
					{ name: 'Lat pulldown (wide grip)', sets: 3, reps: 10, note: 'No cap — progress freely. Builds lat width.' },
					{ name: 'Single-arm cable row', sets: 3, reps: '10 each side', note: 'Cable at low position, elbow back, squeeze lat at contraction', cap: '40kg' },
					{ name: 'Cable face pull', sets: 3, reps: 15 },
					{ name: 'Wide grip seated cable row', sets: 3, reps: 10, cap: '40kg', warn: 'Beyond this recruits traps for thickness, not lats for width' },
					{ name: 'Side lateral raises', sets: 3, reps: 15, weight: '5kg' },
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
					{ name: 'Reverse cable curl', sets: 3, reps: 12, weight: '10kg' },
					{ name: 'Incline dumbbell curl', sets: 3, reps: 10, weight: '7–8kg' },
				],
			},
			B: {
				title: 'Arms — Biceps',
				hasStairmaster: true,
				armConditioning: true,
				exercises: [
					{ name: 'Hammer curl', sets: 3, reps: 12, weight: '8–10kg' },
					{ name: 'Preacher curl', sets: 3, reps: 12 },
					{ name: 'Concentration curl', sets: 3, reps: 12, weight: '6–8kg' },
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
					{ name: 'Dumbbell overhead tricep extension', sets: 3, reps: 12 },
				],
			},
		},
		shoulders: {
			A: {
				title: 'Shoulders + Core',
				hasCore: true,
				hasInclineTreadmill: true,
				exercises: [
					{ name: 'Side lateral raises ⭐ FIRST', sets: 4, reps: 15, weight: '5kg', note: 'Strict form — do NOT increase weight' },
					{ name: 'Dumbbell shoulder press', sets: 3, reps: 10, weight: '8–10kg', cap: '12kg', warn: 'Heavier shifts load to front delts and traps' },
					{ name: 'Lying cable face pull', sets: 3, reps: 15, note: 'Rope. Lie on floor/bench, head close to stack, pull toward face with elbows flaring wide' },
					{ name: 'Side lateral raises (burnout)', sets: 2, reps: 20, weight: '3–4kg' },
				],
			},
			B: {
				title: 'Shoulders + Core',
				hasCore: true,
				hasInclineTreadmill: true,
				exercises: [
					{ name: 'Side lateral raises ⭐ FIRST', sets: 4, reps: 15, weight: '5kg', note: 'Strict form — do NOT increase weight' },
					{ name: 'Seated dumbbell lateral raise', sets: 3, reps: 12, cap: '6kg', note: 'Strict isolation, zero trap involvement' },
					{ name: 'Unilateral cable lateral raise', sets: 3, reps: '12 each side' },
					{ name: 'Reverse pec deck', sets: 3, reps: 15, note: 'Sit facing machine, chest against pad, squeeze at widest point, slow return' },
					{ name: 'Side lateral raises (burnout)', sets: 2, reps: 20, weight: '3–4kg' },
				],
			},
		},
	};

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
					{ name: 'Ankle circles, both directions', reps: '10 each foot' },
					{ name: 'Leg swings front-to-back', reps: '10 each leg' },
					{ name: 'Leg swings side-to-side', reps: '10 each leg' },
					{ name: 'Walking knee hugs', reps: '10 steps' },
					{ name: 'Walking heel-to-glute pulls', reps: '10 steps' },
					{ name: 'Hip circles (standing)', reps: '10 each direction' },
					{ name: 'Lateral lunges with reach', reps: '8 each side' },
				],
				cooldown: [
					{ name: 'Standing quad stretch', reps: '30 sec each leg' },
					{ name: 'Kneeling hip flexor stretch', reps: '30 sec each side' },
					{ name: 'Seated butterfly / adductor stretch', reps: '30 sec' },
					{ name: 'Figure-4 glute stretch', reps: '30 sec each side' },
					{ name: 'Standing IT band stretch (cross-leg side bend)', reps: '30 sec each side' },
					{ name: 'Calf stretch against wall', reps: '30 sec each leg' },
					{ name: 'Foam roll: quads, IT band, calves', reps: '1 min each' },
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
					{ name: "World's greatest stretch (lunge + rotation)", reps: '5 each side' },
					{ name: 'High knee march with arm drive', reps: '10 steps' },
					{ name: 'Butt kick march', reps: '10 steps' },
					{ name: 'Lateral shuffle (light)', reps: '20 sec each direction' },
					{ name: 'Standing dynamic figure-4', reps: '5 each side' },
					{ name: 'Calf raises with march', reps: '10 reps' },
				],
				cooldown: [
					{ name: 'Lying hamstring stretch (strap/towel)', reps: '30 sec each leg' },
					{ name: 'Pigeon pose', reps: '30 sec each side' },
					{ name: 'Lying figure-4 stretch', reps: '30 sec each side' },
					{ name: 'Standing calf stretch, bent knee (soleus)', reps: '30 sec each leg' },
					{ name: 'Hip flexor stretch with overhead reach', reps: '30 sec each side' },
					{ name: 'Lying spinal twist', reps: '30 sec each side' },
					{ name: 'Foam roll: hamstrings, glutes, lower back', reps: '1 min each' },
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
					{ name: 'Arm circles, forward/backward', reps: '10 each direction' },
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
					{ name: 'Seated forward fold (hamstrings + lower back)', reps: '1 min' },
					{ name: 'Cross-body shoulder stretch', reps: '30 sec each arm' },
					{ name: 'Standing quad stretch', reps: '30 sec each leg' },
					{ name: 'Lying knee-to-chest stretch', reps: '30 sec each leg' },
					{ name: 'Foam roll: full body (calves, quads, hamstrings, lats, upper back)', reps: '1 min each' },
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
					{ name: 'Frankenstein walk (straight leg kicks to opposite hand)', reps: '8 each leg' },
					{ name: 'Deep squat hold with reach (dynamic)', reps: '5 reps' },
					{ name: 'Toe walks + heel walks', reps: '10 steps each' },
				],
				cooldown: [
					{ name: 'Downward dog', reps: '1 min' },
					{ name: 'Lying spinal twist', reps: '30 sec each side' },
					{ name: 'Seated butterfly stretch', reps: '1 min' },
					{ name: 'Standing side bend (static hold)', reps: '30 sec each side' },
					{ name: 'Wrist/forearm stretches', reps: '30 sec each' },
					{ name: 'Thread the needle (thoracic mobility)', reps: '30 sec each side' },
					{ name: 'Foam roll: full body', reps: '1 min each area' },
					{ name: 'Deep breathing / relaxation', reps: '2–3 min' },
				],
			},
		},
	};

	const SECTION_NAMES = {
		warmup: 'Warm-up',
		ex: 'Exercises',
		core: 'Core',
		finisher: 'Finisher',
		ankle: 'Ankle Stability',
		cardio: 'Cardio',
		stretch: 'Stretching · 10 min',
		drills: 'Drills · 30 min',
		run: 'Run',
		cooldown: 'Cooldown',
	};

	// Split reps like '10 each leg' → { reps: '10', sub: 'each leg' }
	function splitReps(reps) {
		const m = /^(\d+)\s+(each .+)$/.exec(String(reps));
		if (m) return { reps: m[1], sub: m[2] };
		return { reps: String(reps), sub: null };
	}

	// Flatten a workout into ordered checklist items (source: workout.js
	// buildItemList), with sets/reps kept separate where they exist.
	function buildItemList(workout) {
		const items = [];
		const counts = {};
		const add = (sec, label, extra = {}) => {
			counts[sec] = (counts[sec] || 0) + 1;
			items.push({ id: sec + '-' + counts[sec], section: sec, label, ...extra });
		};

		if (workout.legConditioning) {
			add('warmup', 'Leg swings', { sub: 'Front-back + side-side · 10 each' });
			add('warmup', 'Ankle circles', { sub: 'Both directions' });
			add('warmup', 'Reverse lunges', { sets: 3, reps: '10', sub: 'each leg' });
		}

		for (const ex of workout.exercises || []) {
			const r = splitReps(ex.reps);
			const subBits = [];
			if (ex.weight) subBits.push(ex.weight);
			if (r.sub) subBits.push(r.sub);
			add('ex', ex.name, {
				sets: ex.sets, reps: r.reps,
				sub: subBits.join(' · ') || null,
				note: ex.note, cap: ex.cap, warn: ex.warn,
			});
		}

		if (workout.hasCore) {
			for (const ex of CORE) add('core', ex.name, { sets: ex.sets, reps: String(ex.reps), note: ex.note });
			if (workout.coreType === 'anti-rotation') {
				add('core', 'Pallof press', { sets: 3, reps: '12', sub: 'each side', note: 'Anti-rotation — stability for cutting' });
			} else if (workout.coreType === 'anti-extension') {
				add('core', 'Dead bug', { sets: 3, reps: '10', sub: 'each side' });
				add('core', 'Forearm side plank', { sets: 3, reps: '25 sec', sub: 'each', note: 'Weight on forearm, not hand' });
			}
		}

		if (workout.legConditioning) {
			add('finisher', 'Wall sit', { sets: 3, reps: '45 sec' });
			add('finisher', 'Single-leg RDL', { sets: 3, reps: '10', sub: 'Bodyweight · each leg', note: 'Especially valuable on quad days' });
		}

		if (workout.armConditioning) {
			add('ankle', 'Single-leg balance hold', { sets: 3, reps: '30 sec', sub: 'each', note: 'Progress: eyes closed' });
			add('ankle', 'Single-leg calf raises', { sets: 3, reps: '15', sub: 'each' });
			add('ankle', 'Lateral band walks', { sets: 3, reps: '15', sub: 'steps each direction' });
		}

		if (workout.hasStairmaster) add('cardio', 'Stairmaster', { sub: '10 min · 30lb vest' });
		if (workout.hasInclineTreadmill) add('cardio', 'Incline treadmill', { sub: '10 min · speed 4 · level 15 · 30lb vest', note: 'Brace core · no holding rails' });

		if (workout.stretching) for (const ex of workout.stretching) add('stretch', ex.name, { sub: ex.reps, note: ex.note });

		if (workout.hasRun) {
			if (workout.drills) for (const d of workout.drills) add('drills', d.name, { sub: d.reps, note: d.note });
			add('run', 'Run — lanes 9→4', { sub: '6 lanes descending', note: '🍌 Banana before · duration = time taken' });
		}

		if (workout.cooldown) for (const ex of workout.cooldown) add('cooldown', ex.name, { sub: ex.reps, note: ex.note });

		return items;
	}

	// ── date helpers (source: workout.js) ──
	function shortDayLabel(key) {
		const [y, m, d] = key.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
	}
	function headerDate(key) {
		const [y, m, d] = key.split('-').map(Number);
		return new Date(y, m - 1, d)
			.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
			.toUpperCase();
	}
	function dowIndex(key) {
		// 0 = Monday … 6 = Sunday
		const [y, m, d] = key.split('-').map(Number);
		const dow = new Date(y, m - 1, d).getDay();
		return dow === 0 ? 6 : dow - 1;
	}
	function weekNum(key) {
		const [y, m, d] = key.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const mon = new Date(y, m - 1, d - dowIndex(key)); // Monday of this week
		const anchor = new Date(2026, 4, 25); // Mon May 25 = week 1
		return Math.round((mon - anchor) / 604800000) + 1;
	}
	function getWeekType(type, key) {
		if (type === 'running') return 'Sat · 9→4';
		if (type === 'recovery') return 'Sun · 9→4';
		if (['chest', 'legs-quads', 'arms-biceps'].includes(type)) return 'Front Week';
		if (['back', 'legs-hamstrings', 'arms-triceps'].includes(type)) return 'Back Week';
		if (type === 'shoulders' && key) {
			const wn = weekNum(key);
			return wn % 2 === 1 ? 'Back Week' : 'Front Week'; // week 1 (May 25) = Back Week
		}
		return '';
	}
	function entryLabel(entry) {
		if (!entry) return 'Outside schedule';
		if (entry.type === 'rest') return 'Rest Day';
		if (entry.type === 'running') return 'Running · Sat · Var ' + (entry.variation || '?');
		if (entry.type === 'recovery') return 'Running · Sun · Var ' + (entry.variation || '?');
		const w = WORKOUTS[entry.type] && WORKOUTS[entry.type][entry.variation];
		return w ? w.title + ' · Var ' + entry.variation : entry.type;
	}
	function kicker(entry, key) {
		const wk = 'Week ' + weekNum(key) + ' / ' + TOTAL_WEEKS;
		if (!entry) return wk;
		if (entry.type === 'rest') return wk + ' · Rest Day';
		return wk + ' · ' + getWeekType(entry.type, key) + ' · Var ' + entry.variation;
	}
	function getWorkout(entry) {
		if (!entry || entry.type === 'rest') return null;
		const src = WORKOUTS[entry.type] || RUNNING_DAYS[entry.type];
		return src ? src[entry.variation] : null;
	}
	function stateKey(dayKey, entry) {
		return entry ? dayKey + '-' + entry.type + '-' + (entry.variation || 'x') : dayKey;
	}
	function nextDays(fromKey, n) {
		const out = [];
		const [y, m, d] = fromKey.split('-').map(Number);
		for (let i = 1; i <= n; i++) {
			const dt = new Date(y, m - 1, d + i);
			const k = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
			if (SCHEDULE[k]) out.push({ key: k, day: shortDayLabel(k), label: entryLabel(SCHEDULE[k]) });
		}
		return out;
	}

	window.WD = {
		DEMO_TODAY, PROGRAM_START, PROGRAM_END, PROGRAM_LABEL, TOTAL_WEEKS,
		SCHEDULE, WORKOUTS, RUNNING_DAYS, CORE, DRILLS, SECTION_NAMES,
		buildItemList, splitReps, shortDayLabel, headerDate, dowIndex, weekNum,
		getWeekType, entryLabel, kicker, getWorkout, stateKey, nextDays,
	};
})();
