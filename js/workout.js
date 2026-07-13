/*
 * workout.js — Pure domain logic. No DOM, no localStorage.
 *
 * The key idea: a workout object (from data.js) is *declarative* — it just
 * says "I have core" or "I have a stairmaster". buildItemList() turns that
 * declaration into a flat, ordered list of checklist items the UI can render.
 *
 * Keeping this DOM-free means you could unit-test it, or reuse it on a server,
 * without a browser. That separation is the whole point of the refactor.
 */

// Human-readable headings for each section key used in buildItemList().
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

// Split a reps value into the numeral part for the scheme block and any
// leftover qualifier text: 12 → {x:'12'}, '7→10' → {x:'7→10'},
// '10 each leg' → {x:'10', rest:'each leg'}, '25 sec each' → {x:'25 sec',
// rest:'each'}. Any value with a LEADING number always splits — including
// '1 length' → {x:'1', rest:'length'}. Only reps that don't begin with a
// digit-run the regex accepts ('max', 'one pass each foot', '30m → 20m → 10m'
// where 'm' blocks the match) return x:null — no scheme.
function splitReps(reps) {
	const m = String(reps).match(/^(\d+(?:\s*[–—→-]\s*\d+)?(?:\s*sec)?)(?:\s+(.*))?$/);
	if (!m) return { x: null, rest: String(reps) };
	return { x: m[1], rest: m[2] || '' };
}

// Flatten a declarative workout object into an ordered list of items.
// Each item gets a stable id like "ex-3" so the UI and localStorage agree.
// Items with a natural sets×reps shape carry a structured `scheme`
// ({n, x} or {n, unit} for timed cardio) that the UI renders as a
// right-aligned numeral block; scheme-less items keep their `meta` text.
function buildItemList(workout) {
	const items = [];
	const counts = {};
	const add = (sec, label, meta, extra = {}) => {
		counts[sec] = (counts[sec] || 0) + 1;
		items.push({
			id: `${sec}-${counts[sec]}`,
			section: sec,
			label,
			meta,
			...extra,
		});
	};
	// Build a sets×reps item: numerals go to the scheme, any reps qualifier
	// ('each leg') joins the weight in the meta line.
	const addSetsReps = (sec, name, sets, reps, weight, extra = {}) => {
		const { x, rest } = splitReps(reps);
		const meta = [rest, weight].filter(Boolean).join(' · ');
		add(sec, name, x ? meta : `${sets}×${reps}${weight ? ' · ' + weight : ''}`, {
			...extra,
			scheme: x ? { n: sets, x } : null,
		});
	};

	if (workout.legConditioning) {
		add('warmup', 'Leg swings', 'Front-back + side-side · 10 each');
		add('warmup', 'Ankle circles', 'Both directions');
		addSetsReps('warmup', 'Reverse lunges', 3, '10 each leg');
	}

	for (const ex of workout.exercises || []) {
		addSetsReps('ex', ex.name, ex.sets, ex.reps, ex.weight, {
			note: ex.note,
			cap: ex.cap,
			warn: ex.warn,
		});
	}

	if (workout.hasCore) {
		for (const ex of CORE) {
			addSetsReps('core', ex.name, ex.sets, ex.reps, null, { note: ex.note });
		}
		if (workout.coreType === 'anti-rotation')
			addSetsReps('core', 'Pallof press', 3, '12 each side', null, {
				note: 'Anti-rotation — stability for cutting',
			});
	}

	if (workout.legConditioning) {
		addSetsReps('finisher', 'Wall sit', 3, '45 sec');
		addSetsReps('finisher', 'Single-leg RDL', 3, '10 each leg', 'Bodyweight', {
			note: 'Especially valuable on quad days',
		});
	}

	// 'armConditioning' = the arm-day conditioning slot — it emits the Ankle Stability block (running prehab), not arm work.
	if (workout.armConditioning) {
		addSetsReps('ankle', 'Single-leg balance hold', 3, '30 sec each', null, {
			note: 'Progress: eyes closed',
		});
		addSetsReps('ankle', 'Single-leg calf raises', 3, '15 each');
		addSetsReps('ankle', 'Lateral band walks', 3, '15 steps each direction');
	}

	if (workout.hasStairmaster) {
		add('cardio', 'Stairmaster', '', {
			note: '30lb vest',
			scheme: { n: 10, unit: 'min' },
		});
	}

	if (workout.hasInclineTreadmill) {
		add('cardio', 'Incline treadmill', 'speed 4 · level 15 · 30lb vest', {
			note: 'Brace core · no holding rails',
			scheme: { n: 10, unit: 'min' },
		});
	}

	if (workout.stretching) {
		for (const ex of workout.stretching) {
			add('stretch', ex.name, ex.reps, { note: ex.note });
		}
	}

	if (workout.hasRun) {
		if (workout.drills) {
			for (const d of workout.drills) {
				add('drills', d.name, d.reps, { note: d.note });
			}
		} else {
			add('drills', 'Drills session', '30 min', {
				note: 'Content TBD — your picks',
			});
		}
		add('run', 'Run — lanes 9→4', '6 lanes descending', {
			note: '🍌 Banana before · duration = time taken',
		});
	}

	if (workout.cooldown) {
		for (const ex of workout.cooldown) {
			add('cooldown', ex.name, ex.reps, { note: ex.note });
		}
	}

	return items;
}

// ─── Date helpers ────────────────────────────────────────────────────────────
// "Today" as a YYYY-MM-DD key — the same format SCHEDULE is keyed by.
function todayKey() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function shortDayLabel(key) {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	});
}

// A heads-up as the program winds down, so the end isn't a surprise the day
// the schedule simply runs out. Returns a short message for the final week, or
// null on any other day. Dates are ISO YYYY-MM-DD, so string ops are safe.
function programNotice(key) {
	if (key > PROGRAM_END) return null; // past the end — the "no workout" screen covers it
	const [ey, em, ed] = PROGRAM_END.split('-').map(Number);
	const [ky, km, kd] = key.split('-').map(Number);
	const daysLeft = Math.round(
		(new Date(ey, em - 1, ed) - new Date(ky, km - 1, kd)) / 86400000,
	);
	if (daysLeft < 0 || daysLeft > 6) return null;
	if (daysLeft === 0) return '🎉 Final day of the program — great work.';
	return `Program ends ${shortDayLabel(PROGRAM_END)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

// Program length in weeks, shown as "Week n / 26" in the header eyebrow.
const TOTAL_WEEKS = 26;

// Program-position week number for a date key. Week 1 starts Monday
// 2026-05-25 (CYCLE_ANCHOR); the opening weekend (May 23–24) is week 0.
function weekNumber(key) {
	const [y, m, d] = key.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	const dow = date.getDay();
	const toMon = dow === 0 ? -6 : 1 - dow;
	const monday = new Date(y, m - 1, d + toMon);
	const days = Math.round((monday - CYCLE_ANCHOR) / 86400000);
	return Math.floor(days / 7) + 1;
}

// Front Week / Back Week label. Shoulders alternate weekly, so they're
// computed from a known anchor date rather than hard-coded per type.
function getWeekType(type, key) {
	if (type === 'running') return 'Sat · 9→4';
	if (type === 'recovery') return 'Sun · 9→4';
	if (['chest', 'legs-quads', 'arms-biceps'].includes(type))
		return 'Front Week';
	if (['back', 'legs-hamstrings', 'arms-triceps'].includes(type))
		return 'Back Week';
	if (type === 'shoulders' && key) {
		const [y, m, d] = key.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const dow = date.getDay();
		const toMon = dow === 0 ? -6 : 1 - dow;
		const weekMon = new Date(y, m - 1, d + toMon);
		const anchor = CYCLE_ANCHOR;
		const weekNum = Math.round((weekMon - anchor) / 604800000);
		return weekNum % 2 === 0 ? 'Back Week' : 'Front Week';
	}
	return '';
}
