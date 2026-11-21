#!/usr/bin/env bash
# Check prerequisites for muse-make-fun / make.fun.
# Usage: ./tools/check-prereqs.sh
# Exit 0 if all required tools pass, non-zero otherwise.
set -uo pipefail

fail=0

check() {
  # $1 = command, $2 = required? (yes/no), $3 = note
  if command -v "$1" >/dev/null 2>&1; then
    echo "PASS: $1 — $3"
  elif [ "$2" = "yes" ]; then
    echo "FAIL: $1 missing — $3"
    fail=1
  else
    echo "SKIP: $1 not found (optional) — $3"
  fi
}

check git yes "entries are public GitHub repos"
check curl yes "downloads kits and the official skill.md"
check node yes "make.fun kit CLI needs Node >= 22"
check python3 no "used by tools/list-bounties.sh to pretty-print JSON"
check jq no "optional JSON pretty-printer for tools/list-bounties.sh"
check gh no "optional GitHub CLI for repo topics / clone"

if command -v node >/dev/null 2>&1; then
  ver="$(node --version)"
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${major:-0}" -ge 22 ]; then
    echo "PASS: node $ver (>= 22)"
  else
    echo "FAIL: node $ver — make.fun needs Node >= 22 (SDK needs 22.13+)"
    fail=1
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All required prereqs PASS."
else
  echo "Some required prereqs FAIL — install them, then re-run."
fi
exit "$fail"
