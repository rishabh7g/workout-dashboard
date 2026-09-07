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

// ─── Item builders ───────────────────────────────────────────────────────────
// buildItemList() flattens a declarative workout object into an ordered list
// of items. Each item gets a stable id like "ex-3" so the UI and localStorage
// agree — the id scheme (`${sec}-${n}`, n counting per section) and item ORDER
// are load-bearing: they are the localStorage tick keys (js/storage.js v1
// envelope), so a reorder would silently re-bind saved ticks to different
// exercises. Items expose `sets` and `reps` SEPARATELY (WD blueprint) so the
// UI can build the numeral block from them; `sub` carries weight + qualifier
// joined with ' · '; scheme-less items (stretches, drills, timed cardio) use
// `sub` alone.
//
// One helper per section below; each returns that section's items WITHOUT an
// id (or [] when the workout does not declare the section). numberItems()
// assigns the ids once, positionally, over the concatenated list.
function item(section, label, extra = {}) {
	return { section, label, ...extra };
}

// Stretches, drills and cool-down entries carry free-text reps in `sub`.
function freeTextItem(section, ex) {
	return item(section, ex.name, { sub: ex.reps, note: ex.note });
}

// Leg-day warm-up (legConditioning days only).
function warmupItems(workout) {
	if (!workout.legConditioning) return [];
	return [
		item('warmup', t('data.items.legSwings.label'), {
			sub: t('data.items.legSwings.sub'),
		}),
		item('warmup', t('data.items.ankleCircles.label'), {
			sub: t('data.items.ankleCircles.sub'),
		}),
		item('warmup', t('data.items.reverseLunges.label'), {
			sets: 3,
			reps: '10',
			sub: t('data.items.reverseLunges.sub'),
		}),
	];
}

// The workout's own strength exercises.
function exerciseItems(workout) {
	return (workout.exercises || []).map(exerciseItem);
}

function exerciseItem(ex) {
	const r = splitReps(ex.reps);
	const sub = [ex.weight, r.sub].filter(Boolean).join(' · ') || null;
	return item('ex', ex.name, {
		sets: ex.sets,
		reps: r.reps,
		sub,
		note: ex.note,
		cap: ex.cap,
		warn: ex.warn,
	});
}

// The shared CORE block, plus Pallof press on anti-rotation days.
function coreItems(workout) {
	if (!workout.hasCore) return [];
	const items = CORE.map((ex) =>
		item('core', ex.name, { sets: ex.sets, reps: String(ex.reps), note: ex.note }),
	);
	if (workout.coreType === 'anti-rotation')
		items.push(
			item('core', t('data.items.pallofPress.label'), {
				sets: 3,
				reps: '12',
				sub: t('data.items.pallofPress.sub'),
				note: t('data.items.pallofPress.note'),
			}),
		);
	return items;
}

// Leg-day finisher (legConditioning days only).
function finisherItems(workout) {
	if (!workout.legConditioning) return [];
	return [
		item('finisher', t('data.items.wallSit.label'), {
			sets: 3,
			reps: t('data.items.wallSit.reps'),
		}),
		item('finisher', t('data.items.singleLegRdl.label'), {
			sets: 3,
			reps: '10',
			sub: t('data.items.singleLegRdl.sub'),
			note: t('data.items.singleLegRdl.note'),
		}),
	];
}

// 'armConditioning' = the arm-day conditioning slot — it emits the Ankle
// Stability block (running prehab), not arm work.
function ankleItems(workout) {
	if (!workout.armConditioning) return [];
	return [
		item('ankle', t('data.items.balanceHold.label'), {
			sets: 3,
			reps: t('data.items.balanceHold.reps'),
			sub: t('data.items.balanceHold.sub'),
			note: t('data.items.balanceHold.note'),
		}),
		item('ankle', t('data.items.calfRaises.label'), {
			sets: 3,
			reps: '15',
			sub: t('data.items.calfRaises.sub'),
		}),
		item('ankle', t('data.items.bandWalks.label'), {
			sets: 3,
			reps: '15',
			sub: t('data.items.bandWalks.sub'),
		}),
	];
}

// Timed cardio shows its duration in the sub line (no numeral block) — the
// blueprint's chosen shape (design/workout-data.js:407-408).
function cardioItems(workout) {
	const items = [];
	if (workout.hasStairmaster)
		items.push(
			item('cardio', t('data.items.stairmaster.label'), {
				sub: t('data.items.stairmaster.sub'),
			}),
		);
	if (workout.hasInclineTreadmill)
		items.push(
			item('cardio', t('data.items.inclineTreadmill.label'), {
				sub: t('data.items.inclineTreadmill.sub'),
				note: t('data.items.inclineTreadmill.note'),
			}),
		);
	return items;
}

function stretchItems(workout) {
	return (workout.stretching || []).map((ex) => freeTextItem('stretch', ex));
}

// Run days list their drills individually when the workout carries them,
// otherwise a single "drills session" item.
function drillItems(workout) {
	if (!workout.hasRun) return [];
	if (workout.drills) return workout.drills.map((d) => freeTextItem('drills', d));
	return [
		item('drills', t('data.items.drillsSession.label'), {
			sub: t('data.items.drillsSession.sub'),
			note: t('data.items.drillsSession.note'),
		}),
	];
}

function runItems(workout) {
	if (!workout.hasRun) return [];
	return [
		item('run', t('data.items.run.label'), {
			sub: t('data.items.run.sub'),
			note: t('data.items.run.note'),
		}),
	];
}

function cooldownItems(workout) {
	return (workout.cooldown || []).map((ex) => freeTextItem('cooldown', ex));
}

// Assign the positional ids: the n-th item of a section is `${section}-${n}`.
function numberItems(items) {
	const counts = {};
	return items.map((it) => {
		counts[it.section] = (counts[it.section] || 0) + 1;
		return { id: `${it.section}-${counts[it.section]}`, ...it };
	});
}

// The section order IS the checklist order — see the id note above before
// reordering anything here.
function buildItemList(workout) {
	const sections = [
		warmupItems(workout),
		exerciseItems(workout),
		coreItems(workout),
		finisherItems(workout),
		ankleItems(workout),
		cardioItems(workout),
		stretchItems(workout),
		drillItems(workout),
		runItems(workout),
		cooldownItems(workout),
	];
	return numberItems(sections.flat());
}

// ─── Date helpers ────────────────────────────────────────────────────────────
// "Today" as a YYYY-MM-DD key — the format scheduleFor() (js/data.js) takes.
function todayKey() {
	return fmtDayKey(new Date());
}

function shortDayLabel(key) {
	return parseDayKey(key).toLocaleDateString('en-AU', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	});
}

// Program-position week number for a date key. Week 1 starts Monday
// 2026-05-25 (CYCLE_ANCHOR); the opening weekend (May 23–24) is week 0.
// Unbounded by design — it keeps counting for as long as the user trains, so
// it is the right input for cycle position but NOT something to display raw.
function weekNumber(key) {
	const days = Math.round((mondayOf(key) - CYCLE_ANCHOR) / 86400000);
	return Math.floor(days / 7) + 1;
}

// Position inside the repeating four-week cycle: 1..CYCLE_WEEKS, the number
// the header eyebrow shows as "Week n / 4". weekNumber() alone would read
// "Week 47 / 26" a year in — an unbounded count against a length the program
// no longer has (#194). Week 0 (the opening weekend, before CYCLE_ANCHOR) has
// no cycle position; the eyebrow labels it separately and never calls this.
function cycleWeek(key) {
	const n = weekNumber(key);
	return (((n - 1) % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS + 1;
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
		const weekNum = Math.round((mondayOf(key) - CYCLE_ANCHOR) / 604800000);
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
		weekNumber,
		cycleWeek,
		getWeekType,
	};
}
