# workout-dashboard — project deltas (workflow: see `~/.claude/CLAUDE.md`)

Static vanilla-JS PWA. **No build step, no package.json, no npm — keep it that way.**
Deploy = squash-merge to `main`; GitHub Pages serves the repo root, live ~1 min
(Jekyll build). `main` stays deployable; one PR per issue referencing it.
Live: https://rishabh7g.github.io/workout-dashboard/

## Verify (the whole recipe — do not rediscover it)
- `bash scripts/verify.sh` → ONE line:
  `SYNTAX ok | TEST 11/11 | SERVE ok | ASSETS 11/11 | RENDER ok | SHOT ok (out/verify-shot.png)`
  Detail in `out/verify.log` — open it ONLY on FAIL (the failure block already
  holds the ~20 relevant lines). Exit codes: 2 SYNTAX · 3 TEST · 4 SERVE/LIVE
  · 5 ASSETS · 6 RENDER · 7 SHOT.
- `bash scripts/verify.sh --live` verifies the deployed site — how a cold agent
  confirms a fix landed. Pages needs ~1 min after merge; re-run once before
  treating a live failure as real. (Batch drains: orchestrator runs ONE `--live`
  for the merged group.)

## Conventions
- **No npm / zero deps.** Tests are standalone scripts: `node tests/<name>.test.js`
  (NOT `node --test tests/` — the dir-as-glob trap dies with MODULE_NOT_FOUND).
  11 files in `tests/`. Enforcement that runs = `node --check` (verify.sh SYNTAX
  stage + CI `.github/workflows/checks.yml`).
- **Load order / one shared global scope.** Five classic scripts load in order in
  `index.html`: data.js → storage.js → workout.js → ui.js → main.js. They share
  one global scope, so order matters. `js/data.js` and `js/workout.js` carry
  guarded Node exports at the bottom (`typeof module !== 'undefined'` — inert in
  the browser) so tests can `require` them; extend the guard when adding testable
  functions.
- **Lint policy (F10-13):** tabs, single quotes, semicolons — match the file you
  edit. No linter, no package.json/eslintrc/biome.json ever lands; the only
  enforcement is `node --check`. `npx @biomejs/biome check js/` may be run ad hoc
  as advisory, never a merge gate.
- **Cache-bump rule:** any change under `js/ css/ fonts/ index.html manifest.json`
  ⇒ bump `const CACHE` in `sw.js` (v54 → v55 → …) and keep its ASSETS list in
  sync. CI-guarded (#36). Doc-only changes → NO CACHE bump.
- **Deployed-root policy:** nothing lands in the repo root that shouldn't be on
  the live site (GitHub Pages serves the repo root). Design mockups live on the
  `design` branch, not main.
