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

// Flatten a declarative workout object into an ordered list of items.
// Each item gets a stable id like "ex-3" so the UI and localStorage agree.
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

	if (workout.legConditioning) {
		add('warmup', 'Leg swings', 'Front-back + side-side · 10 each');
		add('warmup', 'Ankle circles', 'Both directions');
		add('warmup', 'Reverse lunges', '3×10 each leg');
	}

	for (const ex of workout.exercises || []) {
		add(
			'ex',
			ex.name,
			`${ex.sets}×${ex.reps}${ex.weight ? ' · ' + ex.weight : ''}`,
			{ note: ex.note, cap: ex.cap, warn: ex.warn },
		);
	}

	if (workout.hasCore) {
		for (const ex of CORE) {
			add('core', ex.name, `${ex.sets}×${ex.reps}`, { note: ex.note });
		}
		if (workout.coreType === 'anti-rotation')
			add('core', 'Pallof press', '3×12 each side', {
				note: 'Anti-rotation — stability for cutting',
			});
		else if (workout.coreType === 'anti-extension') {
			add('core', 'Dead bug', '3×10 each side');
			add('core', 'Forearm side plank', '3×25 sec each', {
				note: 'Weight on forearm, not hand',
			});
		}
	}

	if (workout.legConditioning) {
		add('finisher', 'Wall sit', '3×45 sec');
		add('finisher', 'Single-leg RDL', 'Bodyweight · 3×10 each leg', {
			note: 'Especially valuable on quad days',
		});
	}

	if (workout.armConditioning) {
		add('ankle', 'Single-leg balance hold', '3×30 sec each', {
			note: 'Progress: eyes closed',
		});
		add('ankle', 'Single-leg calf raises', '3×15 each');
		add('ankle', 'Lateral band walks', '3×15 steps each direction');
	}

	if (workout.hasStairmaster) {
		add('cardio', 'Stairmaster', '10 min · 30lb vest');
	}

	if (workout.hasInclineTreadmill) {
		add('cardio', 'Incline treadmill', '10 min · speed 4 · level 15 · 30lb vest', {
			note: 'Brace core · no holding rails',
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

function formatDate(key) {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
}

function shortDayLabel(key) {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	});
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
