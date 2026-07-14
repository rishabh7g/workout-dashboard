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

// Split a reps value into a bare numeral and any trailing "each …" qualifier so
// the Modernist row can render sets and reps as SEPARATE fields (WD blueprint,
// design/workout-data.js:352-356): '10 each leg' → {reps:'10', sub:'each leg'},
// '12 each side' → {reps:'12', sub:'each side'}. Anything else passes through
// whole as the reps field ('7→10', '12', 'max') with sub:null — so ranges and
// 'max' still land in the numeral block. Fixed-qualifier conditioning items
// (e.g. '15 steps each direction', '30 sec each') carry their split reps/sub
// literally at the call site, matching the blueprint.
function splitReps(reps) {
	const m = /^(\d+)\s+(each .+)$/.exec(String(reps));
	if (m) return { reps: m[1], sub: m[2] };
	return { reps: String(reps), sub: null };
}

// Flatten a declarative workout object into an ordered list of items.
// Each item gets a stable id like "ex-3" so the UI and localStorage agree —
// the id scheme (`${sec}-${counts[sec]}`) and item ORDER are load-bearing:
// they are the localStorage tick keys (js/storage.js v1 envelope), so a
// reorder would silently re-bind saved ticks to different exercises.
// Items expose `sets` and `reps` SEPARATELY (WD blueprint) so the UI can build
// the numeral block from them; `sub` carries weight + qualifier joined with
// ' · '; scheme-less items (stretches, drills, timed cardio) use `sub` alone.
function buildItemList(workout) {
	const items = [];
	const counts = {};
	const add = (sec, label, extra = {}) => {
		counts[sec] = (counts[sec] || 0) + 1;
		items.push({
			id: `${sec}-${counts[sec]}`,
			section: sec,
			label,
			...extra,
		});
	};

	if (workout.legConditioning) {
		add('warmup', 'Leg swings', { sub: 'Front-back + side-side · 10 each' });
		add('warmup', 'Ankle circles', { sub: 'Both directions' });
		add('warmup', 'Reverse lunges', { sets: 3, reps: '10', sub: 'each leg' });
	}

	for (const ex of workout.exercises || []) {
		const r = splitReps(ex.reps);
		const sub = [ex.weight, r.sub].filter(Boolean).join(' · ') || null;
		add('ex', ex.name, {
			sets: ex.sets,
			reps: r.reps,
			sub,
			note: ex.note,
			cap: ex.cap,
			warn: ex.warn,
		});
	}

	if (workout.hasCore) {
		for (const ex of CORE) {
			add('core', ex.name, { sets: ex.sets, reps: String(ex.reps), note: ex.note });
		}
		if (workout.coreType === 'anti-rotation')
			add('core', 'Pallof press', {
				sets: 3,
				reps: '12',
				sub: 'each side',
				note: 'Anti-rotation — stability for cutting',
			});
	}

	if (workout.legConditioning) {
		add('finisher', 'Wall sit', { sets: 3, reps: '45 sec' });
		add('finisher', 'Single-leg RDL', {
			sets: 3,
			reps: '10',
			sub: 'Bodyweight · each leg',
			note: 'Especially valuable on quad days',
		});
	}

	// 'armConditioning' = the arm-day conditioning slot — it emits the Ankle Stability block (running prehab), not arm work.
	if (workout.armConditioning) {
		add('ankle', 'Single-leg balance hold', {
			sets: 3,
			reps: '30 sec',
			sub: 'each',
			note: 'Progress: eyes closed',
		});
		add('ankle', 'Single-leg calf raises', { sets: 3, reps: '15', sub: 'each' });
		add('ankle', 'Lateral band walks', {
			sets: 3,
			reps: '15',
			sub: 'steps each direction',
		});
	}

	// Timed cardio shows its duration in the sub line (no numeral block) — the
	// blueprint's chosen shape (design/workout-data.js:407-408).
	if (workout.hasStairmaster) {
		add('cardio', 'Stairmaster', { sub: '10 min · 30lb vest' });
	}

	if (workout.hasInclineTreadmill) {
		add('cardio', 'Incline treadmill', {
			sub: '10 min · speed 4 · level 15 · 30lb vest',
			note: 'Brace core · no holding rails',
		});
	}

	if (workout.stretching) {
		for (const ex of workout.stretching) {
			add('stretch', ex.name, { sub: ex.reps, note: ex.note });
		}
	}

	if (workout.hasRun) {
		if (workout.drills) {
			for (const d of workout.drills) {
				add('drills', d.name, { sub: d.reps, note: d.note });
			}
		} else {
			add('drills', 'Drills session', {
				sub: '30 min',
				note: 'Content TBD — your picks',
			});
		}
		add('run', 'Run — lanes 9→4', {
			sub: '6 lanes descending',
			note: 'Banana before · duration = time taken',
		});
	}

	if (workout.cooldown) {
		for (const ex of workout.cooldown) {
			add('cooldown', ex.name, { sub: ex.reps, note: ex.note });
		}
	}

	return items;
}

// ─── Progression hints (#88) ─────────────────────────────────────────────────
// The program's own rule, made literal: "add 2.5kg when the top reps feel easy",
// with the program's own caps and its non-negotiable strict-form exceptions.
// Pure and DOM-free — it reads only the name-keyed exlog store (#86, via the
// global lastExlogEntry) and the per-exercise guardrails baked into data.js.

// The TOP of a planned reps value, as the rep target to beat before adding
// weight: '7→10' → 10, '12' → 12, '12 each side' → 12; 'max' / non-numeric → null
// (no fixed target, so no automatic suggestion). Reuses the same digit-run scan
// splitReps/parseLeadNum lean on — the largest number in the range is the top.
function topRep(planned) {
	const nums = String(planned).match(/\d+/g);
	if (!nums) return null;
	return Math.max(...nums.map(Number));
}

// Per-movement guardrails, merged across every occurrence of a movement in the
// schedule. exlog is keyed by the CLEAN exercise NAME (#86), so a movement that
// appears on several days shares one history — and must share one set of rules:
// the STRICTEST cap (min capKg, so a suggestion never exceeds the lowest stated
// cap for that movement) and noIncrease if ANY occurrence forbids an increase
// (side lateral raises are the program's strict-form lift, flagged everywhere).
// Built once, lazily, off the data.js globals loaded before this file.
let _exConfigCache = null;
function exerciseConfig(name) {
	if (!_exConfigCache) {
		_exConfigCache = {};
		const clean = (s) =>
			String(s).replace('🍌 ', '').replace('⭐ FIRST', '').trim();
		const tables = [];
		if (typeof WORKOUTS !== 'undefined')
			for (const t of Object.values(WORKOUTS))
				for (const v of Object.values(t)) tables.push(v);
		for (const w of tables) {
			for (const ex of w.exercises || []) {
				const k = clean(ex.name);
				const c = (_exConfigCache[k] = _exConfigCache[k] || {});
				if (ex.capKg != null)
					c.capKg = c.capKg == null ? ex.capKg : Math.min(c.capKg, ex.capKg);
				if (ex.noIncrease) c.noIncrease = true;
				if (ex.stepKg != null) c.stepKg = ex.stepKg;
			}
		}
	}
	return _exConfigCache[name] || null;
}

// Should the app suggest more weight for this movement next time? Reads the
// LAST logged entry for `name` and the movement's guardrails, and returns:
//   • { weight, from, reps, cap } — go: last set was easy AND hit the top rep
//     target, so add stepKg (2.5kg default, or the per-dumbbell stepKg),
//     clamped to capKg. `from`/`reps` carry the reason ("32.5 × 12 felt easy").
//   • { hold: true, cap } — already at (or above) the cap: hold, don't add.
//   • null — no suggestion: no history, last set not easy, short of the target,
//     bodyweight-only (no weight to add to), no numeric target, or the movement
//     forbids increases (noIncrease). NEVER suggests past a cap or on a
//     strict-form lift.
function suggestNext(name, planned) {
	const cfg = exerciseConfig(name);
	if (cfg && cfg.noIncrease) return null; // strict-form lift — never suggest more
	const last =
		typeof lastExlogEntry === 'function' ? lastExlogEntry(name) : null;
	if (!last) return null; // no history to reason over
	if (!last.e) return null; // last session wasn't easy
	if (last.w == null) return null; // bodyweight/reps-only — nothing to add to
	const target = topRep(planned);
	if (target == null) return null; // no fixed rep target (e.g. 'max')
	if (!(last.r >= target)) return null; // fell short of the top rep count
	const cap = cfg && cfg.capKg != null ? cfg.capKg : null;
	if (cap != null && last.w >= cap) return { hold: true, cap };
	const step = cfg && cfg.stepKg != null ? cfg.stepKg : 2.5;
	let weight = last.w + step;
	if (cap != null && weight > cap) weight = cap; // clamp to the cap
	return { weight, from: last.w, reps: last.r, cap };
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
	if (daysLeft === 0) return 'Final day of the program — great work.';
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

// ─── Node-only test exports (inert in the browser — see js/data.js) ─────────
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		SECTION_NAMES,
		splitReps,
		buildItemList,
		todayKey,
		shortDayLabel,
		programNotice,
		TOTAL_WEEKS,
		weekNumber,
		getWeekType,
	};
}
