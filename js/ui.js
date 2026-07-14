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

// ─── Motion preference ────────────────────────────────────────────────────────
// An explicit `behavior:'smooth'` bypasses any CSS-level reduced-motion rule, so
// the JS-driven scrolls MUST be guarded in code: fall back to an instant jump
// when the OS "Reduce Motion" setting is on (#79). Evaluated per-call so a
// mid-session preference change is honoured.
const scrollBehavior = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches
		? 'auto'
		: 'smooth';

// ─── Keyboard support ─────────────────────────────────────────────────────────
// Item cards are role="checkbox" divs (see itemCardHTML). One delegated
// listener toggles the focused card on Space/Enter — delegation survives every
// innerHTML re-render, and routing through toggleItem keeps keyboard and tap
// behaviour identical. preventDefault stops Space from scrolling the page.
document.addEventListener('keydown', (e) => {
	if (e.key !== ' ' && e.key !== 'Enter') return;
	// The active row's Log chip is a real <button> nested in the checkbox row.
	// Its own Space/Enter activation opens the log sheet — do NOT also toggle the
	// row's tick, or the chip would tick the exercise as a side effect (#86).
	if (e.target.closest('.log-chip')) return;
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
		return `Running · Sat · Var ${entry.variation || 'TBC'}`;
	if (entry.type === 'recovery')
		return `Running · Sun · Var ${entry.variation || 'TBC'}`;
	const w = WORKOUTS[entry.type]?.[entry.variation];
	return w ? `${w.title} · Var ${entry.variation}` : entry.type;
}

// The element focus should return to when the sheet closes (the ⇄ button).
let sheetReturnFocus = null;

// Build and show the bottom sheet listing the next 7 scheduled days.
function openSwapSheet() {
	// Remember where focus was so we can restore it on close (WCAG 2.4.3).
	sheetReturnFocus = document.activeElement;
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
		rows += `<button type="button" class="swap-option" onclick="doBorrow('${k}')">
      <span class="swap-option-text">
        <span class="swap-option-day">${shortDayLabel(k)}</span>
        <span class="swap-option-label">${entryLabel(SCHEDULE[k])}</span>
      </span>
      <svg class="swap-option-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" stroke-width="2.2" stroke-linecap="square" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>`;
	}
	if (!rows)
		rows = `<div class="swap-empty">No upcoming days in schedule</div>`;
	document.getElementById('swap-options').innerHTML = rows;
	document.getElementById('swap-sheet-overlay').style.display = 'flex';
	// Move focus into the dialog: the first option, or the close button when
	// the schedule is empty and there are no options to focus.
	const firstOption = document.querySelector('#swap-options .swap-option');
	(firstOption ||
		document.querySelector('#swap-sheet-overlay .sheet-close'))?.focus();
}
function closeSwapSheet() {
	document.getElementById('swap-sheet-overlay').style.display = 'none';
	// Return focus to whatever opened the sheet (the ⇄ swap button).
	sheetReturnFocus?.focus?.();
	sheetReturnFocus = null;
}

// ─── Bottom-sheet dialog keyboard handling ─────────────────────────────────────
// A modal dialog must contain focus while open (WCAG 2.1.1/2.4.3): Escape
// dismisses it, and Tab/Shift+Tab wrap between the first and last focusable
// controls inside the sheet so nothing behind the scrim is reachable. Shared by
// both bottom sheets (swap #74, log #86) — same contract, one implementation.
function handleSheetKeydown(overlayId, closeFn, e) {
	const overlay = document.getElementById(overlayId);
	if (!overlay || overlay.style.display === 'none') return;
	if (e.key === 'Escape') {
		e.preventDefault();
		closeFn();
		return;
	}
	if (e.key !== 'Tab') return;
	const focusable = overlay.querySelectorAll('button, [href], [tabindex]');
	if (!focusable.length) return;
	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (e.shiftKey && document.activeElement === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && document.activeElement === last) {
		e.preventDefault();
		first.focus();
	} else if (!overlay.contains(document.activeElement)) {
		// Focus escaped the dialog (e.g. was on a background control) — pull it
		// back in on the next Tab.
		e.preventDefault();
		first.focus();
	}
}
document.addEventListener('keydown', (e) =>
	handleSheetKeydown('swap-sheet-overlay', closeSwapSheet, e),
);
document.addEventListener('keydown', (e) =>
	handleSheetKeydown('log-sheet-overlay', closeLogSheet, e),
);
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
	// render() rebuilds #app wholesale, so announce via the persistent sibling
	// live region (issue #77). One polite message per borrow.
	announce(`Following ${shortDayLabel(targetKey)}'s workout`);
}
function undoBorrow() {
	const b = loadBorrows();
	delete b[todayKey()];
	saveBorrows(b);
	render();
	announce("Back to today's workout");
}

// Write to the persistent polite live region (#sr-status, a sibling of #app in
// index.html). Only doBorrow/undoBorrow use it — progress and completion are
// announced by their own role="status" elements (issue #77).
function announce(msg) {
	const region = document.getElementById('sr-status');
	if (region) region.textContent = msg;
}

// ─── Per-exercise log capture sheet (#86) ──────────────────────────────────────
// A bottom sheet (the swap-sheet Modernist frame, second overlay in index.html)
// that captures weight / reps / felt-easy for the active exercise and appends it
// to the `exlog` store (storage.js), keyed by exercise NAME. It's a real dialog:
// focus moves in on open, is trapped (handleSheetKeydown), Escape closes, and
// focus returns to the Log chip that opened it (#74 pattern).
let logReturnFocus = null; // the Log chip to restore focus to on close
let logName = null; // exlog key for the sheet currently open
let logPlanned = null; // planned reps of the open item — drives the progression hint (#88)
let logW = null; // working weight (kg) — null = blank
let logR = null; // working reps — null = blank
let logEasy = false; // felt-easy toggle state

// Render a working numeral: null shows an em-dash placeholder, not "0".
function fmtNum(v) {
	return v == null ? '—' : String(v);
}

// Build the sheet body: two steppers (weight ±2.5/±0.5, reps ±1), a felt-easy
// toggle, one Save button, and this exercise's last 3 entries. Rebuilt on open
// (and after a save) so the history always reflects the store.
function logBodyHTML() {
	const entries = exlogEntries(logName).slice(-3).reverse(); // newest first
	const hist = entries.length
		? entries
				.map(
					(e) => `<div class="log-hist-row">
        <span class="log-hist-date">${shortDayLabel(e.d)}</span>
        <span class="log-hist-val">${fmtNum(e.w)}<span class="log-hist-x">×</span>${fmtNum(e.r)}</span>
        ${e.e ? '<span class="log-hist-easy">Easy</span>' : ''}
      </div>`,
				)
				.join('')
		: '<div class="log-hist-empty">No entries logged yet</div>';
	// Progression hint (#88): the same rule the active row shows, echoed at the
	// top of the sheet so the "is today the day to add 2.5kg?" answer sits right
	// where the user dials the weight in. Empty string when there's no suggestion.
	const sug = itemSuggestion(logName, logPlanned);
	const hintHTML = !sug
		? ''
		: sug.hold
			? '<div class="log-hint log-hint-hold">At cap — hold</div>'
			: `<div class="log-hint">Try ${fmtNum(sug.weight)}kg — ${fmtNum(sug.from)}<span class="log-hist-x">×</span>${fmtNum(sug.reps)} felt easy${sug.cap != null ? ` · cap ${fmtNum(sug.cap)}kg` : ''}</div>`;
	return `<div class="log-body-inner">
      ${hintHTML}
      <div class="log-field">
        <div class="log-field-label">Weight · kg</div>
        <div class="log-stepper">
          <button type="button" class="log-step" onclick="stepLog('w',-2.5)" aria-label="Weight minus 2.5">−2.5</button>
          <button type="button" class="log-step log-step-fine" onclick="stepLog('w',-0.5)" aria-label="Weight minus 0.5">−0.5</button>
          <output class="log-value" id="log-w" aria-live="polite">${fmtNum(logW)}</output>
          <button type="button" class="log-step log-step-fine" onclick="stepLog('w',0.5)" aria-label="Weight plus 0.5">+0.5</button>
          <button type="button" class="log-step" onclick="stepLog('w',2.5)" aria-label="Weight plus 2.5">+2.5</button>
        </div>
      </div>
      <div class="log-field">
        <div class="log-field-label">Reps</div>
        <div class="log-stepper">
          <button type="button" class="log-step" onclick="stepLog('r',-1)" aria-label="Reps minus 1">−1</button>
          <output class="log-value" id="log-r" aria-live="polite">${fmtNum(logR)}</output>
          <button type="button" class="log-step" onclick="stepLog('r',1)" aria-label="Reps plus 1">+1</button>
        </div>
      </div>
      <button type="button" class="log-toggle" id="log-easy" aria-pressed="${logEasy}" onclick="toggleEasy()">
        <span class="log-toggle-box" aria-hidden="true">${IND_CHECK}</span>
        <span class="log-toggle-label">Felt easy — ready to add weight</span>
      </button>
      <button type="button" class="log-save" onclick="saveLog()">Save</button>
      <div class="log-error" id="log-error" role="alert"></div>
      <div class="log-hist">
        <div class="log-hist-head">Last 3</div>
        ${hist}
      </div>
    </div>`;
}

// Open the capture sheet for the item with this id (called from its Log chip).
function openLogSheet(id) {
	const item = allItems.find((i) => i.id === id);
	if (!item) return;
	// Remember the chip so focus returns to it on close (WCAG 2.4.3).
	logReturnFocus = document.activeElement;
	logName = exerciseName(item);
	logPlanned = item.reps; // planned reps drive the progression hint (#88)
	// Pre-fill from the last entry for this exercise NAME (any day/variation),
	// else the parsed plan weight/reps, else blank. Same-as-last is then ≤2 taps.
	const last = lastExlogEntry(logName);
	logW = last && last.w != null ? last.w : parseLeadNum(item.sub);
	logR = last && last.r != null ? last.r : parseLeadNum(item.reps);
	logEasy = false;
	document.getElementById('log-sheet-title').textContent = logName;
	document.getElementById('log-sheet-sub').textContent = last
		? `Last logged ${shortDayLabel(last.d)} · ${fmtNum(last.w)}×${fmtNum(last.r)}`
		: 'No history yet — log your first set';
	document.getElementById('log-sheet-body').innerHTML = logBodyHTML();
	document.getElementById('log-sheet-overlay').style.display = 'flex';
	// Focus the Save button so "same as last" is two taps (open chip, Save) even
	// via keyboard; the focus trap keeps Tab inside the sheet.
	document.querySelector('#log-sheet-body .log-save')?.focus();
}

function closeLogSheet() {
	document.getElementById('log-sheet-overlay').style.display = 'none';
	logReturnFocus?.focus?.();
	logReturnFocus = null;
	logName = null;
	logPlanned = null;
}

// ± a stepper. Weight quantises to 0.5 kg and clamps at 0; reps are integers ≥0.
// A blank field (null) starts from 0 on the first tap.
function stepLog(field, delta) {
	if (field === 'w') {
		const base = logW == null ? 0 : logW;
		logW = Math.max(0, Math.round((base + delta) * 2) / 2);
	} else {
		const base = logR == null ? 0 : logR;
		logR = Math.max(0, Math.round(base + delta));
	}
	const el = document.getElementById(field === 'w' ? 'log-w' : 'log-r');
	if (el) el.textContent = fmtNum(field === 'w' ? logW : logR);
}

function toggleEasy() {
	logEasy = !logEasy;
	const t = document.getElementById('log-easy');
	if (t) t.setAttribute('aria-pressed', logEasy);
}

// Append the working values to exlog (respecting the 10-cap in storage.js) and
// close. On a failed write, surface it honestly (#51): repaint the background so
// the persistent storage-warning banner shows, and keep the sheet open with an
// inline error rather than pretending it saved.
function saveLog() {
	if (logName == null) return;
	const wasOK = storageOK;
	const ok = appendExlog(logName, {
		d: todayKey(),
		w: logW,
		r: logR,
		e: logEasy,
	});
	if (ok) {
		const name = logName;
		closeLogSheet();
		announce(`Logged ${name}`);
		return;
	}
	if (wasOK && !storageOK) render();
	const err = document.getElementById('log-error');
	if (err)
		err.textContent = "Couldn't save — storage unavailable on this device.";
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
				el.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
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
				// Insert the empty role="status" shell first, then fill it in a
				// setTimeout(0) so AT that skip announce-on-insert still speak the
				// title/sub on the fill — "Workout complete …" (issue #77).
				content.insertAdjacentHTML(
					'afterbegin',
					'<div id="done-banner" class="done-banner" role="status"></div>',
				);
				setTimeout(() => {
					const banner = document.getElementById('done-banner');
					if (banner) banner.innerHTML = doneBannerInnerHTML();
				}, 0);
				// Only a live completion scrolls the fresh banner into view.
				document
					.getElementById('done-banner')
					?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
			}
		}
	} else {
		document.getElementById('done-banner')?.remove();
	}
}

// Two-tap arm for the (destructive, un-undoable) reset. The first activation
// only arms — swapping the label and starting a 3 s disarm timer — so a single
// stray sweaty-thumb tap can never wipe a session. The second activation inside
// the window runs the real wipe. A re-render while armed re-paints the button
// unarmed, which naturally disarms (state is module-local); the timer clearing
// on the next arm keeps things tidy.
let resetArmed = false;
let resetArmTimer = null;

function disarmReset() {
	resetArmed = false;
	if (resetArmTimer) {
		clearTimeout(resetArmTimer);
		resetArmTimer = null;
	}
	const btn = document.querySelector('.reset-btn');
	if (btn) {
		btn.classList.remove('armed');
		const label = btn.querySelector('.reset-btn-label');
		if (label) label.textContent = 'Reset progress';
	}
}

function resetProgress() {
	if (!resetArmed) {
		resetArmed = true;
		const btn = document.querySelector('.reset-btn');
		if (btn) {
			btn.classList.add('armed');
			const label = btn.querySelector('.reset-btn-label');
			if (label) label.textContent = 'Tap again to reset';
		}
		resetArmTimer = setTimeout(disarmReset, 3000);
		return;
	}

	disarmReset();
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
	window.scrollTo({ top: 0, behavior: scrollBehavior() });
}

// ─── HTML builders ───────────────────────────────────────────────────────────
// Inner content of the completion banner (svg + title + sub), separated so the
// live-tick path can inject the empty role="status" shell first and fill it in
// a setTimeout(0) — some AT skip announce-on-insert but honour a fill (issue #77).
function doneBannerInnerHTML() {
	const isProgramEnd = cachedDayKey === PROGRAM_END;
	const title = isProgramEnd ? 'Program Complete!' : 'Workout complete';
	const sub = isProgramEnd
		? `You finished the full ${PROGRAM_LABEL} program. Outstanding work.`
		: 'Great session. Hydrate and rest well.';
	return `<svg class="done-check" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      <div class="done-title">${title}</div>
      <div class="done-sub">${sub}</div>`;
}

// role="status" makes the banner announce its title/sub on completion. render()
// injects it whole for a reloaded/finished day (no announce-on-insert expected);
// the live tick path uses the empty-shell-then-fill technique in updateProgress.
function doneBannerHTML() {
	return `<div id="done-banner" class="done-banner" role="status">${doneBannerInnerHTML()}</div>`;
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

// Verbalize the numeral/qualifier glyphs of a meta string so a screen reader
// speaks it naturally (#75): × → "by", → and – → "to", / → "per", the middot
// separator → a comma, and "sec"/"min" expanded to full words. Used only for
// the composed aria-label — the visible markup keeps the compact glyphs.
function speakMeta(text) {
	return String(text)
		.replace(/×/g, ' by ')
		.replace(/→/g, ' to ')
		.replace(/[–—]/g, ' to ')
		.replace(/\//g, ' per ')
		.replace(/\s*·\s*/g, ', ')
		.replace(/\bsec\b/g, 'seconds')
		.replace(/\bmin\b/g, 'minutes')
		.replace(/\s+/g, ' ')
		.replace(/\s+,/g, ',')
		.trim();
}

// Compose a natural, screen-reader-friendly accessible name for a checklist row
// (#75). Because the row is role="checkbox", this aria-label overrides its
// visible subtree — silencing the fragment-order noise (name → meta → cap →
// warn → bare numerals) and the decorative indicator SVGs in one move. done/
// active state is deliberately NOT included: aria-checked announces "checked"/
// "not checked" natively.
function composeItemLabel(item) {
	const raw = item.label || '';
	const hasFirst = raw.includes('⭐ FIRST');
	// A few drill names carry a "→" sequencing arrow ("Walk → back kicks"); read
	// it as "to". "/" is left intact — in a name it means "or" (Light jog /
	// shuttle jog), not "per".
	const name = raw
		.replace('🍌 ', '')
		.replace('⭐ FIRST', '')
		.replace(/→/g, ' to ')
		.replace(/\s+/g, ' ')
		.trim();

	const parts = [hasFirst ? `${name}, first exercise` : name];

	// Scheme items speak "N sets of X"; timed/sub-only items carry their
	// duration or qualifier in `sub` and speak that instead.
	const hasScheme = item.sets != null && item.reps != null;
	if (hasScheme) {
		parts.push(`${item.sets} sets of ${speakMeta(item.reps)}`);
		if (item.sub) parts.push(speakMeta(item.sub));
	} else if (item.sub) {
		parts.push(speakMeta(item.sub));
	}
	if (item.note) parts.push(speakMeta(item.note));
	if (item.cap) parts.push(`cap ${speakMeta(item.cap)}`);
	if (item.warn) parts.push(`warning: ${speakMeta(item.warn)}`);

	// Fold the visible recall line (#87) into the accessible name — the composed
	// label overrides the row subtree, so the "Last:" line isn't announced
	// otherwise. Spoken form: "last session 32.5 kilograms by 12, felt easy".
	if (item.section === 'ex') {
		const last = lastExlogEntry(exerciseName(item));
		if (last) {
			parts.push(
				`last session ${fmtNum(last.w)} kilograms by ${fmtNum(last.r)}${last.e ? ', felt easy' : ''}`,
			);
		}
		// Announce the progression hint verbalized (#88) — never the raw glyphs.
		const hint =
			typeof hintSpoken === 'function'
				? hintSpoken(exerciseName(item), item.reps)
				: '';
		if (hint) parts.push(hint);
	}

	return parts.join(', ').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// The clean exercise NAME used as the exlog key (#86): the visible label minus
// the inline emoji and the "⭐ FIRST" priority flag. Must match the visible
// name so history keys stay stable across variations of the same movement.
function exerciseName(item) {
	return String(item.label || '')
		.replace('🍌 ', '')
		.replace('⭐ FIRST', '')
		.trim();
}

// "1 Jul"-class short date for the recall line (#87): shortDayLabel (workout.js)
// trimmed to day + month, reusing its 'en-AU' locale so no new locale path is
// introduced. Local Date construction avoids the UTC-parse off-by-one.
function recallDate(key) {
	const [y, m, d] = String(key).split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'short',
	});
}

// The progression suggestion for an ex item (or null): shared by the active row,
// the log sheet and the aria-label so all three read the same rule. Guarded so
// the DOM-free aria-label harness (which doesn't load workout.js) degrades to
// no hint rather than throwing.
function itemSuggestion(name, planned) {
	if (typeof suggestNext !== 'function') return null;
	return suggestNext(name, planned);
}

// Visible hint line for the recall slot (#88): accent-700 "Try 35kg — 32.5×12
// felt easy · cap 40kg" for a go, quiet neutral-600 "At cap — hold" when capped.
// Empty string when there's no suggestion, so it drops out of the stack cleanly.
function hintLineHTML(item) {
	const sug = itemSuggestion(exerciseName(item), item.reps);
	if (!sug) return '';
	if (sug.hold)
		return '<div class="item-hint item-hint-hold">At cap — hold</div>';
	const capPart = sug.cap != null ? ` · cap ${fmtNum(sug.cap)}kg` : '';
	return `<div class="item-hint">Try ${fmtNum(sug.weight)}kg — ${fmtNum(sug.from)}<span class="item-recall-x">×</span>${fmtNum(sug.reps)} felt easy${capPart}</div>`;
}

// Spoken form of the hint for the composed aria-label (#75 verbalization): no
// raw ×/kg glyphs reach the screen reader — "suggestion: try 35 kilograms, cap
// 40 kilograms" / "at cap, hold weight". Empty when there's no suggestion.
function hintSpoken(name, planned) {
	const sug = itemSuggestion(name, planned);
	if (!sug) return '';
	if (sug.hold) return 'at cap, hold weight';
	const capPart = sug.cap != null ? `, cap ${fmtNum(sug.cap)} kilograms` : '';
	return `suggestion: try ${fmtNum(sug.weight)} kilograms${capPart}`;
}

// Escape a string for safe use inside an HTML double-quoted attribute value.
function escapeAttr(s) {
	return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// First signed decimal number in a string, or null. Used to pre-fill the capture
// sheet from plan strings: '25–30kg' → 25, '7→10' → 7, '15kg/side' → 15,
// 'max' / 'each leg' → null (blank). No unit math — just the leading numeral.
function parseLeadNum(str) {
	const m = /-?\d+(?:\.\d+)?/.exec(String(str == null ? '' : str));
	return m ? parseFloat(m[0]) : null;
}

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

	// The Log chip (#86) rides in EVERY card's markup but is shown by CSS only on
	// the active row — the same always-in-DOM / show-on-active technique the
	// SETS×REPS microlabel uses, so a tick (which repaints classNames without
	// re-rendering innerHTML) moves the chip to the new active row for free.
	// stopPropagation keeps a tap from also ticking the row (a separate control).
	const chipHTML = `<button class="log-chip" type="button" aria-label="Log ${escapeAttr(exerciseName(item))}" onclick="event.stopPropagation();openLogSheet('${item.id}')">Log</button>`;

	// sub (weight/qualifier), note, cap and warn each stack as their own line
	// under the name. sub sits at full opacity on upcoming rows — the retired
	// day-hue meta line is gone.
	let stack = '';
	if (item.sub) stack += `<div class="item-sub">${item.sub}</div>`;
	if (item.note) stack += `<div class="item-note">${item.note}</div>`;
	if (item.cap) stack += `<div class="item-cap">Cap · ${item.cap}</div>`;
	if (item.warn)
		stack += `<div class="item-warn">${WARN_SVG}<span><span class="sr-only">Warning: </span>${item.warn}</span></div>`;

	// Last-session recall (#87): an exercise row's most recent exlog entry,
	// rendered as one quiet line under the meta stack — the app becoming the
	// weight database. Name-keyed via exerciseName (the same key the Log chip
	// writes, #86) so it recalls across A/B variations of the movement. ex-
	// rows only; a row with no history gets no line and renders as before.
	if (item.section === 'ex') {
		const last = lastExlogEntry(exerciseName(item));
		if (last) {
			const easy = last.e ? ' · easy' : '';
			stack += `<div class="item-recall">Last: ${fmtNum(last.w)}kg<span class="item-recall-x">×</span>${fmtNum(last.r)}${easy} · ${recallDate(last.d)}</div>`;
		}
		// Progression hint (#88): the app's own "+2.5kg when the top reps felt
		// easy" rule, rendered as one line in the recall slot — right below the
		// history it reasons from, so the fact and the recommendation read
		// together. Only ex rows, only when there's a suggestion or a cap-hold.
		stack += hintLineHTML(item);
	}

	// Split numerals (sets × reps). The SETS × REPS microlabel is always in the
	// DOM but hidden by CSS unless the row is active.
	const hasScheme = item.sets != null && item.reps != null;
	const numHTML = hasScheme
		? `<div class="item-num">
        <div class="item-num-val">${item.sets}<span class="item-num-x">×</span>${item.reps}</div>
        <div class="item-num-label">SETS × REPS</div>
      </div>`
		: '';

	return `<div class="item-card ${cls}" data-id="${item.id}" role="checkbox" aria-checked="${isDone}" aria-label="${composeItemLabel(item)}" tabindex="0" onclick="toggleItem('${item.id}')">
    <div class="item-indicator">${IND_CHECK}${IND_PLAY}</div>
    <div class="item-body">
      <div class="item-namerow"><span class="item-name">${label}</span>${firstHTML}${chipHTML}</div>
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
      <h2 class="section-name" id="sec-${sec.key}">${SECTION_NAMES[sec.key] || sec.key}</h2>
      <span class="sec-check-wrap" role="img" aria-label="section complete" style="${allDone ? '' : 'display:none'}">${SEC_CHECK}</span>
      <span class="sec-count" data-sec-count="${sec.key}">${done}/${sec.items.length}</span>
    </div>`;
		html += sec.items.map((item) => itemCardHTML(item, activeId)).join('');
	}

	if (workout.exercises) {
		html += `<div class="section-label"><h2 class="section-name" id="sec-principles">Principles</h2></div>
      <ul class="principles">
        <li class="principle">Increase weight before reps — add 2.5kg when 12 reps feels easy</li>
        <li class="principle">Rest 60–90s isolation · 2 min compounds</li>
        ${workout.hasCore ? '<li class="principle">Side lateral raises non-negotiable — form over weight, always</li>' : ''}
        <li class="principle">Hanging raises: no twisting variants — oblique growth widens waist</li>
        <li class="principle">No shrugs · no weighted side bends · no heavy deadlifts</li>
      </ul>`;
	}
	html += `<div style="text-align:center;padding:24px 0 40px">
      <button class="reset-btn" onclick="resetProgress()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span class="reset-btn-label">Reset progress</span>
      </button>
    </div>`;

	return html;
}

// ─── Render ─────────────────────────────────────────────────────────────────
// The single entry point that paints the whole screen for "today".
// Collapse a schedule entry's type into a coarse group name, used only for the
// week strip's screen-reader labels (WS_GROUP_NAME). The day-hue system that
// once consumed this to tint the UI is retired (#73).
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
			`<div class="storage-warning">Progress can't be saved on this device — ticks will be lost when you close the app.</div>`
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
			`<div class="storage-warning">Workout definition changed — progress re-checked.</div>`
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
        <h1 class="workout-title">No workout today</h1>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <main class="content">
        <div class="poster poster-ink">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="1"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m14 15 4 4"/><path d="m18 15-4 4"/></svg>
          <div class="poster-title">No workout today</div>
          <div class="poster-sub">This date is outside the current program (${PROGRAM_LABEL}).</div>
        </div>
      </main>`;
		document.title = 'No workout today — workout-dashboard';
		if (!storageOK) insertStorageWarning();
		return;
	}

	if (entry.type === 'rest') {
		app.innerHTML = `
      <header>
       <div class="header-inner">
        ${eyebrowRowHTML(entry, effectiveKey, key, swapBtnHTML)}
        <h1 class="workout-title">Rest Day</h1>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <main class="content">
        <div class="poster poster-accent">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          <div class="poster-title">Rest &amp; Recover</div>
          <div class="poster-sub">Sleep well. Let the muscles rebuild.</div>
        </div>
      </main>`;
		document.title = 'Rest Day — workout-dashboard';
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
        <h1 class="workout-title">Couldn't load workout</h1>
        ${weekStripHTML(key)}
        ${swapBannerHTML}
        ${noticeHTML}
        <div class="header-rule"></div>
       </div>
      </header>
      <main class="content">
        <div class="poster poster-ink">
          <svg class="poster-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          <div class="poster-title">Couldn't load workout</div>
          <div class="poster-sub">This day's workout couldn't be loaded (<code>${entry.type} · Var ${entry.variation || 'TBC'}</code>). Check js/data.js.</div>
        </div>
      </main>`;
		document.title = "Couldn't load workout — workout-dashboard";
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
      <h1 class="workout-title">${workout.title}</h1>
      ${weekStripHTML(key)}
      ${swapBannerHTML}
      ${noticeHTML}
      <div class="progress-row">
        <div class="segs" id="pbar-segs">${segsHTML}</div>
        <div class="progress-text" id="pbar-txt" role="status">${done} / ${total}</div>
      </div>
      <div class="header-rule"></div>
     </div>
    </header>
    <main id="wcontent" class="content">
      ${workoutContentHTML(workout)}
    </main>`;
	document.title = `${workout.title} — workout-dashboard`;

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
