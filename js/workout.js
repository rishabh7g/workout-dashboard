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

// ─── Node-only strings bootstrap (inert in the browser — see js/data.js) ────
if (typeof module !== 'undefined' && module.exports && typeof t === 'undefined') {
	Object.assign(globalThis, require('./strings.js'));
}

// Human-readable headings for each section key used in buildItemList().
// The section KEYS are this file's own internal vocabulary; the headings read
// from the keyed bundle (js/strings.js, #189) so ui.js and this map can never
// drift into two different words for the same section.
const SECTION_NAMES = {
	warmup: t('data.sectionNames.warmup'),
	ex: t('data.sectionNames.ex'),
	core: t('data.sectionNames.core'),
	finisher: t('data.sectionNames.finisher'),
	ankle: t('data.sectionNames.ankle'),
	cardio: t('data.sectionNames.cardio'),
	stretch: t('data.sectionNames.stretch'),
	drills: t('data.sectionNames.drills'),
	run: t('data.sectionNames.run'),
	cooldown: t('data.sectionNames.cooldown'),
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
		add('warmup', t('data.items.legSwings.label'), {
			sub: t('data.items.legSwings.sub'),
		});
		add('warmup', t('data.items.ankleCircles.label'), {
			sub: t('data.items.ankleCircles.sub'),
		});
		add('warmup', t('data.items.reverseLunges.label'), {
			sets: 3,
			reps: '10',
			sub: t('data.items.reverseLunges.sub'),
		});
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
			add('core', t('data.items.pallofPress.label'), {
				sets: 3,
				reps: '12',
				sub: t('data.items.pallofPress.sub'),
				note: t('data.items.pallofPress.note'),
			});
	}

	if (workout.legConditioning) {
		add('finisher', t('data.items.wallSit.label'), {
			sets: 3,
			reps: t('data.items.wallSit.reps'),
		});
		add('finisher', t('data.items.singleLegRdl.label'), {
			sets: 3,
			reps: '10',
			sub: t('data.items.singleLegRdl.sub'),
			note: t('data.items.singleLegRdl.note'),
		});
	}

	// 'armConditioning' = the arm-day conditioning slot — it emits the Ankle Stability block (running prehab), not arm work.
	if (workout.armConditioning) {
		add('ankle', t('data.items.balanceHold.label'), {
			sets: 3,
			reps: t('data.items.balanceHold.reps'),
			sub: t('data.items.balanceHold.sub'),
			note: t('data.items.balanceHold.note'),
		});
		add('ankle', t('data.items.calfRaises.label'), {
			sets: 3,
			reps: '15',
			sub: t('data.items.calfRaises.sub'),
		});
		add('ankle', t('data.items.bandWalks.label'), {
			sets: 3,
			reps: '15',
			sub: t('data.items.bandWalks.sub'),
		});
	}

	// Timed cardio shows its duration in the sub line (no numeral block) — the
	// blueprint's chosen shape (design/workout-data.js:407-408).
	if (workout.hasStairmaster) {
		add('cardio', t('data.items.stairmaster.label'), {
			sub: t('data.items.stairmaster.sub'),
		});
	}

	if (workout.hasInclineTreadmill) {
		add('cardio', t('data.items.inclineTreadmill.label'), {
			sub: t('data.items.inclineTreadmill.sub'),
			note: t('data.items.inclineTreadmill.note'),
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
			add('drills', t('data.items.drillsSession.label'), {
				sub: t('data.items.drillsSession.sub'),
				note: t('data.items.drillsSession.note'),
			});
		}
		add('run', t('data.items.run.label'), {
			sub: t('data.items.run.sub'),
			note: t('data.items.run.note'),
		});
	}

	if (workout.cooldown) {
		for (const ex of workout.cooldown) {
			add('cooldown', ex.name, { sub: ex.reps, note: ex.note });
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
	if (daysLeft === 0) return t('data.programNotice.finalDay');
	const noticeKey =
		daysLeft === 1
			? 'data.programNotice.endsOneDay'
			: 'data.programNotice.endsManyDays';
	return t(noticeKey, { date: shortDayLabel(PROGRAM_END), days: daysLeft });
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
	if (type === 'running') return t('data.weekType.sat');
	if (type === 'recovery') return t('data.weekType.sun');
	if (['chest', 'legs-quads', 'arms-biceps'].includes(type))
		return t('data.weekType.front');
	if (['back', 'legs-hamstrings', 'arms-triceps'].includes(type))
		return t('data.weekType.back');
	if (type === 'shoulders' && key) {
		const [y, m, d] = key.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const dow = date.getDay();
		const toMon = dow === 0 ? -6 : 1 - dow;
		const weekMon = new Date(y, m - 1, d + toMon);
		const anchor = CYCLE_ANCHOR;
		const weekNum = Math.round((weekMon - anchor) / 604800000);
		return weekNum % 2 === 0 ? t('data.weekType.back') : t('data.weekType.front');
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
