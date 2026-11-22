#!/usr/bin/env bash
# Fetch the latest official make.fun skill.md + heartbeat.md into .cache/
# (gitignored) and compare the version against the pin in VERSION.
# Never edits tracked files.
# Usage: bash tools/fetch-skill.sh [--strict]
# Exit: 0 = done (a version difference is only a warning), 1 = error.
#       With --strict: 3 when the version differs (used by CI).
set -euo pipefail

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="${MF_CACHE_DIR:-$REPO_DIR/.cache}"
LATEST="$CACHE_DIR/skill-upstream-latest.md"
HEARTBEAT="$CACHE_DIR/heartbeat-latest.md"

pinned="$(tr -d '[:space:]' < "$REPO_DIR/VERSION" 2>/dev/null || true)"
[ -n "$pinned" ] || pinned="unknown"
echo "Pinned version: $pinned  (VERSION, references/skill-upstream-v$pinned.md)"

mkdir -p "$CACHE_DIR"
tmp_skill="$(mktemp)"
tmp_hb="$(mktemp)"
trap 'rm -f "$tmp_skill" "$tmp_hb"' EXIT

if ! curl -fsSL --max-time 30 "https://make.fun/skill.md" -o "$tmp_skill"; then
  echo "FAIL: could not download https://make.fun/skill.md (offline?)"
  exit 1
fi
if ! grep -q '^version:' "$tmp_skill"; then
  echo "FAIL: download did not look like skill.md (no version line)"
  exit 1
fi

latest="$(grep -m1 '^version:' "$tmp_skill" | sed 's/version: *//; s/"//g' | tr -d '[:space:]')"
echo "Latest version: $latest"
cp "$tmp_skill" "$LATEST"
echo "Saved: ${LATEST#"$REPO_DIR"/}"

if curl -fsSL --max-time 30 "https://make.fun/heartbeat.md" -o "$tmp_hb" 2>/dev/null; then
  cp "$tmp_hb" "$HEARTBEAT"
  echo "Saved: ${HEARTBEAT#"$REPO_DIR"/}"
else
  echo "WARN: could not download heartbeat.md — skill.md was still saved."
fi

if [ "$latest" = "$pinned" ]; then
  echo "SAME: latest ($latest) == pinned ($pinned). No update needed."
  exit 0
fi
# Upstream rule (1.5.259): any difference, newer or older, means the copy is stale.
echo "DIFFERS: latest ($latest) != pinned ($pinned)."
echo "To update the pin: copy $LATEST to references/skill-upstream-v$latest.md,"
echo "the heartbeat to references/heartbeat-v$latest.md, write $latest to VERSION,"
echo "remove the old pinned files, and review SKILL.md against the diff."
[ "$STRICT" -eq 1 ] && exit 3
exit 0
