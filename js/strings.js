/*
 * strings.js — The one keyed bundle every user-facing string in the app reads
 * from (#175). Loaded FIRST (before data.js), so every other classic script
 * can call t('dot.path', params) on the shared global scope.
 *
 * Dot-path keys so the file reads like a document (ritual.stepTitle.check,
 * not a flat ritual_stepTitle_check). STRINGS_KEYS is the canonical flat list
 * — hand-maintained, not derived from STRINGS — so tests/strings.test.js can
 * catch drift between "the keys this app is supposed to carry" and "the keys
 * the STRINGS object actually has" (a typo in either place fails loudly
 * instead of rendering a blank). STRINGS_PLACEHOLDERS is the companion table:
 * every {placeholder} a value uses must be declared here, welded to the key.
 *
 * A missing key is a failure, not a fallback (see t() below) — there is no
 * English fallback anywhere in the shell, so a slipped key is a visible
 * failure the checker (tests/strings.test.js) or a thrown error catches, not
 * a silently-wrong word.
 */

const STRINGS = {
	ui: {
		// `${page} — workout-dashboard`, shared by every render path's document.title.
		docTitleWith: '{page} — workout-dashboard',
		entry: {
			outsideSchedule: 'Outside schedule',
			restDay: 'Rest Day',
			runningSat: 'Running · Sat · Var {variation}',
			runningSun: 'Running · Sun · Var {variation}',
		},
		swap: {
			sheetTitle: "Follow a different day's workout",
			close: 'Close',
			noUpcoming: 'No upcoming days in schedule',
			following: "Following {day}'s workout",
			backToToday: "Back to today's workout",
			undo: 'Undo',
		},
		backup: {
			lastBackup: 'Last backup {date}',
			noBackupYet: 'No backup yet',
			statusUnknown: 'Backup status unknown',
			restored: 'Backup restored',
			restoreFailedStorage: 'Restore failed — storage unavailable',
			notValidFile: 'Not a valid backup file',
			couldNotReadFile: 'Could not read file',
			exportFailedTruncated: 'Backup failed — some saved data could not be read.',
			shareTitle: 'Workout backup',
			exportBtn: 'Export backup',
			restoreBtn: 'Restore backup',
			armImport: 'Tap again to replace all data',
		},
		reset: {
			btn: 'Reset progress',
			arm: 'Tap again to reset',
		},
		done: {
			programCompleteTitle: 'Program Complete!',
			workoutCompleteTitle: 'Workout complete',
			programEndSub: 'You finished the full {programLabel} program. Outstanding work.',
		},
		principles: {
			heading: 'Principles',
			weight: 'Increase weight before reps — add 2.5kg when 12 reps feels easy',
			rest: 'Rest 60–90s isolation · 2 min compounds',
			// Both trimmed to the rule (#176): each dropped only the explanatory
			// clause wrapped around it, keeping the prescriptive rule itself.
			lateralRaise: 'Side lateral raises non-negotiable',
			hangingRaise: 'Hanging raises: no twisting variants',
			noShrugs: 'No shrugs · no weighted side bends · no heavy deadlifts',
		},
		eyebrow: {
			outsideProgram: 'Outside program',
			openingWeekend: 'Opening Weekend',
			week: 'Week {n} / {total}',
		},
		weekStrip: {
			groupRest: 'Rest',
			groupLegs: 'Legs',
			groupBack: 'Back',
			groupChest: 'Chest',
			groupArms: 'Arms',
			groupShoulders: 'Shoulders',
			groupRun: 'Run',
			groupRecovery: 'Recovery',
			dayMonday: 'Monday',
			dayTuesday: 'Tuesday',
			dayWednesday: 'Wednesday',
			dayThursday: 'Thursday',
			dayFriday: 'Friday',
			daySaturday: 'Saturday',
			daySunday: 'Sunday',
			ariaLabel: 'This week',
			todaySuffix: ', today',
		},
		notice: {
			unknownError: 'Unknown error',
			storageWarning: "Progress can't be saved on this device — ticks will be lost when you close the app.",
			definitionChanged: 'Workout definition changed — progress re-checked.',
			stateCorrupted: "Today's saved progress was unreadable and has been reset.",
			quarantineFailed: 'The original record could not be preserved: {detail}',
			quarantineOk: 'The original record was kept for troubleshooting.',
			borrowsCorrupted: 'Your "follow a different day" choice was unreadable and has been reset.',
		},
		// workout-title div, poster h1 AND document.title all render the same
		// text on these two screens, so one key each covers all three sites.
		noWorkout: {
			title: 'No workout today',
			sub: 'This date is outside the current program ({programLabel}).',
		},
		// No .sub here (#176): "Sleep well. Let the muscles rebuild." was
		// read-once reassurance under a title that already says the same thing.
		restDayPoster: {
			title: 'Rest &amp; Recover',
		},
		unresolved: {
			title: "Couldn't load workout",
			sub: "This day's workout couldn't be loaded (<code>{type} · Var {variation}</code>). Check js/data.js.",
		},
		updateToast: 'Updated — tap to refresh',
	},
	data: {
		// The section headings buildItemList() (js/workout.js) groups items under —
		// SECTION_NAMES there stays the internal section-key map; ui.js reads the
		// display text from here so the render site itself carries no literal.
		sectionNames: {
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
		},
	},
};

// The canonical flat key list — hand-maintained, not derived from STRINGS, so
// the checker in tests/strings.test.js can catch a key present in one but not
// the other (the typo tripwire).
const STRINGS_KEYS = [
	'ui.docTitleWith',
	'ui.entry.outsideSchedule',
	'ui.entry.restDay',
	'ui.entry.runningSat',
	'ui.entry.runningSun',
	'ui.swap.sheetTitle',
	'ui.swap.close',
	'ui.swap.noUpcoming',
	'ui.swap.following',
	'ui.swap.backToToday',
	'ui.swap.undo',
	'ui.backup.lastBackup',
	'ui.backup.noBackupYet',
	'ui.backup.statusUnknown',
	'ui.backup.shareTitle',
	'ui.backup.restored',
	'ui.backup.restoreFailedStorage',
	'ui.backup.notValidFile',
	'ui.backup.couldNotReadFile',
	'ui.backup.exportFailedTruncated',
	'ui.backup.exportBtn',
	'ui.backup.restoreBtn',
	'ui.backup.armImport',
	'ui.reset.btn',
	'ui.reset.arm',
	'ui.done.programCompleteTitle',
	'ui.done.workoutCompleteTitle',
	'ui.done.programEndSub',
	'ui.principles.heading',
	'ui.principles.weight',
	'ui.principles.rest',
	'ui.principles.lateralRaise',
	'ui.principles.hangingRaise',
	'ui.principles.noShrugs',
	'ui.eyebrow.outsideProgram',
	'ui.eyebrow.openingWeekend',
	'ui.eyebrow.week',
	'ui.weekStrip.groupRest',
	'ui.weekStrip.groupLegs',
	'ui.weekStrip.groupBack',
	'ui.weekStrip.groupChest',
	'ui.weekStrip.groupArms',
	'ui.weekStrip.groupShoulders',
	'ui.weekStrip.groupRun',
	'ui.weekStrip.groupRecovery',
	'ui.weekStrip.dayMonday',
	'ui.weekStrip.dayTuesday',
	'ui.weekStrip.dayWednesday',
	'ui.weekStrip.dayThursday',
	'ui.weekStrip.dayFriday',
	'ui.weekStrip.daySaturday',
	'ui.weekStrip.daySunday',
	'ui.weekStrip.ariaLabel',
	'ui.weekStrip.todaySuffix',
	'ui.notice.unknownError',
	'ui.notice.storageWarning',
	'ui.notice.definitionChanged',
	'ui.notice.stateCorrupted',
	'ui.notice.quarantineFailed',
	'ui.notice.quarantineOk',
	'ui.notice.borrowsCorrupted',
	'ui.noWorkout.title',
	'ui.noWorkout.sub',
	'ui.restDayPoster.title',
	'ui.unresolved.title',
	'ui.unresolved.sub',
	'ui.updateToast',
	'data.sectionNames.warmup',
	'data.sectionNames.ex',
	'data.sectionNames.core',
	'data.sectionNames.finisher',
	'data.sectionNames.ankle',
	'data.sectionNames.cardio',
	'data.sectionNames.stretch',
	'data.sectionNames.drills',
	'data.sectionNames.run',
	'data.sectionNames.cooldown',
];

// Companion placeholder table — only keys whose value carries {placeholders}
// need an entry; everything else implicitly expects none.
const STRINGS_PLACEHOLDERS = {
	'ui.docTitleWith': ['page'],
	'ui.entry.runningSat': ['variation'],
	'ui.entry.runningSun': ['variation'],
	'ui.swap.following': ['day'],
	'ui.backup.lastBackup': ['date'],
	'ui.done.programEndSub': ['programLabel'],
	'ui.eyebrow.week': ['n', 'total'],
	'ui.notice.quarantineFailed': ['detail'],
	'ui.noWorkout.sub': ['programLabel'],
	'ui.unresolved.sub': ['type', 'variation'],
};

// Look up a dot-path in STRINGS, returning undefined (never a fallback
// string) when any segment is missing.
function resolveStringPath(path) {
	const parts = String(path).split('.');
	let node = STRINGS;
	for (const part of parts) {
		if (node === null || typeof node !== 'object' || !(part in node)) {
			return undefined;
		}
		node = node[part];
	}
	return typeof node === 'string' ? node : undefined;
}

// t('dot.path', { placeholder: value }) — the ONE lookup every render site
// uses. A missing key or a missing placeholder value THROWS rather than
// returning the key, an empty string, or hardcoded English: with no fallback
// anywhere in the shell, a slipped key must be a loud failure, not a silently
// blank or silently-wrong screen.
function t(path, params) {
	const value = resolveStringPath(path);
	if (value === undefined) {
		throw new Error(`strings.js: missing key "${path}"`);
	}
	if (!params) return value;
	return value.replace(/\{([a-zA-Z0-9]+)\}/g, (match, name) => {
		if (!Object.prototype.hasOwnProperty.call(params, name)) {
			throw new Error(`strings.js: missing placeholder "${name}" for key "${path}"`);
		}
		return String(params[name]);
	});
}

// ─── Node-only test exports (inert in the browser — see js/data.js) ─────────
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		STRINGS,
		STRINGS_KEYS,
		STRINGS_PLACEHOLDERS,
		t,
		resolveStringPath,
	};
}
