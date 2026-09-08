#!/usr/bin/env bash
# verify.sh — one-command verification for the workout-dashboard static PWA.
#
#   scripts/verify.sh              # serve the working tree locally and verify it
#   scripts/verify.sh --live       # verify the deployed GitHub Pages instance
#   scripts/verify.sh --live URL   # verify any deployed instance
#
# Contract (for background agents — never stream logs):
#   * ONE summary line to stdout on success:
#       LINT ok | TEST 18/18 | SERVE ok | ASSETS 19/19 | RENDER ok | SHOT ok (out/verify-shot.png)
#   * Stages run in order and the FIRST failure stops the run, so a red run
#     names exactly one thing.
#   * Every stage's output goes to .verify/<stage>.log — one file per stage,
#     gitignored, and the whole directory is wiped at the start of every run, so
#     a missing log is proof that the stage never ran. Read it ONLY on FAIL.
#   * On FAIL: prints "FAIL <STAGE> (exit N)" + a ~20-line log slice + the log path.
#   * Distinct exit code per stage:
#       stage    exit  what it checks
#       LINT      20   node --check on every js/*.js and sw.js
#       TEST      30   every tests/*.test.js, run as a standalone node script
#       SERVE     40   the tree is being served (LIVE, same code, with --live)
#       ASSETS    50   everything sw.js precaches resolves over HTTP
#       RENDER    60   the JS ran and painted #app
#       SHOT      70   the painted page screenshots to more than a blank frame
#     TYPES has no stage here and LINT is node --check: see CLAUDE.md
#     §"Deviations from the repo standards".
#
# Environment: bare Raspberry Pi. Needs node, python3, curl, and the
# Playwright headless shell already cached under ~/.cache/ms-playwright
# (see CLAUDE.md). No npm, no installs.
#
# Note: today's date decides which view renders (rest vs workout vs post-
# program). RENDER/SHOT are liveness checks — "the JS ran and painted #app" —
# not pixel tests.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/out"
LOGDIR="$ROOT/.verify"
LIVE_DEFAULT="https://rishabh7g.github.io/workout-dashboard"
mkdir -p "$OUT"
rm -rf "$LOGDIR"
mkdir -p "$LOGDIR"

MODE="local"
BASE=""
if [[ "${1:-}" == "--live" ]]; then
	MODE="live"
	BASE="${2:-$LIVE_DEFAULT}"
	BASE="${BASE%/}" # normalise: no trailing slash
fi

SUMMARY=""
SRV_PID=""
STAGE=""
LOG="/dev/null" # until the first stage() call — nothing logs before it
trap '[[ -n "$SRV_PID" ]] && kill "$SRV_PID" 2>/dev/null' EXIT

stage() { # stage <STAGE> — open that stage's own log and head it
	STAGE=$1
	LOG="$LOGDIR/$(printf '%s' "$STAGE" | tr '[:upper:]' '[:lower:]').log"
	printf '=== %s %s ===\n' "$STAGE" "$(date -Is)" >"$LOG"
}

log() { printf '%s\n' "$*" >>"$LOG"; }

fail() { # fail <exit-code> — always about the stage that is open
	local code=$1
	echo "FAIL $STAGE (exit $code) — log: $LOG"
	echo "── last 20 log lines ──────────────────────────────"
	tail -20 "$LOG"
	exit "$code"
}

# ── Stage 1: LINT (node --check — this repo has no linter; see CLAUDE.md) ────
stage LINT
LINT_OK=1
for f in "$ROOT"/js/*.js "$ROOT"/sw.js; do
	if node --check "$f" >>"$LOG" 2>&1; then
		log "ok $f"
	else
		LINT_OK=0
		log "LINT FAIL $f"
	fi
done
[[ $LINT_OK == 1 ]] || fail 20
SUMMARY="LINT ok"

# ── Stage 2: TEST (runner-less: each tests/*.test.js is a node script that
#              exits non-zero on failure; count files passed vs total) ────────
stage TEST
if compgen -G "$ROOT/tests/*.test.js" >/dev/null; then
	TEST_PASS=0 TEST_N=0
	for t in "$ROOT"/tests/*.test.js; do
		TEST_N=$((TEST_N + 1))
		log "--- run $t ---"
		if (cd "$ROOT" && node "$t") >>"$LOG" 2>&1; then
			TEST_PASS=$((TEST_PASS + 1))
			log "ok $t"
		else
			log "TEST FAIL $t (exit $?)"
		fi
	done
	[[ $TEST_PASS == "$TEST_N" ]] || fail 30
	SUMMARY="$SUMMARY | TEST ${TEST_PASS}/${TEST_N}"
else
	log "no tests/*.test.js — skipping"
	SUMMARY="$SUMMARY | TEST skip"
fi

# ── Stage 3: SERVE (local) or LIVE (deployed) ───────────────────────────────
if [[ $MODE == "local" ]]; then
	stage SERVE
	PORT="${PORT:-$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1]);s.close()')}"
	BASE="http://localhost:$PORT"
	# The server outlives this stage; its request log keeps landing in serve.log.
	python3 -m http.server "$PORT" -d "$ROOT" >>"$LOG" 2>&1 &
	SRV_PID=$!
	up=0
	for _ in $(seq 1 30); do
		# If our child died (port already in use, etc.) fail NOW — otherwise a
		# stale server on the same port could silently answer for the wrong tree.
		kill -0 "$SRV_PID" 2>/dev/null || { log "server process died — port busy? another verify running?"; fail 40; }
		curl -sf -o /dev/null "$BASE/" && { up=1; break; }
		sleep 0.1
	done
	log "server pid=$SRV_PID port=$PORT up=$up"
	[[ $up == 1 ]] || fail 40
	SUMMARY="$SUMMARY | SERVE ok"
else
	stage LIVE
	curl -sf -o /dev/null "$BASE/" || { log "live base unreachable: $BASE/"; fail 40; }
	SUMMARY="$SUMMARY | LIVE ok"
fi

# ── Stage 4: ASSETS (everything sw.js precaches, plus sw.js itself) ─────────
stage ASSETS
ASSET_OK=0 ASSET_N=0
while IFS= read -r a; do
	ASSET_N=$((ASSET_N + 1))
	url="$BASE/$a"
	if curl -sf -o /dev/null "$url"; then
		ASSET_OK=$((ASSET_OK + 1))
		log "ok  $url"
	else
		log "404/ERR $url"
	fi
done < <("$ROOT/scripts/sw-assets.sh" 2>>"$LOG"; echo "sw.js")
SUMMARY="$SUMMARY | ASSETS $ASSET_OK/$ASSET_N"
[[ $ASSET_OK == "$ASSET_N" ]] || fail 50

# ── Stage 5: RENDER (the JS actually ran and painted #app) ──────────────────
stage RENDER
# Headless shell: newest cached build.
HS=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | sort | tail -1)
if [[ -z "$HS" ]]; then
	log "headless_shell not found under ~/.cache/ms-playwright — see CLAUDE.md"
	fail 60
fi
"$HS" --headless --no-sandbox --dump-dom --virtual-time-budget=3000 \
	"$BASE/" >"$OUT/verify-dom.html" 2>>"$LOG"
grep -q 'id="app"' "$OUT/verify-dom.html" || { log "no #app in DOM"; fail 60; }
if grep -q '<div id="app"></div>' "$OUT/verify-dom.html"; then
	log "#app is EMPTY — a script threw before render(); check console"
	fail 60
fi
SUMMARY="$SUMMARY | RENDER ok"

# ── Stage 6: SHOT (visual artifact for the human) ───────────────────────────
stage SHOT
"$HS" --headless --no-sandbox --screenshot="$OUT/verify-shot.png" \
	--window-size=412,900 --virtual-time-budget=3000 "$BASE/" >>"$LOG" 2>&1
SIZE=$(stat -c%s "$OUT/verify-shot.png" 2>/dev/null || echo 0)
log "shot size=$SIZE bytes"
[[ $SIZE -ge 10000 ]] || fail 70 # blank/near-blank page compresses tiny
SUMMARY="$SUMMARY | SHOT ok (out/verify-shot.png)"

echo "$SUMMARY"
exit 0
