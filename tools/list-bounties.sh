#!/usr/bin/env bash
# List open make.fun bounties. No API key needed.
# Usage: ./tools/list-bounties.sh [--json] [--all]
# Thin wrapper around `node tools/mf.mjs list` (Node 22+ required).
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node not found. Install Node.js 22+ (https://nodejs.org) and re-run."
  exit 1
fi

exec node "$(dirname "$0")/mf.mjs" list "$@"
