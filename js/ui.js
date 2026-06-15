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
	const pct = total > 0 ? Math.round((done / total) * 100) : 0;

	const fill = document.getElementById('pbar-fill');
	const txt = document.getElementById('pbar-txt');
	if (fill) fill.style.width = pct + '%';
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
		el.innerHTML = `<div style="font-size:48px">🎉</div>
      <div style="font-size:20px;font-weight:700;margin-top:10px;color:var(--green)">Workout Complete!</div>
      <div style="font-size:13px;color:var(--text2);margin-top:5px">Great session. Hydrate and rest well.</div>`;
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
		if (el)
			el.className =
				'item-card ' + (item.id === activeId ? 'active' : 'upcoming');
	}
	updateProgress(activeId);
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── HTML builders ───────────────────────────────────────────────────────────
function itemCardHTML(item, activeId) {
	const isDone = completedItems.has(item.id);
	const isActive = !isDone && item.id === activeId;
	const cls = isDone ? 'done' : isActive ? 'active' : 'upcoming';
	return `<div class="item-card ${cls}" data-id="${item.id}" onclick="toggleItem('${item.id}')">
    <div class="item-indicator"></div>
    <div class="item-body">
      <div class="item-name">${item.label}</div>
      <div class="item-meta">${item.meta}</div>
      ${item.note ? `<div class="exercise-note">${item.note}</div>` : ''}
      ${item.cap ? `<div class="exercise-cap">Cap: <span class="cap-value">${item.cap}</span></div>` : ''}
      ${item.warn ? `<div class="exercise-warn">⚠️ ${item.warn}</div>` : ''}
    </div>
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
// Called once on load (main.js) and again after any state change (toggle/borrow).
function render() {
	const key = todayKey();
	const borrows = loadBorrows();
	const effectiveKey = borrows[key] || key;
	const entry = SCHEDULE[effectiveKey];
	const borrowedFrom = borrows[key] || null;
	const dateStr = formatDate(key);
	const app = document.getElementById('app');
	const swapBannerHTML = borrowedFrom
		? `<div class="swap-banner">Following ${shortDayLabel(borrowedFrom)}'s workout <button onclick="undoBorrow('${key}')">Undo</button></div>`
		: '';
	const swapBtnHTML = `<button class="header-action" onclick="openSwapSheet('${key}')" title="Follow a different day">⇄</button>`;

	if (!entry) {
		app.innerHTML = `
      <header>
        <div class="header-top">
          <div class="app-name">Dashboard</div>
        </div>
        <div class="date-label">${dateStr}</div>
        <div class="workout-title">No workout today</div>
      </header>
      <div class="content">
        <div class="no-schedule" style="color:var(--text2)">
          <div style="font-size:48px">📅</div>
          <div style="margin-top:12px">This date is outside the current program (${PROGRAM_LABEL}).</div>
        </div>
      </div>`;
		return;
	}

	if (entry.type === 'rest') {
		app.innerHTML = `
      <header>
        <div class="header-top">
          <div class="app-name">Dashboard</div>
          ${swapBtnHTML}
        </div>
        <div class="date-label">${dateStr}</div>
        <div class="workout-title">Rest Day</div>
        ${swapBannerHTML}
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

	// Build item list and load persisted state
	cachedKey = key;
	allItems = buildItemList(workout);
	completedItems = loadState(key);

	const done = allItems.filter((i) => completedItems.has(i.id)).length;
	const total = allItems.length;
	const pct = total > 0 ? Math.round((done / total) * 100) : 0;

	app.innerHTML = `
    <header>
      <div class="header-top">
        <div class="app-name">Dashboard</div>
        ${swapBtnHTML}
      </div>
      <div class="date-label">${dateStr}</div>
      <div class="workout-title">${workout.title}</div>
      <div class="workout-meta">Var ${entry.variation} · ${getWeekType(entry.type, effectiveKey)}</div>
      ${swapBannerHTML}
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill" id="pbar-fill" style="width:${pct}%"></div></div>
        <div class="progress-text" id="pbar-txt">${done} / ${total}</div>
      </div>
    </header>
    <div id="wcontent" class="content">
      ${workoutContentHTML(workout)}
    </div>`;
}
