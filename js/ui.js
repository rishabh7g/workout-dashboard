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
function openSwapSheet(todayKey) {
	let rows = '';
	for (let i = 1; i <= 7; i++) {
		const dt = new Date();
		dt.setDate(dt.getDate() + i);
		const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
		if (!SCHEDULE[k]) continue;
		rows += `<div class="swap-option" onclick="doBorrow('${todayKey}','${k}')">
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
function doBorrow(todayKey, targetKey) {
	const b = loadBorrows();
	b[todayKey] = targetKey;
	saveBorrows(b);
	closeSwapSheet();
	render();
}
function undoBorrow(key) {
	const b = loadBorrows();
	delete b[key];
	saveBorrows(b);
	render();
}

// ─── Toggling / progress ─────────────────────────────────────────────────────
// Tick or untick an item, then recompute which item is "active" (the first
// not-yet-done one) and repaint just the card classes — no full re-render.
function toggleItem(id) {
	completedItems.has(id) ? completedItems.delete(id) : completedItems.add(id);
	saveState(cachedKey);

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

	// Completion banner
	if (
		done === total &&
		total > 0 &&
		!document.getElementById('done-banner')
	) {
		const el = document.createElement('div');
		el.id = 'done-banner';
		el.className = 'done-banner';
		const isProgramEnd = cachedDayKey === PROGRAM_END;
		const title = isProgramEnd
			? 'Program Complete!'
			: 'Workout Complete!';
		const sub = isProgramEnd
			? `You finished the full ${PROGRAM_LABEL} program. Outstanding work.`
			: 'Great session. Hydrate and rest well.';
		el.innerHTML = `<div class="done-emoji">🎉</div>
      <div class="done-title">${title}</div>
      <div class="done-sub">${sub}</div>`;
		const content = document.getElementById('wcontent');
		if (content) content.insertBefore(el, content.firstChild);
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
}

function resetProgress() {
	completedItems = new Set();
	saveState(cachedKey);
	const banner = document.getElementById('done-banner');
	if (banner) banner.remove();
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
function eyebrowLabel(entry, key) {
	const wk = `Week ${weekNumber(key)} / ${TOTAL_WEEKS}`;
	if (!entry) return wk;
	if (entry.type === 'rest') return `${wk} · Rest Day`;
	const mid =
		entry.type === 'running'
			? 'Saturday'
			: entry.type === 'recovery'
				? 'Sunday'
				: getWeekType(entry.type, key);
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
        <div class="eyebrow">${eyebrowLabel(entry, effectiveKey)}</div>
        <div class="eyebrow-right">
          <span class="eyebrow-date">${shortDayLabel(key)}</span>
          ${swapBtnHTML}
        </div>
      </div>`;
}

// Called once on load (main.js) and again after any state change (toggle/borrow).
function render() {
	const key = todayKey();
	cachedDayKey = key; // track the plain date on every path for the midnight check
	const borrows = loadBorrows();
	const effectiveKey = borrows[key] || key;
	const entry = SCHEDULE[effectiveKey];
	// Tint the whole UI with the effective (borrowed) day's hue.
	document.documentElement.dataset.day = dayGroup(entry);
	const borrowedFrom = borrows[key] || null;
	const app = document.getElementById('app');
	const swapBannerHTML = borrowedFrom
		? `<div class="swap-banner">Following ${shortDayLabel(borrowedFrom)}'s workout <button onclick="undoBorrow('${key}')">Undo</button></div>`
		: '';
	const swapBtnHTML = `<button class="header-action" onclick="openSwapSheet('${key}')" title="Follow a different day">⇄</button>`;
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
      </header>
      <div class="content">
        <div class="no-schedule">
          <div style="font-size:48px">📅</div>
          <div style="margin-top:12px">This date is outside the current program (${PROGRAM_LABEL}).</div>
        </div>
      </div>`;
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
		return;
	}

	// Gym day or running day — both share the same interactive checklist path.
	const workout = (WORKOUTS[entry.type] || RUNNING_DAYS[entry.type])?.[
		entry.variation
	];
	if (!workout) return;

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
}
