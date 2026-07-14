/*
 * ui.js — Everything that touches the DOM.
 *
 * This is the only file that reads/writes the page. It builds HTML strings
 * from the data + domain logic in the other files, and wires up the click
 * handlers. The functions called from inline onclick="" attributes
 * (toggleItem, resetProgress, openSwapSheet, closeSwapSheet, doBorrow,
 * undoBorrow) are declared here with the `function` keyword so they live on
 * the global scope where the HTML can reach them.
 */

// ─── Keyboard support ─────────────────────────────────────────────────────────
// Item cards are role="checkbox" divs (see itemCardHTML). One delegated
// listener toggles the focused card on Space/Enter — delegation survives every
// innerHTML re-render, and routing through toggleItem keeps keyboard and tap
// behaviour identical. preventDefault stops Space from scrolling the page.
document.addEventListener('keydown', (e) => {
	if (e.key !== ' ' && e.key !== 'Enter') return;
	const card = e.target.closest('.item-card[data-id]');
	if (!card) return;
	e.preventDefault();
	toggleItem(card.dataset.id);
});

// ─── Day borrow UI ───────────────────────────────────────────────────────────
// A short label for a schedule entry, shown in the swap sheet rows.
function entryLabel(entry) {
	if (!entry) return 'Outside schedule';
	if (entry.type === 'rest') return 'Rest Day';
	if (entry.type === 'running')
		return `Running · Sat · Var ${entry.variation || '?'}`;
	if (entry.type === 'recovery')
		return `Running · Sun · Var ${entry.variation || '?'}`;
	const w = WORKOUTS[entry.type]?.[entry.variation];
	return w ? `${w.title} · Var ${entry.variation}` : entry.type;
}

// Build and show the bottom sheet listing the next 7 scheduled days.
function openSwapSheet() {
	// If the day rolled over while the screen was stale, refresh the header
	// behind the sheet so the whole flow shares one clock.
	if (cachedDayKey !== todayKey()) render();
	let rows = '';
	const base = todayKey();
	const [y, m, d] = base.split('-').map(Number);
	for (let i = 1; i <= 7; i++) {
		const dt = new Date(y, m - 1, d + i);
		const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
		if (!SCHEDULE[k]) continue;
		rows += `<div class="swap-option" onclick="doBorrow('${k}')">
      <div>
        <div class="swap-option-day">${shortDayLabel(k)}</div>
        <div class="swap-option-label">${entryLabel(SCHEDULE[k])}</div>
      </div>
      <div class="swap-option-arrow">›</div>
    </div>`;
	}
	if (!rows)
		rows = `<div style="padding:24px;text-align:center;color:var(--text2)">No upcoming days in schedule</div>`;
	document.getElementById('swap-options').innerHTML = rows;
	document.getElementById('swap-sheet-overlay').style.display = 'flex';
}
function closeSwapSheet() {
	document.getElementById('swap-sheet-overlay').style.display = 'none';
}
// Record that "today" should follow targetKey's workout, then re-render.
function doBorrow(targetKey) {
	const tk = todayKey();
	// Skip a provable no-op: if the target's workout is identical to today's
	// own (same type + variation), it collapses onto today's own storage key,
	// so a borrow entry would only make the banner assert a distinction the
	// storage layer doesn't have. Close the sheet and change nothing.
	const own = SCHEDULE[tk];
	const target = SCHEDULE[targetKey];
	if (own && target && stateKey(tk, own) === stateKey(tk, target)) {
		closeSwapSheet();
		return;
	}
	const b = loadBorrows();
	b[tk] = targetKey;
	saveBorrows(b);
	closeSwapSheet();
	render();
}
function undoBorrow() {
	const b = loadBorrows();
	delete b[todayKey()];
	saveBorrows(b);
	render();
}

// ─── Toggling / progress ─────────────────────────────────────────────────────
// Tick or untick an item, then recompute which item is "active" (the first
// not-yet-done one) and repaint just the card classes — no full re-render.
function toggleItem(id) {
	const wasOK = storageOK;
	// Read-modify-write (storage.js): merge with what's currently in storage so a
	// concurrent tab's ticks are not clobbered by our in-memory set. Falls back
	// to a plain in-memory toggle when storage is broken.
	toggleAndSave(cachedKey, id);

	// If this tap is the one that revealed storage is failing, re-render so the
	// warning banner appears mid-session. render() reloads completedItems from
	// the (now stale) stored copy, so keep the live in-memory set and restore it
	// afterward — the tick stays ticked; only its persistence is lost.
	if (wasOK && !storageOK) {
		const live = completedItems;
		render();
		completedItems = live;
	}

	// Recompute which item is active
	const activeId = allItems.find((i) => !completedItems.has(i.id))?.id;

	for (const item of allItems) {
		const el = document.querySelector(`[data-id="${item.id}"]`);
		if (!el) continue;
		if (completedItems.has(item.id)) el.className = 'item-card done';
		else if (item.id === activeId) el.className = 'item-card active';
		else el.className = 'item-card upcoming';
		el.setAttribute('aria-checked', completedItems.has(item.id));
	}

	updateProgress(activeId);

	// Scroll new active into view if off-screen
	setTimeout(() => {
		const el = document.querySelector('.item-card.active');
		if (el) {
			const r = el.getBoundingClientRect();
			if (r.bottom > window.innerHeight - 20 || r.top < 70)
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, 80);
}

function updateProgress(activeId) {
	const done = allItems.filter((i) => completedItems.has(i.id)).length;
	const total = allItems.length;

	const segs = document.querySelectorAll('#pbar-segs .seg');
	allItems.forEach((item, i) => {
		if (segs[i]) segs[i].classList.toggle('on', completedItems.has(item.id));
	});
	const txt = document.getElementById('pbar-txt');
	if (txt) txt.textContent = `${done} / ${total}`;

	// Section completion ticks + live d/total counts (rewritten on every toggle,
	// and on resetProgress which routes back through here with an empty set).
	const groups = {};
	for (const item of allItems) {
		(groups[item.section] = groups[item.section] || []).push(item);
	}
	for (const [sec, items] of Object.entries(groups)) {
		const secDone = items.filter((i) => completedItems.has(i.id)).length;
		const chk = document.querySelector(`[data-sec="${sec}"] .sec-check-wrap`);
		if (chk) chk.style.display = secDone === items.length ? '' : 'none';
		const cnt = document.querySelector(`[data-sec-count="${sec}"]`);
		if (cnt) cnt.textContent = `${secDone}/${items.length}`;
	}

	// Completion banner — derived from state, synced in both directions so a
	// corrected mis-tap (untick after completing) removes it on the same tap.
	if (done === total && total > 0) {
		if (!document.getElementById('done-banner')) {
			const content = document.getElementById('wcontent');
			if (content) {
				content.insertAdjacentHTML('afterbegin', doneBannerHTML());
				// Only a live completion scrolls the fresh banner into view.
				document
					.getElementById('done-banner')
					?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	} else {
		document.getElementById('done-banner')?.remove();
	}
}

function resetProgress() {
	completedItems = new Set();
	saveState(cachedKey);
	const activeId = allItems[0]?.id;
	for (const item of allItems) {
		const el = document.querySelector(`[data-id="${item.id}"]`);
		if (el) {
			el.className =
				'item-card ' + (item.id === activeId ? 'active' : 'upcoming');
			el.setAttribute('aria-checked', 'false');
		}
	}
	updateProgress(activeId);
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── HTML builders ───────────────────────────────────────────────────────────
function doneBannerHTML() {
	const isProgramEnd = cachedDayKey === PROGRAM_END;
	const title = isProgramEnd ? 'Program Complete!' : 'Workout complete';
	const sub = isProgramEnd
		? `You finished the full ${PROGRAM_LABEL} program. Outstanding work.`
		: 'Great session. Hydrate and rest well.';
	return `<div id="done-banner" class="done-banner">
      <svg class="done-check" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      <div class="done-title">${title}</div>
      <div class="done-sub">${sub}</div>
    </div>`;
}

// Modernist row iconography. The indicator carries BOTH the done-check and the
// active-play SVG at all times; CSS shows exactly one (or neither, for upcoming)
// per state class. Keeping them in the DOM lets toggleItem/reset repaint by
// swapping the row's className alone — no innerHTML re-render, so focus survives
// a keyboard toggle. Colours come from currentColor (the indicator is bg-tinted).
const IND_CHECK =
	'<svg class="ind-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const IND_PLAY =
	'<svg class="ind-play" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const WARN_SVG =
	'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
// Accent check shown when every item in a section is done. Kept in the DOM and
// toggled via display by updateProgress so a tick/untick needs no re-render.
const SEC_CHECK =
	'<svg class="sec-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="3" stroke-linecap="square" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function itemCardHTML(item, activeId) {
	const isDone = completedItems.has(item.id);
	const isActive = !isDone && item.id === activeId;
	const cls = isDone ? 'done' : isActive ? 'active' : 'upcoming';

	// A label may carry an inline "⭐ FIRST" priority flag (data.js). Strip it
	// (and any stray leading emoji) from the visible name and render it as a
	// bordered badge instead — the star glyph never reaches the DOM.
	const raw = item.label || '';
	const hasFirst = raw.includes('⭐ FIRST');
	const label = raw.replace('🍌 ', '').replace('⭐ FIRST', '').trim();
	const firstHTML = hasFirst ? '<span class="item-first">FIRST</span>' : '';

	// sub (weight/qualifier), note, cap and warn each stack as their own line
	// under the name. sub sits at full opacity on upcoming rows — the retired
	// day-hue meta line is gone.
	let stack = '';
	if (item.sub) stack += `<div class="item-sub">${item.sub}</div>`;
	if (item.note) stack += `<div class="item-note">${item.note}</div>`;
	if (item.cap) stack += `<div class="item-cap">Cap · ${item.cap}</div>`;
	if (item.warn)
		stack += `<div class="item-warn">${WARN_SVG}<span>${item.warn}</span></div>`;

	// Split numerals (sets × reps). The SETS × REPS microlabel is always in the
	// DOM but hidden by CSS unless the row is active.
	const hasScheme = item.sets != null && item.reps != null;
	const numHTML = hasScheme
		? `<div class="item-num">
        <div class="item-num-val">${item.sets}<span class="item-num-x">×</span>${item.reps}</div>
        <div class="item-num-label">SETS × REPS</div>
      </div>`
		: '';

	return `<div class="item-card ${cls}" data-id="${item.id}" role="checkbox" aria-checked="${isDone}" tabindex="0" onclick="toggleItem('${item.id}')">
    <div class="item-indicator">${IND_CHECK}${IND_PLAY}</div>
    <div class="item-body">
      <div class="item-namerow"><span class="item-name">${label}</span>${firstHTML}</div>
      ${stack}
    </div>
    ${numHTML}
  </div>`;
}

function workoutContentHTML(workout) {
	const activeId = allItems.find((i) => !completedItems.has(i.id))?.id;

	// Group into sections while preserving order
	const sections = [];
	let cur = null;
	for (const item of allItems) {
		if (!cur || cur.key !== item.section) {
			cur = { key: item.section, items: [] };
			sections.push(cur);
		}
		cur.items.push(item);
	}

	let html = '';
	for (const sec of sections) {
		const done = sec.items.filter((i) => completedItems.has(i.id)).length;
		const allDone = done === sec.items.length;
		html += `<div class="section-label" data-sec="${sec.key}">
      <span class="section-name">${SECTION_NAMES[sec.key] || sec.key}</span>
      <span class="sec-check-wrap" style="${allDone ? '' : 'display:none'}">${SEC_CHECK}</span>
      <span class="sec-count" data-sec-count="${sec.key}">${done}/${sec.items.length}</span>
    </div>`;
		html += sec.items.map((item) => itemCardHTML(item, activeId)).join('');
	}

	if (workout.exercises) {
		html += `<div class="section-label"><span class="section-name">Principles</span></div>
      <div class="principles">
        <div class="principle">Increase weight before reps — add 2.5kg when 12 reps feels easy</div>
        <div class="principle">Rest 60–90s isolation · 2 min compounds</div>
        ${workout.hasCore ? '<div class="principle">Side lateral raises non-negotiable — form over weight, always</div>' : ''}
        <div class="principle">Hanging raises: no twisting variants — oblique growth widens waist</div>
        <div class="principle">No shrugs · no weighted side bends · no heavy deadlifts</div>
      </div>`;
	}
	html += `<div style="text-align:center;padding:24px 0 40px">
      <button onclick="resetProgress()" style="background:none;border:none;color:var(--text2);font-size:12px;cursor:pointer;padding:8px 20px;opacity:0.55">Reset progress</button>
    </div>`;

	return html;
}

// ─── Render ─────────────────────────────────────────────────────────────────
// The single entry point that paints the whole screen for "today".
// Map a schedule entry's type to its day-hue group (html[data-day="…"] in CSS).
function dayGroup(entry) {
	if (!entry) return 'rest'; // outside-schedule dates fall back to rest
	const t = entry.type;
	if (t === 'legs-quads' || t === 'legs-hamstrings') return 'legs';
	if (t === 'arms-biceps' || t === 'arms-triceps') return 'arms';
	if (t === 'running') return 'run';
	return t; // back, chest, shoulders, recovery, rest
}

// Program-position eyebrow text, e.g. "Week 9 / 26 · Back Week · Var A".
// CSS uppercases it. Running/recovery show the weekday instead of the week
// type; rest days omit the Var part; outside-schedule dates show week only.
function eyebrowLabel(entry, realKey, effectiveKey) {
	// Week fragment reflects the REAL calendar position (realKey) so the header
	// never disagrees with the week strip below it, never grows past the program
	// (Outside program), and never reads week zero on day one (Opening Weekend).
	const n = weekNumber(realKey);
	const wk =
		!entry || n > TOTAL_WEEKS || n < 0
			? 'Outside program'
			: n === 0
				? 'Opening Weekend'
				: `Week ${n} / ${TOTAL_WEEKS}`;
	if (!entry) return wk;
	if (entry.type === 'rest') return `${wk} · Rest Day`;
	// Single owner for the middle segment: getWeekType produces Front/Back Week
	// for gym days and 'Sat · 9→4' / 'Sun · 9→4' for running/recovery — no more
	// duplicate 'Saturday'/'Sunday' literals here (#65). Front/Back parity
	// describes the borrowed workout's home week, so it uses effectiveKey.
	const mid = getWeekType(entry.type, effectiveKey);
	return `${wk} · ${mid} · Var ${entry.variation}`;
}

// Human-readable workout-type names for the week strip's a11y labels. The
// bars are position-based (today/past/future) and no longer encode type, so
// this map re-exposes the type in a non-color channel (screen readers).
const WS_GROUP_NAME = {
	rest: 'Rest',
	legs: 'Legs',
	back: 'Back',
	chest: 'Chest',
	arms: 'Arms',
	shoulders: 'Shoulders',
	run: 'Run',
	recovery: 'Recovery',
};
const WS_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Week strip: Mon–Sun of the current calendar week as position-based bars —
// today = accent, past = ink, future = neutral. Bars no longer encode workout
// type (the day-hue system is retired); the type survives only in each day's
// aria-label. Monday is computed the same local-time way weekNumber() does.
function weekStripHTML(key) {
	const [y, m, d] = key.split('-').map(Number);
	const dow = new Date(y, m - 1, d).getDay();
	const toMon = dow === 0 ? -6 : 1 - dow;
	const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	let html = '<div class="week-strip" role="group" aria-label="This week">';
	for (let i = 0; i < 7; i++) {
		const dt = new Date(y, m - 1, d + toMon + i);
		const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
		const entry = SCHEDULE[k];
		const when = k === key ? 'today' : k < key ? 'past' : 'future';
		const typeName = WS_GROUP_NAME[dayGroup(entry)];
		const label = `${WS_DAY_NAMES[i]}: ${typeName}${when === 'today' ? ', today' : ''}`;
		html += `<div class="ws-day ${when}" role="img" aria-label="${label}"><div class="ws-bar"></div><div class="ws-letter" aria-hidden="true">${letters[i]}</div></div>`;
	}
	return html + '</div>';
}

// Shared Modernist kicker row: program-position kicker text left, uppercase
// date + square swap button right (#65). CSS uppercases the date.
function eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML) {
	return `<div class="kicker-row">
        <div class="kicker">${eyebrowLabel(entry, key, effectiveKey)}</div>
        <div class="kicker-meta">
          <span class="kicker-date">${shortDayLabel(key)}</span>
          ${swapBtnHTML}
        </div>
      </div>`;
}

// When storage isn't persisting, prepend a persistent warning to the (sticky)
// header so it stays visible. Injected via the DOM only when storage is failing,
// so the normal-path markup is untouched when storage works.
function insertStorageWarning() {
	// Prepend inside the 480px header rail so the warning aligns with the kicker
	// row rather than spanning the full-bleed header background (#65).
	(document.querySelector('.header-inner') || document.querySelector('header'))
		?.insertAdjacentHTML(
			'afterbegin',
			`<div class="storage-warning">⚠ Progress can't be saved on this device — ticks will be lost when you close the app.</div>`
		);
}

// The stored item count no longer matched the current workout definition (an
// exercise was added/removed in data.js). loadState has already dropped any
// now-unknown ids and set `definitionChanged`; this surfaces a one-line notice
// via the same header plumbing as the storage warning.
function insertDefinitionNotice() {
	(document.querySelector('.header-inner') || document.querySelector('header'))
		?.insertAdjacentHTML(
			'afterbegin',
			`<div class="storage-warning">⚠ Workout definition changed — progress re-checked.</div>`
		);
}

// Called once on load (main.js) and again after any state change (toggle/borrow).
function render() {
	const key = todayKey();
	cachedDayKey = key; // track the plain date on every path for the midnight check
	const borrows = loadBorrows();
	// Self-heal a stale borrow: if the stored target is no longer a SCHEDULE
	// key (a schedule edit removed/renamed the date, or a device-clock jump),
	// drop the dangling entry and fall back to the real day rather than
	// rendering the un-undoable outside-program lock-out screen.
	let borrowedFrom = borrows[key] || null;
	if (borrowedFrom && !SCHEDULE[borrowedFrom]) {
		delete borrows[key];
		saveBorrows(borrows);
		borrowedFrom = null;
	}
	const effectiveKey = borrowedFrom || key;
	const entry = SCHEDULE[effectiveKey];
	// Tint the whole UI with the effective (borrowed) day's hue.
	document.documentElement.dataset.day = dayGroup(entry);
	const app = document.getElementById('app');
	const swapBannerHTML = borrowedFrom
		? `<div class="swap-banner"><span class="swap-banner-text">Following ${shortDayLabel(borrowedFrom)}'s workout</span><button class="swap-banner-undo" onclick="undoBorrow()">Undo</button></div>`
		: '';
	// Square Modernist swap button with an inline arrows glyph (#65). The button
	// name comes from aria-label, not the glyph, so AT announces the action.
	const swapBtnHTML = `<button class="swap-btn" onclick="openSwapSheet()" aria-label="Follow a different day's workout"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg></button>`;
	const notice = programNotice(key);
	const noticeHTML = notice
		? `<div class="program-notice">${notice}</div>`
		: '';

	if (!entry) {
		app.innerHTML = `
      <header>
       <div class="header-inner">
        ${eyebrowRowHTML(entry, effectiveKey, key, '')}
        <div class="workout-title">No workout today</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <div class="content">
        <div class="poster poster-ink">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="1"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m14 15 4 4"/><path d="m18 15-4 4"/></svg>
          <div class="poster-title">No workout today</div>
          <div class="poster-sub">This date is outside the current program (${PROGRAM_LABEL}).</div>
        </div>
      </div>`;
		if (!storageOK) insertStorageWarning();
		return;
	}

	if (entry.type === 'rest') {
		app.innerHTML = `
      <header>
       <div class="header-inner">
        ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
        <div class="workout-title">Rest Day</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <div class="content">
        <div class="poster poster-accent">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          <div class="poster-title">Rest &amp; Recover</div>
          <div class="poster-sub">Sleep well. Let the muscles rebuild.</div>
        </div>
      </div>`;
		if (!storageOK) insertStorageWarning();
		return;
	}

	// Gym day or running day — both share the same interactive checklist path.
	const workout = (WORKOUTS[entry.type] || RUNNING_DAYS[entry.type])?.[
		entry.variation
	];
	if (!workout) {
		// A SCHEDULE entry that doesn't resolve to a workout (e.g. a data.js
		// typo). Paint a visible error instead of a blank/stale screen, and DON'T
		// leave cachedDayKey marked as today's key — otherwise refreshIfDayChanged
		// would treat the failed paint as a successful render and never retry.
		cachedDayKey = null;
		app.innerHTML = `
      <header>
       <div class="header-inner">
        ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
        <div class="workout-title">Couldn't load workout</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <div class="content">
        <div class="poster poster-ink">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          <div class="poster-title">Couldn't load workout</div>
          <div class="poster-sub">This day's workout couldn't be loaded (<code>${entry.type} · Var ${entry.variation || '?'}</code>). Check js/data.js.</div>
        </div>
      </div>`;
		if (!storageOK) insertStorageWarning();
		return;
	}

	// Build item list and load persisted state. The key encodes the workout
	// identity (via the effective entry) so a borrowed day's ticks stay separate.
	cachedKey = stateKey(key, entry);
	allItems = buildItemList(workout);
	completedItems = loadState(cachedKey);

	const done = allItems.filter((i) => completedItems.has(i.id)).length;
	const total = allItems.length;
	const segsHTML = allItems
		.map((i) => `<div class="seg${completedItems.has(i.id) ? ' on' : ''}"></div>`)
		.join('');

	app.innerHTML = `
    <header>
     <div class="header-inner">
      ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
      <div class="workout-title">${workout.title}</div>
      ${weekStripHTML(key)}
      ${swapBannerHTML}
      ${noticeHTML}
      <div class="progress-row">
        <div class="segs" id="pbar-segs">${segsHTML}</div>
        <div class="progress-text" id="pbar-txt">${done} / ${total}</div>
      </div>
      <div class="header-rule"></div>
     </div>
    </header>
    <div id="wcontent" class="content">
      ${workoutContentHTML(workout)}
    </div>`;

	// Derive the completion banner from state on this paint. A reloaded/finished
	// day (reload, borrow/undo, midnight-refresh) shows it with no scroll jump.
	if (done === total && total > 0) {
		document
			.getElementById('wcontent')
			?.insertAdjacentHTML('afterbegin', doneBannerHTML());
	}

	if (!storageOK) insertStorageWarning();
	// loadState (line above) sets definitionChanged when the stored item count no
	// longer matches this workout — tell the user their progress was re-checked.
	if (definitionChanged) insertDefinitionNotice();

	// Expose the (possibly banner-inflated) sticky-header height so cards and the
	// done-banner can offset scrollIntoView by it via `scroll-margin-top` and not
	// tuck under the opaque sticky header (issue #46).
	const headerH = document.querySelector('header')?.offsetHeight;
	if (headerH) {
		document.documentElement.style.setProperty('--header-h', headerH + 'px');
	}
}
