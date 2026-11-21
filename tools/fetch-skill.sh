#!/usr/bin/env bash
# Fetch the latest official make.fun skill.md + heartbeat.md and compare
# versions against the pinned copy in references/.
# Usage: ./tools/fetch-skill.sh   (run from the repo root)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINNED="$REPO_DIR/references/skill-upstream-v1.5.236.md"
LATEST="$REPO_DIR/references/skill-upstream-latest.md"
HEARTBEAT="$REPO_DIR/references/heartbeat-latest.md"

pinned_version() {
  grep -m1 '^version:' "$PINNED" 2>/dev/null | sed 's/version: *//; s/"//g' || echo "unknown"
}

echo "Pinned version: $(pinned_version)  ($PINNED)"

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

latest_version="$(grep -m1 '^version:' "$tmp_skill" | sed 's/version: *//; s/"//g')"
echo "Latest version: $latest_version"

cp "$tmp_skill" "$LATEST"
echo "Saved: references/skill-upstream-latest.md"

if curl -fsSL --max-time 30 "https://make.fun/heartbeat.md" -o "$tmp_hb" 2>/dev/null; then
  cp "$tmp_hb" "$HEARTBEAT"
  echo "Saved: references/heartbeat-latest.md"
else
  echo "WARN: could not download heartbeat.md — skill.md was still saved."
fi

if [ "$latest_version" = "$(pinned_version)" ]; then
  echo "SAME: latest ($latest_version) == pinned ($(pinned_version)). No update needed."
else
  echo "NEWER: latest ($latest_version) != pinned ($(pinned_version))."
  echo "Review the diff, then update references/skill-upstream-v1.5.236.md"
  echo "and the version noted in SKILL.md / README.md."
fi
