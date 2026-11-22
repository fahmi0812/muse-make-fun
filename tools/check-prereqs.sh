#!/usr/bin/env bash
# Check prerequisites for muse-make-fun / make.fun.
# Usage: bash tools/check-prereqs.sh
# Exit 0 if all required tools pass, non-zero otherwise.
# This is the single prereq check; setup/setup.sh calls it too.
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
check node yes "make.fun kit CLI and tools/mf.mjs need Node"
check gh no "optional GitHub CLI for repo topics / clone"

# The kit needs Node 22.18+ (or 23.8+, or 24+). Node 23.0–23.7 lacks
# createZstdCompress in node:zlib and the kit exits with a SyntaxError.
if command -v node >/dev/null 2>&1; then
  ver="$(node --version)"
  if node -e '
    const [maj, min] = process.versions.node.split(".").map(Number);
    const ok = (maj === 22 && min >= 18) || (maj === 23 && min >= 8) || maj >= 24;
    process.exit(ok ? 0 : 1);
  ' 2>/dev/null; then
    echo "PASS: node $ver (22.18+, 23.8+ or 24+)"
  else
    echo "FAIL: node $ver — make.fun kit needs Node 22.18+, 23.8+ or 24+ (23.0–23.7 is broken)"
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
