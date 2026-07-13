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

	// Section completion ticks
	const groups = {};
	for (const item of allItems) {
		(groups[item.section] = groups[item.section] || []).push(item);
	}
	for (const [sec, items] of Object.entries(groups)) {
		const chk = document.querySelector(`[data-sec="${sec}"] .sec-check`);
		if (chk)
			chk.style.display = items.every((i) => completedItems.has(i.id))
				? ''
				: 'none';
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
	const title = isProgramEnd ? 'Program Complete!' : 'Workout Complete!';
	const sub = isProgramEnd
		? `You finished the full ${PROGRAM_LABEL} program. Outstanding work.`
		: 'Great session. Hydrate and rest well.';
	return `<div id="done-banner" class="done-banner">
      <div class="done-emoji">🎉</div>
      <div class="done-title">${title}</div>
      <div class="done-sub">${sub}</div>
    </div>`;
}

function itemCardHTML(item, activeId) {
	const isDone = completedItems.has(item.id);
	const isActive = !isDone && item.id === activeId;
	const cls = isDone ? 'done' : isActive ? 'active' : 'upcoming';

	// With a scheme the numerals live in the right-aligned block, so the meta
	// remainder (weight, qualifiers) folds into the note line. Without one the
	// meta text keeps its own colored line, as before.
	const noteBits = [];
	if (item.scheme && item.meta) noteBits.push(item.meta);
	if (item.note) noteBits.push(item.note);
	if (item.cap) noteBits.push(`Cap <span class="cap-value">${item.cap}</span>`);
	if (item.warn) noteBits.push(`<span class="item-warn">⚠ ${item.warn}</span>`);
	const metaHTML =
		!item.scheme && item.meta ? `<div class="item-meta">${item.meta}</div>` : '';
	const noteHTML = noteBits.length
		? `<div class="item-note">${noteBits.join(' · ')}</div>`
		: '';
	const schemeHTML = item.scheme
		? item.scheme.unit
			? `<div class="scheme scheme-timed"><div class="scheme-n">${item.scheme.n}</div><div class="scheme-unit">${item.scheme.unit}</div></div>`
			: `<div class="scheme">${item.scheme.n}<span class="scheme-x">×</span>${item.scheme.x}<div class="scheme-label">sets × reps</div></div>`
		: '';

	return `<div class="item-card ${cls}" data-id="${item.id}" role="checkbox" aria-checked="${isDone}" tabindex="0" onclick="toggleItem('${item.id}')">
    <div class="item-indicator"></div>
    <div class="item-body">
      <div class="item-name">${item.label}</div>
      ${metaHTML}
      ${noteHTML}
    </div>
    ${schemeHTML}
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
		const allDone = sec.items.every((i) => completedItems.has(i.id));
		html += `<div class="section-label" data-sec="${sec.key}">${SECTION_NAMES[sec.key] || sec.key}<span class="sec-check" style="${allDone ? '' : 'display:none'}"> ✓</span></div>`;
		html += sec.items.map((item) => itemCardHTML(item, activeId)).join('');
	}

	if (workout.exercises) {
		html += `<div class="section-label">Principles</div>
      <div class="principles-card">
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
	// Front/Back parity describes the borrowed workout's home week, so it keeps
	// using effectiveKey — that segment is already correct.
	const mid =
		entry.type === 'running'
			? 'Saturday'
			: entry.type === 'recovery'
				? 'Sunday'
				: getWeekType(entry.type, effectiveKey);
	return `${wk} · ${mid} · Var ${entry.variation}`;
}

// Week strip: Mon–Sun of the current calendar week as colored bars — the
// schedule's rotation made visible. Each day's bar takes its day-group hue;
// dates outside the program fall back to var(--border). Monday is computed
// the same local-time way weekNumber() does.
function weekStripHTML(key) {
	const [y, m, d] = key.split('-').map(Number);
	const dow = new Date(y, m - 1, d).getDay();
	const toMon = dow === 0 ? -6 : 1 - dow;
	const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	let html = '<div class="week-strip">';
	for (let i = 0; i < 7; i++) {
		const dt = new Date(y, m - 1, d + toMon + i);
		const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
		const entry = SCHEDULE[k];
		const hue = entry ? `var(--h-${dayGroup(entry)})` : 'var(--border)';
		const when = k === key ? 'today' : k < key ? 'past' : 'future';
		html += `<div class="ws-day ${when}"><div class="ws-bar" style="background:${hue}"></div><div class="ws-letter">${letters[i]}</div></div>`;
	}
	return html + '</div>';
}

// Shared header eyebrow row: program position left, short date + swap right.
function eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML) {
	return `<div class="eyebrow-row">
        <div class="eyebrow">${eyebrowLabel(entry, key, effectiveKey)}</div>
        <div class="eyebrow-right">
          <span class="eyebrow-date">${shortDayLabel(key)}</span>
          ${swapBtnHTML}
        </div>
      </div>`;
}

// When storage isn't persisting, prepend a persistent warning to the (sticky)
// header so it stays visible. Injected via the DOM only when storage is failing,
// so the normal-path markup is untouched when storage works.
function insertStorageWarning() {
	document
		.querySelector('header')
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
	document
		.querySelector('header')
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
		? `<div class="swap-banner">Following ${shortDayLabel(borrowedFrom)}'s workout <button onclick="undoBorrow()">Undo</button></div>`
		: '';
	const swapBtnHTML = `<button class="header-action" onclick="openSwapSheet()" title="Follow a different day">⇄</button>`;
	const notice = programNotice(key);
	const noticeHTML = notice
		? `<div class="program-notice">${notice}</div>`
		: '';

	if (!entry) {
		app.innerHTML = `
      <header>
        ${eyebrowRowHTML(entry, effectiveKey, key, '')}
        <div class="workout-title">No workout today</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
      </header>
      <div class="content">
        <div class="no-schedule">
          <div style="font-size:48px">📅</div>
          <div style="margin-top:12px">This date is outside the current program (${PROGRAM_LABEL}).</div>
        </div>
      </div>`;
		if (!storageOK) insertStorageWarning();
		return;
	}

	if (entry.type === 'rest') {
		app.innerHTML = `
      <header>
        ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
        <div class="workout-title">Rest Day</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
      </header>
      <div class="content">
        <div class="rest-card" style="margin-top:16px">
          <div class="rest-emoji">😴</div>
          <div class="rest-title">Rest & Recover</div>
          <div class="rest-subtitle">Sleep well. Let the muscles rebuild.</div>
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
        ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
        <div class="workout-title">Couldn't load workout</div>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
      </header>
      <div class="content">
        <div class="no-schedule">
          <div style="font-size:48px">⚠️</div>
          <div style="margin-top:12px">This day's workout couldn't be loaded (<code>${entry.type} · Var ${entry.variation || '?'}</code>). Check js/data.js.</div>
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
      ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
      <div class="workout-title">${workout.title}</div>
      ${weekStripHTML(key)}
      ${swapBannerHTML}
      ${noticeHTML}
      <div class="progress-row">
        <div class="segs" id="pbar-segs">${segsHTML}</div>
        <div class="progress-text" id="pbar-txt">${done} / ${total}</div>
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
