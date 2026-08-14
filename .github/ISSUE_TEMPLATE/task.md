---
name: Task
about: One focused, single-purpose change to workout-dashboard
---

### What
One sentence: what changes and why.

### Where
Files to touch and the intended approach.

### Acceptance criteria
- [ ] (specific, testable criteria)
- [ ] No new copy uses a banned word/phrase: **streak**, **daily goal**,
      **days left**, **% complete**, **you've got this**, **keep it up**,
      **crush it**
- [ ] Review question: *does this add a second way to reach the same
      content?* If yes, justify it in the PR description — a second path to
      the same screen is a real cost even when each path alone is small
      (house UI standard §9).
- [ ] No read-once explainer copy added (house UI standard §8's "Write
      less"): a new string survives only if it (1) carries live data, (2) is
      the only instruction on a step, or (3) guards a destructive action.
- [ ] User-facing strings, if any, go through `js/strings.js`'s `t()` — see
      `tests/strings.test.js`.
- [ ] `const CACHE` in `sw.js` bumped one version if `js/ css/ fonts/
      index.html manifest.json` changed.
- [ ] Relevant `node tests/<name>.test.js` files pass. Never `node --test
      tests/` — it dies with `MODULE_NOT_FOUND`.

### Depends on
#…
