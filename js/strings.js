/*
 * strings.js — The one keyed bundle every user-facing string in the app reads
 * from (#175, extended to the exercise database and js/workout.js's section
 * copy by #189). Loaded FIRST (before data.js), so every other classic script
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
		// One title, always: the program repeats indefinitely (#194), so there
		// is no "Program Complete!" moment to announce and no end-date sub.
		// The non-program-end .done-sub was already deleted as read-once
		// reassurance under a title that says the same thing (#176).
		done: {
			workoutCompleteTitle: 'Workout complete',
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
			sub: 'The program starts {programLabel}.',
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
		// The section headings buildItemList() (js/workout.js) groups items under.
		// SECTION_NAMES there stays the internal section-key map and reads its
		// headings from here (#189); ui.js reads the same keys, so neither site
		// carries a literal and the two can never drift apart.
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
		// ─── js/workout.js copy ──────────────────────────────────────────
		// The items buildItemList() (js/workout.js) adds from a workout's
		// DECLARATIVE flags — 'this day has leg conditioning', 'this day has a
		// run' — rather than from an entry in the data.js trees. Keyed by the
		// item, not by the section, because the same section can be fed by more
		// than one flag.
		items: {
			legSwings: {
				label: 'Leg swings',
				sub: 'Front-back + side-side · 10 each',
			},
			ankleCircles: { label: 'Ankle circles', sub: 'Both directions' },
			reverseLunges: { label: 'Reverse lunges', sub: 'each leg' },
			pallofPress: {
				label: 'Pallof press',
				sub: 'each side',
				note: 'Anti-rotation — stability for cutting',
			},
			wallSit: { label: 'Wall sit', reps: '45 sec' },
			singleLegRdl: {
				label: 'Single-leg RDL',
				sub: 'Bodyweight · each leg',
				note: 'Especially valuable on quad days',
			},
			balanceHold: {
				label: 'Single-leg balance hold',
				reps: '30 sec',
				sub: 'each',
				note: 'Progress: eyes closed',
			},
			calfRaises: { label: 'Single-leg calf raises', sub: 'each' },
			bandWalks: {
				label: 'Lateral band walks',
				sub: 'steps each direction',
			},
			stairmaster: { label: 'Stairmaster', sub: '10 min · 30lb vest' },
			inclineTreadmill: {
				label: 'Incline treadmill',
				sub: '10 min · speed 4 · level 15 · 30lb vest',
				note: 'Brace core · no holding rails',
			},
			drillsSession: {
				label: 'Drills session',
				sub: '30 min',
				note: 'Content TBD — your picks',
			},
			run: {
				label: 'Run — lanes 9→4',
				sub: '6 lanes descending',
				note: 'Banana before · duration = time taken',
			},
		},
		// The Front/Back parity label getWeekType() (js/workout.js) returns for
		// the header eyebrow. Running days show their lane pattern instead.
		weekType: {
			sat: 'Sat · 9→4',
			sun: 'Sun · 9→4',
			front: 'Front Week',
			back: 'Back Week',
		},
		// PROGRAM_LABEL (js/data.js) — the program's start date in prose. Read
		// by the one screen a date can still fail to resolve on: a date BEFORE
		// the program began. There is no end-date copy any more; the schedule
		// repeats indefinitely (#194), so the old programNotice() wind-down
		// ("Program ends …") was deleted rather than made permanent.
		programLabel: 'Saturday 23 May 2026',
		// ─── js/data.js exercise database (#189) ─────────────────────────
		// A mechanical move of the trees in js/data.js: same shape, same
		// order, same strings — the literals just live here now and the data
		// file reads them with t(). Positional keys (exercises.0.name) mirror
		// the arrays they came from, so a key and its render site line up
		// index for index.
		core: [
			{ name: 'Hanging leg raise' },
			{ name: 'Hanging knee raise' },
			{
				name: 'Kneeling cable crunch',
				note: 'Rope behind head, hands facing down — crunch by contracting abs, not pulling with arms',
			},
		],
		drills: [
			{ name: 'High knees', reps: '1 length' },
			{ name: 'Walk → back kicks (cone to cone)', reps: '1 length' },
			{ name: 'Sideways walk left + right → back', reps: '1 length' },
			{
				name: 'Backward walk + Frankenstein leg swing',
				reps: '1 length',
			},
			{ name: 'Hip circles (light jog outside)', reps: '1 length' },
			{ name: 'Side ankle touch outside', reps: '1 length' },
			{ name: 'Side frog jumps', reps: '1 length' },
			{ name: 'Suicide runs', reps: '30m → 20m → 10m', note: '3 rounds' },
			{ name: 'Sideways shuffles', reps: '1 length' },
		],
		workouts: {
			legsQuadsA: {
				title: 'Legs — Quads',
				exercises: [
					{
						name: 'Squats',
						weight: '15kg/side',
						cap: '60kg total (bar + plates)',
						warn: 'Beyond this thickens spinal erectors',
					},
					{ name: 'Hack squat', cap: '80kg total' },
					{
						name: 'Leg press',
						note: 'Feet LOW = quads',
						cap: '80kg total',
					},
					{
						name: 'Leg extension',
						weight: '20–25kg',
						note: 'Slow lowering',
					},
				],
			},
			legsQuadsB: {
				title: 'Legs — Quads',
				exercises: [
					{ name: 'Goblet squat' },
					{
						name: 'Walking lunges',
						reps: '10 each leg',
						note: 'With dumbbells',
						cap: '10kg per dumbbell',
						warn: 'Heavy lunges bulk glutes and widen hips',
					},
					{ name: 'Hack squat', cap: '80kg total' },
				],
			},
			legsHamstringsA: {
				title: 'Legs — Hamstrings',
				exercises: [
					{
						name: 'Squats',
						weight: '15kg/side',
						cap: '60kg total (bar + plates)',
						warn: 'Beyond this thickens spinal erectors',
					},
					{
						name: 'Romanian deadlift',
						cap: '20kg/side (40kg total)',
					},
					{
						name: 'Leg press',
						note: 'Feet HIGH = hamstrings',
						cap: '100kg total',
					},
					{ name: 'Lying leg curl', weight: '32–40kg' },
				],
			},
			legsHamstringsB: {
				title: 'Legs — Hamstrings',
				exercises: [
					{
						name: 'Romanian deadlift',
						cap: '20kg/side (40kg total)',
					},
					{
						name: 'Walking lunges',
						reps: '10 each leg',
						note: 'With dumbbells',
						cap: '10kg per dumbbell',
						warn: 'Heavy lunges bulk glutes and widen hips',
					},
					{ name: 'Lying leg curl', weight: '32–40kg' },
				],
			},
			chestA: {
				title: 'Chest + Core',
				exercises: [
					{ name: 'Push-ups' },
					{
						name: 'Incline dumbbell press',
						weight: '10kg',
						cap: '14kg',
						warn: 'Chest size is not your V-shape lever',
					},
					{ name: 'High cable fly' },
					{ name: 'Mid cable fly' },
					{ name: 'Side lateral raises', weight: '5kg' },
				],
			},
			chestB: {
				title: 'Chest + Core',
				exercises: [
					{ name: 'Push-ups' },
					{ name: 'Flat dumbbell press', cap: '14kg' },
					{ name: 'Incline cable fly' },
					{ name: 'Incline dumbbell fly', cap: '12kg' },
					{ name: 'Side lateral raises', weight: '5kg' },
				],
			},
			backA: {
				title: 'Back + Core',
				exercises: [
					{
						name: 'Pull-ups',
						reps: '7→10',
						note: 'No cap — add weight progressively. Primary lat width builder.',
					},
					{ name: 'Straight-arm pulldown' },
					{ name: 'Reverse pec deck' },
					{
						name: 'Seated cable row',
						weight: '25–30kg',
						cap: '40kg',
						warn: 'Beyond this recruits traps for thickness, not lats for width',
					},
					{ name: 'Side lateral raises', weight: '5kg' },
				],
			},
			backB: {
				title: 'Back + Core',
				exercises: [
					{
						name: 'Lat pulldown (wide grip)',
						note: 'No cap — progress freely. Builds lat width.',
					},
					{
						name: 'Single-arm cable row',
						reps: '10 each side',
						note: 'Cable at low position, elbow back, squeeze lat at contraction',
						cap: '40kg',
					},
					{ name: 'Cable face pull' },
					{
						name: 'Wide grip seated cable row',
						cap: '40kg',
						warn: 'Beyond this recruits traps for thickness, not lats for width',
					},
					{ name: 'Side lateral raises', weight: '5kg' },
				],
			},
			armsBicepsA: {
				title: 'Arms — Biceps',
				exercises: [
					{ name: 'Pull-ups', reps: 'max' },
					{ name: 'Cable curl', weight: '15kg' },
					{ name: 'Reverse cable curl', weight: '10kg' },
					{ name: 'Incline dumbbell curl', weight: '7–8kg' },
				],
			},
			armsBicepsB: {
				title: 'Arms — Biceps',
				exercises: [
					{ name: 'Hammer curl', weight: '8–10kg' },
					{ name: 'Preacher curl' },
					{ name: 'Concentration curl', weight: '6–8kg' },
					{ name: 'Cable curl (rope attachment)' },
				],
			},
			armsTricepsA: {
				title: 'Arms — Triceps',
				exercises: [
					{ name: 'Cable pushdown' },
					{ name: 'Single-hand pushdown' },
					{ name: 'Overhead cable extension' },
				],
			},
			armsTricepsB: {
				title: 'Arms — Triceps',
				exercises: [
					{ name: 'Skull crushers (EZ bar)' },
					{ name: 'Close grip push-ups' },
					{ name: 'Dumbbell overhead tricep extension' },
				],
			},
			shouldersA: {
				title: 'Shoulders + Core',
				exercises: [
					{
						name: 'Side lateral raises ⭐ FIRST',
						weight: '5kg',
						note: 'Strict form — do NOT increase weight',
					},
					{
						name: 'Dumbbell shoulder press',
						weight: '8–10kg',
						cap: '12kg',
						warn: 'Heavier shifts load to front delts and traps',
					},
					{
						name: 'Lying cable face pull',
						note: 'Rope. Lie on floor/bench, head close to stack, pull toward face with elbows flaring wide',
					},
					{ name: 'Side lateral raises (burnout)', weight: '3–4kg' },
				],
			},
			shouldersB: {
				title: 'Shoulders + Core',
				exercises: [
					{
						name: 'Side lateral raises ⭐ FIRST',
						weight: '5kg',
						note: 'Strict form — do NOT increase weight',
					},
					{
						name: 'Seated dumbbell lateral raise',
						cap: '6kg',
						note: 'Strict isolation, zero trap involvement',
					},
					{
						name: 'Unilateral cable lateral raise',
						reps: '12 each side',
					},
					{
						name: 'Reverse pec deck',
						note: 'Sit facing machine, chest against pad, squeeze at widest point, slow return',
					},
					{ name: 'Side lateral raises (burnout)', weight: '3–4kg' },
				],
			},
		},
		runningDays: {
			runningA: {
				title: 'Running Day — Saturday',
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
					{
						name: 'Hip circles (standing)',
						reps: '10 each direction',
					},
					{ name: 'Lateral lunges with reach', reps: '8 each side' },
				],
				cooldown: [
					{ name: 'Standing quad stretch', reps: '30 sec each leg' },
					{
						name: 'Kneeling hip flexor stretch',
						reps: '30 sec each side',
					},
					{
						name: 'Seated butterfly / adductor stretch',
						reps: '30 sec',
					},
					{
						name: 'Figure-4 glute stretch',
						reps: '30 sec each side',
					},
					{
						name: 'Standing IT band stretch (cross-leg side bend)',
						reps: '30 sec each side',
					},
					{
						name: 'Calf stretch against wall',
						reps: '30 sec each leg',
					},
					{
						name: 'Foam roll: quads, IT band, calves',
						reps: '1 min each',
					},
					{ name: 'Deep breathing', reps: '1–2 min' },
				],
			},
			runningB: {
				title: 'Running Day — Saturday',
				stretching: [
					{ name: 'Light jog', reps: '1 min' },
					{ name: 'Inchworm walkouts', reps: '5 reps' },
					{
						name: "World's greatest stretch (lunge + rotation)",
						reps: '5 each side',
					},
					{
						name: 'High knee march with arm drive',
						reps: '10 steps',
					},
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
					{
						name: 'Lying figure-4 stretch',
						reps: '30 sec each side',
					},
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
			recoveryA: {
				title: 'Running Day — Sunday',
				stretching: [
					{ name: 'Brisk walk / light jog', reps: '1–2 min' },
					{
						name: 'Arm circles, forward/backward',
						reps: '10 each direction',
					},
					{ name: 'Standing torso twists', reps: '10 each side' },
					{ name: 'Leg swings front-to-back', reps: '10 each leg' },
					{ name: 'Standing cat-cow', reps: '8 reps' },
					{
						name: 'Standing hamstring scoop/reach',
						reps: '8 each leg',
					},
					{ name: 'Ankle alphabet', reps: 'one pass each foot' },
					{
						name: 'Walking lunges (no rotation)',
						reps: '6 each leg',
					},
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
			recoveryB: {
				title: 'Running Day — Sunday',
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
	'ui.done.workoutCompleteTitle',
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
	'data.items.legSwings.label',
	'data.items.legSwings.sub',
	'data.items.ankleCircles.label',
	'data.items.ankleCircles.sub',
	'data.items.reverseLunges.label',
	'data.items.reverseLunges.sub',
	'data.items.pallofPress.label',
	'data.items.pallofPress.sub',
	'data.items.pallofPress.note',
	'data.items.wallSit.label',
	'data.items.wallSit.reps',
	'data.items.singleLegRdl.label',
	'data.items.singleLegRdl.sub',
	'data.items.singleLegRdl.note',
	'data.items.balanceHold.label',
	'data.items.balanceHold.reps',
	'data.items.balanceHold.sub',
	'data.items.balanceHold.note',
	'data.items.calfRaises.label',
	'data.items.calfRaises.sub',
	'data.items.bandWalks.label',
	'data.items.bandWalks.sub',
	'data.items.stairmaster.label',
	'data.items.stairmaster.sub',
	'data.items.inclineTreadmill.label',
	'data.items.inclineTreadmill.sub',
	'data.items.inclineTreadmill.note',
	'data.items.drillsSession.label',
	'data.items.drillsSession.sub',
	'data.items.drillsSession.note',
	'data.items.run.label',
	'data.items.run.sub',
	'data.items.run.note',
	'data.weekType.sat',
	'data.weekType.sun',
	'data.weekType.front',
	'data.weekType.back',
	'data.programLabel',
	'data.core.0.name',
	'data.core.1.name',
	'data.core.2.name',
	'data.core.2.note',
	'data.drills.0.name',
	'data.drills.0.reps',
	'data.drills.1.name',
	'data.drills.1.reps',
	'data.drills.2.name',
	'data.drills.2.reps',
	'data.drills.3.name',
	'data.drills.3.reps',
	'data.drills.4.name',
	'data.drills.4.reps',
	'data.drills.5.name',
	'data.drills.5.reps',
	'data.drills.6.name',
	'data.drills.6.reps',
	'data.drills.7.name',
	'data.drills.7.reps',
	'data.drills.7.note',
	'data.drills.8.name',
	'data.drills.8.reps',
	'data.workouts.legsQuadsA.title',
	'data.workouts.legsQuadsA.exercises.0.name',
	'data.workouts.legsQuadsA.exercises.0.weight',
	'data.workouts.legsQuadsA.exercises.0.cap',
	'data.workouts.legsQuadsA.exercises.0.warn',
	'data.workouts.legsQuadsA.exercises.1.name',
	'data.workouts.legsQuadsA.exercises.1.cap',
	'data.workouts.legsQuadsA.exercises.2.name',
	'data.workouts.legsQuadsA.exercises.2.note',
	'data.workouts.legsQuadsA.exercises.2.cap',
	'data.workouts.legsQuadsA.exercises.3.name',
	'data.workouts.legsQuadsA.exercises.3.weight',
	'data.workouts.legsQuadsA.exercises.3.note',
	'data.workouts.legsQuadsB.title',
	'data.workouts.legsQuadsB.exercises.0.name',
	'data.workouts.legsQuadsB.exercises.1.name',
	'data.workouts.legsQuadsB.exercises.1.reps',
	'data.workouts.legsQuadsB.exercises.1.note',
	'data.workouts.legsQuadsB.exercises.1.cap',
	'data.workouts.legsQuadsB.exercises.1.warn',
	'data.workouts.legsQuadsB.exercises.2.name',
	'data.workouts.legsQuadsB.exercises.2.cap',
	'data.workouts.legsHamstringsA.title',
	'data.workouts.legsHamstringsA.exercises.0.name',
	'data.workouts.legsHamstringsA.exercises.0.weight',
	'data.workouts.legsHamstringsA.exercises.0.cap',
	'data.workouts.legsHamstringsA.exercises.0.warn',
	'data.workouts.legsHamstringsA.exercises.1.name',
	'data.workouts.legsHamstringsA.exercises.1.cap',
	'data.workouts.legsHamstringsA.exercises.2.name',
	'data.workouts.legsHamstringsA.exercises.2.note',
	'data.workouts.legsHamstringsA.exercises.2.cap',
	'data.workouts.legsHamstringsA.exercises.3.name',
	'data.workouts.legsHamstringsA.exercises.3.weight',
	'data.workouts.legsHamstringsB.title',
	'data.workouts.legsHamstringsB.exercises.0.name',
	'data.workouts.legsHamstringsB.exercises.0.cap',
	'data.workouts.legsHamstringsB.exercises.1.name',
	'data.workouts.legsHamstringsB.exercises.1.reps',
	'data.workouts.legsHamstringsB.exercises.1.note',
	'data.workouts.legsHamstringsB.exercises.1.cap',
	'data.workouts.legsHamstringsB.exercises.1.warn',
	'data.workouts.legsHamstringsB.exercises.2.name',
	'data.workouts.legsHamstringsB.exercises.2.weight',
	'data.workouts.chestA.title',
	'data.workouts.chestA.exercises.0.name',
	'data.workouts.chestA.exercises.1.name',
	'data.workouts.chestA.exercises.1.weight',
	'data.workouts.chestA.exercises.1.cap',
	'data.workouts.chestA.exercises.1.warn',
	'data.workouts.chestA.exercises.2.name',
	'data.workouts.chestA.exercises.3.name',
	'data.workouts.chestA.exercises.4.name',
	'data.workouts.chestA.exercises.4.weight',
	'data.workouts.chestB.title',
	'data.workouts.chestB.exercises.0.name',
	'data.workouts.chestB.exercises.1.name',
	'data.workouts.chestB.exercises.1.cap',
	'data.workouts.chestB.exercises.2.name',
	'data.workouts.chestB.exercises.3.name',
	'data.workouts.chestB.exercises.3.cap',
	'data.workouts.chestB.exercises.4.name',
	'data.workouts.chestB.exercises.4.weight',
	'data.workouts.backA.title',
	'data.workouts.backA.exercises.0.name',
	'data.workouts.backA.exercises.0.reps',
	'data.workouts.backA.exercises.0.note',
	'data.workouts.backA.exercises.1.name',
	'data.workouts.backA.exercises.2.name',
	'data.workouts.backA.exercises.3.name',
	'data.workouts.backA.exercises.3.weight',
	'data.workouts.backA.exercises.3.cap',
	'data.workouts.backA.exercises.3.warn',
	'data.workouts.backA.exercises.4.name',
	'data.workouts.backA.exercises.4.weight',
	'data.workouts.backB.title',
	'data.workouts.backB.exercises.0.name',
	'data.workouts.backB.exercises.0.note',
	'data.workouts.backB.exercises.1.name',
	'data.workouts.backB.exercises.1.reps',
	'data.workouts.backB.exercises.1.note',
	'data.workouts.backB.exercises.1.cap',
	'data.workouts.backB.exercises.2.name',
	'data.workouts.backB.exercises.3.name',
	'data.workouts.backB.exercises.3.cap',
	'data.workouts.backB.exercises.3.warn',
	'data.workouts.backB.exercises.4.name',
	'data.workouts.backB.exercises.4.weight',
	'data.workouts.armsBicepsA.title',
	'data.workouts.armsBicepsA.exercises.0.name',
	'data.workouts.armsBicepsA.exercises.0.reps',
	'data.workouts.armsBicepsA.exercises.1.name',
	'data.workouts.armsBicepsA.exercises.1.weight',
	'data.workouts.armsBicepsA.exercises.2.name',
	'data.workouts.armsBicepsA.exercises.2.weight',
	'data.workouts.armsBicepsA.exercises.3.name',
	'data.workouts.armsBicepsA.exercises.3.weight',
	'data.workouts.armsBicepsB.title',
	'data.workouts.armsBicepsB.exercises.0.name',
	'data.workouts.armsBicepsB.exercises.0.weight',
	'data.workouts.armsBicepsB.exercises.1.name',
	'data.workouts.armsBicepsB.exercises.2.name',
	'data.workouts.armsBicepsB.exercises.2.weight',
	'data.workouts.armsBicepsB.exercises.3.name',
	'data.workouts.armsTricepsA.title',
	'data.workouts.armsTricepsA.exercises.0.name',
	'data.workouts.armsTricepsA.exercises.1.name',
	'data.workouts.armsTricepsA.exercises.2.name',
	'data.workouts.armsTricepsB.title',
	'data.workouts.armsTricepsB.exercises.0.name',
	'data.workouts.armsTricepsB.exercises.1.name',
	'data.workouts.armsTricepsB.exercises.2.name',
	'data.workouts.shouldersA.title',
	'data.workouts.shouldersA.exercises.0.name',
	'data.workouts.shouldersA.exercises.0.weight',
	'data.workouts.shouldersA.exercises.0.note',
	'data.workouts.shouldersA.exercises.1.name',
	'data.workouts.shouldersA.exercises.1.weight',
	'data.workouts.shouldersA.exercises.1.cap',
	'data.workouts.shouldersA.exercises.1.warn',
	'data.workouts.shouldersA.exercises.2.name',
	'data.workouts.shouldersA.exercises.2.note',
	'data.workouts.shouldersA.exercises.3.name',
	'data.workouts.shouldersA.exercises.3.weight',
	'data.workouts.shouldersB.title',
	'data.workouts.shouldersB.exercises.0.name',
	'data.workouts.shouldersB.exercises.0.weight',
	'data.workouts.shouldersB.exercises.0.note',
	'data.workouts.shouldersB.exercises.1.name',
	'data.workouts.shouldersB.exercises.1.cap',
	'data.workouts.shouldersB.exercises.1.note',
	'data.workouts.shouldersB.exercises.2.name',
	'data.workouts.shouldersB.exercises.2.reps',
	'data.workouts.shouldersB.exercises.3.name',
	'data.workouts.shouldersB.exercises.3.note',
	'data.workouts.shouldersB.exercises.4.name',
	'data.workouts.shouldersB.exercises.4.weight',
	'data.runningDays.runningA.title',
	'data.runningDays.runningA.stretching.0.name',
	'data.runningDays.runningA.stretching.0.reps',
	'data.runningDays.runningA.stretching.1.name',
	'data.runningDays.runningA.stretching.1.reps',
	'data.runningDays.runningA.stretching.2.name',
	'data.runningDays.runningA.stretching.2.reps',
	'data.runningDays.runningA.stretching.3.name',
	'data.runningDays.runningA.stretching.3.reps',
	'data.runningDays.runningA.stretching.4.name',
	'data.runningDays.runningA.stretching.4.reps',
	'data.runningDays.runningA.stretching.5.name',
	'data.runningDays.runningA.stretching.5.reps',
	'data.runningDays.runningA.stretching.6.name',
	'data.runningDays.runningA.stretching.6.reps',
	'data.runningDays.runningA.stretching.7.name',
	'data.runningDays.runningA.stretching.7.reps',
	'data.runningDays.runningA.cooldown.0.name',
	'data.runningDays.runningA.cooldown.0.reps',
	'data.runningDays.runningA.cooldown.1.name',
	'data.runningDays.runningA.cooldown.1.reps',
	'data.runningDays.runningA.cooldown.2.name',
	'data.runningDays.runningA.cooldown.2.reps',
	'data.runningDays.runningA.cooldown.3.name',
	'data.runningDays.runningA.cooldown.3.reps',
	'data.runningDays.runningA.cooldown.4.name',
	'data.runningDays.runningA.cooldown.4.reps',
	'data.runningDays.runningA.cooldown.5.name',
	'data.runningDays.runningA.cooldown.5.reps',
	'data.runningDays.runningA.cooldown.6.name',
	'data.runningDays.runningA.cooldown.6.reps',
	'data.runningDays.runningA.cooldown.7.name',
	'data.runningDays.runningA.cooldown.7.reps',
	'data.runningDays.runningB.title',
	'data.runningDays.runningB.stretching.0.name',
	'data.runningDays.runningB.stretching.0.reps',
	'data.runningDays.runningB.stretching.1.name',
	'data.runningDays.runningB.stretching.1.reps',
	'data.runningDays.runningB.stretching.2.name',
	'data.runningDays.runningB.stretching.2.reps',
	'data.runningDays.runningB.stretching.3.name',
	'data.runningDays.runningB.stretching.3.reps',
	'data.runningDays.runningB.stretching.4.name',
	'data.runningDays.runningB.stretching.4.reps',
	'data.runningDays.runningB.stretching.5.name',
	'data.runningDays.runningB.stretching.5.reps',
	'data.runningDays.runningB.stretching.6.name',
	'data.runningDays.runningB.stretching.6.reps',
	'data.runningDays.runningB.stretching.7.name',
	'data.runningDays.runningB.stretching.7.reps',
	'data.runningDays.runningB.cooldown.0.name',
	'data.runningDays.runningB.cooldown.0.reps',
	'data.runningDays.runningB.cooldown.1.name',
	'data.runningDays.runningB.cooldown.1.reps',
	'data.runningDays.runningB.cooldown.2.name',
	'data.runningDays.runningB.cooldown.2.reps',
	'data.runningDays.runningB.cooldown.3.name',
	'data.runningDays.runningB.cooldown.3.reps',
	'data.runningDays.runningB.cooldown.4.name',
	'data.runningDays.runningB.cooldown.4.reps',
	'data.runningDays.runningB.cooldown.5.name',
	'data.runningDays.runningB.cooldown.5.reps',
	'data.runningDays.runningB.cooldown.6.name',
	'data.runningDays.runningB.cooldown.6.reps',
	'data.runningDays.runningB.cooldown.7.name',
	'data.runningDays.runningB.cooldown.7.reps',
	'data.runningDays.recoveryA.title',
	'data.runningDays.recoveryA.stretching.0.name',
	'data.runningDays.recoveryA.stretching.0.reps',
	'data.runningDays.recoveryA.stretching.1.name',
	'data.runningDays.recoveryA.stretching.1.reps',
	'data.runningDays.recoveryA.stretching.2.name',
	'data.runningDays.recoveryA.stretching.2.reps',
	'data.runningDays.recoveryA.stretching.3.name',
	'data.runningDays.recoveryA.stretching.3.reps',
	'data.runningDays.recoveryA.stretching.4.name',
	'data.runningDays.recoveryA.stretching.4.reps',
	'data.runningDays.recoveryA.stretching.5.name',
	'data.runningDays.recoveryA.stretching.5.reps',
	'data.runningDays.recoveryA.stretching.6.name',
	'data.runningDays.recoveryA.stretching.6.reps',
	'data.runningDays.recoveryA.stretching.7.name',
	'data.runningDays.recoveryA.stretching.7.reps',
	'data.runningDays.recoveryA.cooldown.0.name',
	'data.runningDays.recoveryA.cooldown.0.reps',
	'data.runningDays.recoveryA.cooldown.1.name',
	'data.runningDays.recoveryA.cooldown.1.reps',
	'data.runningDays.recoveryA.cooldown.2.name',
	'data.runningDays.recoveryA.cooldown.2.reps',
	'data.runningDays.recoveryA.cooldown.3.name',
	'data.runningDays.recoveryA.cooldown.3.reps',
	'data.runningDays.recoveryA.cooldown.4.name',
	'data.runningDays.recoveryA.cooldown.4.reps',
	'data.runningDays.recoveryA.cooldown.5.name',
	'data.runningDays.recoveryA.cooldown.5.reps',
	'data.runningDays.recoveryA.cooldown.6.name',
	'data.runningDays.recoveryA.cooldown.6.reps',
	'data.runningDays.recoveryA.cooldown.7.name',
	'data.runningDays.recoveryA.cooldown.7.reps',
	'data.runningDays.recoveryB.title',
	'data.runningDays.recoveryB.stretching.0.name',
	'data.runningDays.recoveryB.stretching.0.reps',
	'data.runningDays.recoveryB.stretching.1.name',
	'data.runningDays.recoveryB.stretching.1.reps',
	'data.runningDays.recoveryB.stretching.2.name',
	'data.runningDays.recoveryB.stretching.2.reps',
	'data.runningDays.recoveryB.stretching.3.name',
	'data.runningDays.recoveryB.stretching.3.reps',
	'data.runningDays.recoveryB.stretching.4.name',
	'data.runningDays.recoveryB.stretching.4.reps',
	'data.runningDays.recoveryB.stretching.5.name',
	'data.runningDays.recoveryB.stretching.5.reps',
	'data.runningDays.recoveryB.stretching.6.name',
	'data.runningDays.recoveryB.stretching.6.reps',
	'data.runningDays.recoveryB.stretching.7.name',
	'data.runningDays.recoveryB.stretching.7.reps',
	'data.runningDays.recoveryB.cooldown.0.name',
	'data.runningDays.recoveryB.cooldown.0.reps',
	'data.runningDays.recoveryB.cooldown.1.name',
	'data.runningDays.recoveryB.cooldown.1.reps',
	'data.runningDays.recoveryB.cooldown.2.name',
	'data.runningDays.recoveryB.cooldown.2.reps',
	'data.runningDays.recoveryB.cooldown.3.name',
	'data.runningDays.recoveryB.cooldown.3.reps',
	'data.runningDays.recoveryB.cooldown.4.name',
	'data.runningDays.recoveryB.cooldown.4.reps',
	'data.runningDays.recoveryB.cooldown.5.name',
	'data.runningDays.recoveryB.cooldown.5.reps',
	'data.runningDays.recoveryB.cooldown.6.name',
	'data.runningDays.recoveryB.cooldown.6.reps',
	'data.runningDays.recoveryB.cooldown.7.name',
	'data.runningDays.recoveryB.cooldown.7.reps',
];

// Companion placeholder table — only keys whose value carries {placeholders}
// need an entry; everything else implicitly expects none.
const STRINGS_PLACEHOLDERS = {
	'ui.docTitleWith': ['page'],
	'ui.entry.runningSat': ['variation'],
	'ui.entry.runningSun': ['variation'],
	'ui.swap.following': ['day'],
	'ui.backup.lastBackup': ['date'],
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
