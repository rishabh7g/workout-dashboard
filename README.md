# workout-dashboard

A personal 26-week workout-program dashboard — a vanilla-JS static PWA. No build
step, no dependencies, no framework, single user, offline-first.
Live: https://rishabh7g.github.io/workout-dashboard/

## What it does

Renders each day of a fixed 26-week program (May 23 – Nov 22, 2026) as a tickable
checklist — gym, running, or rest — and keeps your progress on the device. It is
deliberately small and single-purpose:

- **Offline-first PWA** — a service worker precaches the shell so it opens and
  works with no network; installs to the home screen (`manifest.json`).
- **localStorage only** — one user, one device. Per-day tick state, borrowed
  days, and the exercise log all live in `localStorage`; there is no backend and
  nothing leaves the device.
- **Per-exercise log + recall + progression hints** — records what you lifted,
  recalls your last session for each exercise, and suggests the next load using a
  simple +2.5 kg rule (`suggestNext`).
- **One-tap backup / restore** — export the full state as a JSON file and import
  it back, so a personal history survives a cleared browser or a new device.
- **Modernist redesign, accessible** — keyboard-operable checkboxes, a dialog
  "swap day" sheet, `aria-live` announcements, and `prefers-reduced-motion`
  support.

## Architecture — five classic scripts, one shared global scope, loaded in order

The app is five plain `<script>` tags (no modules, no bundler) that share a
single global scope. **Load order matters**: each file assumes the ones before it
have already defined their globals. `data.js` and `workout.js` also carry
Node-guarded `module.exports` (`if (typeof module !== 'undefined')`) purely so the
standalone test suites can import their pure logic.

| file | role |
|---|---|
| `js/data.js` | Pure constants — the program "database": `SCHEDULE`, `WORKOUTS`, `CORE`, `DRILLS`, and program dates. No DOM, no functions. |
| `js/workout.js` | DOM-free domain logic: `buildItemList`, `weekNumber`, `getWeekType`, `suggestNext`, `splitReps`. This is what the unit tests cover. |
| `js/storage.js` | `localStorage` layer + shared mutable session state: `ws-*` day records under a v1 envelope, day-borrow, the `exlog` exercise log, backup export/import, and a `storageOK` probe. |
| `js/ui.js` | All DOM rendering and every view; the only file that touches the page, plus the global `onclick` handlers. |
| `js/main.js` | Bootstrap (loaded last): first render, the day-rollover refresh timer, service-worker registration, and the update toast. |
| `sw.js` | Offline cache (network-first with a 3 s race). The `CACHE` name is bumped by hand per release; CI enforces it (see Deploy). |

## Verify

    bash scripts/verify.sh          # local: syntax -> tests -> serve -> assets -> render -> screenshot
    bash scripts/verify.sh --live   # the same checks against the deployed site
    node tests/*.test.js            # just the unit tests (13 standalone, zero-dependency suites)

`scripts/verify.sh` prints **one summary line** on success
(`SYNTAX ok | TEST 13/13 | SERVE ok | ASSETS 16/16 | RENDER ok | SHOT ok`), writes
all detail to `out/verify.log`, and uses a distinct exit code per stage (read the
log only on FAIL). The test suites in `tests/` are zero-dependency Node scripts
that exit non-zero on failure — they are **not** `node --test`/TAP, so run them
directly. CI runs the same syntax + test + precache checks on every PR via
`.github/workflows/checks.yml`.

## Deploy

Squash-merging to `main` **is** the deploy — GitHub Pages serves the repo root
(legacy Jekyll build, ~1 min to go live). Rules:

- `main` is always deployable; **one PR per issue**.
- Any change under `js/ css/ fonts/ index.html manifest.json` **must bump `CACHE`**
  in `sw.js` (`workout-dashboard-vN` → `vN+1`) so installed PWAs pick up the new
  assets. CI's cache-bump guard fails the PR otherwise. Docs-only changes (like
  this README) are not precached, so they need no bump.

## License

Code: no `LICENSE` file — all rights reserved by default. This is a deliberate
decision, not an oversight: it is a personal single-user project (GitHub's default
grants view/fork only, no usage rights). The bundled font under `fonts/` keeps its
own SIL Open Font License (`fonts/OFL-Archivo.txt`), which must continue to travel
with the font files.
