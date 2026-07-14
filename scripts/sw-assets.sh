#!/usr/bin/env bash
# sw-assets.sh — print the service-worker precache list, one path per line,
# normalised ('./': the app shell, printed as empty string → caller appends /).
# Single source of truth: parses sw.js so the list can never drift from it.
# Used by scripts/verify.sh (HTTP checks) and CI (file-existence checks).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sed -n "/const ASSETS = \[/,/\];/p" "$ROOT/sw.js" \
	| grep -oE "'[^']+'" \
	| tr -d "'" \
	| sed 's|^\./||'
