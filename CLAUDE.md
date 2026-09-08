# workout-dashboard — project deltas (workflow: see `~/.claude/CLAUDE.md`)

Static vanilla-JS PWA. **No build step, no package.json, no npm — keep it that way.**
Deploy = squash-merge to `main`; GitHub Pages serves the repo root, live ~1 min
(Jekyll build). `main` stays deployable; one PR per issue referencing it.
Live: https://rishabh7g.github.io/workout-dashboard/

## Verify (the whole recipe — do not rediscover it)
- `bash scripts/verify.sh` → ONE line:
  `LINT ok | TEST 18/18 | SERVE ok | ASSETS 19/19 | RENDER ok | SHOT ok (out/verify-shot.png)`
  Detail in `.verify/<stage>.log`, one file per stage (gitignored, wiped at the
  start of every run) — open it ONLY on FAIL (the failure block already holds
  the ~20 relevant lines). Exit codes: 20 LINT · 30 TEST · 40 SERVE/LIVE
  · 50 ASSETS · 60 RENDER · 70 SHOT.
- `bash scripts/verify.sh --live` verifies the deployed site — how a cold agent
  confirms a fix landed. Pages needs ~1 min after merge; re-run once before
  treating a live failure as real. (Batch drains: orchestrator runs ONE `--live`
  for the merged group.)

## Deviations from the repo standards
Standard: `docs/repo-standards.md` in the `rishabh7g/claude-setup` repo
([link](https://github.com/rishabh7g/claude-setup/blob/main/docs/repo-standards.md)),
§"The same four gates exist in every code repository" — which allows a
deviation as long as the reason is written down. This is that record.
- **No eslint and no prettier gate — deliberate, not drift.** Neither can land
  without npm, and zero dependencies is the property this repo exists to keep:
  it runs, tests and deploys from a bare Raspberry Pi checkout with nothing
  installed, and GitHub Pages serves that same tree. Taking a lint gate means
  taking `package.json` and `node_modules/`, which costs more than
  the gate is worth here. Style is held by the lint policy below instead.
- **The standard's other gates are met by `scripts/verify.sh`:** `node --check`
  on every `js/*.js` and `sw.js` (the LINT stage — a vanilla-JS repo has no type
  checker, so that one stage fills the TYPES slot too), the standalone
  `tests/*.test.js` suites (TEST), and the ASSETS + RENDER checks, which stand
  in for BUILD — there is no build step to run, so what is verified instead is
  that every precached asset resolves and that the shipped scripts actually
  paint `#app`.
- **Revisit only if this repo ever gains a build step.** npm arriving for any
  other reason would make eslint and prettier nearly free; until then this
  deviation stands and no linter config lands.

## Conventions
- **No npm / zero deps.** Tests are standalone scripts: `node tests/<name>.test.js`
  (NOT `node --test tests/` — the dir-as-glob trap dies with MODULE_NOT_FOUND).
  18 `*.test.js` files in `tests/` (counts in the verify line drift with the repo). Enforcement that runs = `node --check` (verify.sh LINT
  stage).
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
