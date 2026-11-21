#!/usr/bin/env bash
# List open make.fun bounties. No API key needed.
# Usage: ./tools/list-bounties.sh
set -uo pipefail

echo "Fetching open bounties from https://make.fun/api/competitions?status=open ..."
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! curl -fsSL --max-time 30 "https://make.fun/api/competitions?status=open" -o "$tmp"; then
  echo "FAIL: could not reach make.fun API (offline? site down?)."
  echo "Try again later, or open https://make.fun in a browser."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 - "$tmp" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception as e:
    print(f"FAIL: response was not JSON: {e}")
    sys.exit(1)
items = data.get("items") or data.get("data") or data.get("competitions") or []
if isinstance(data, list):
    items = data
if not items:
    print("No open bounties found (or unexpected response shape).")
    print(json.dumps(data, indent=2)[:2000])
    sys.exit(0)
for c in items:
    slug = c.get("slug", "?")
    title = c.get("title", "?")
    prize = c.get("rewardAmount") or c.get("prize") or c.get("reward") or c.get("prize_usd") or "?"
    close = c.get("deadline") or c.get("entries_close") or "?"
    print(f"- {slug} | {title} | reward: {prize} | closes: {close}")
print(f"\nTotal open: {len(items)}")
print("Read one bounty first: curl -s https://make.fun/api/competitions/<slug>/requirements")
PY
elif command -v jq >/dev/null 2>&1; then
  jq -r '.data[]? | "- \(.slug) | \(.title) | reward: \(.prize // .reward // "?") | closes: \(.entries_close // .deadline // "?")"' "$tmp"
else
  echo "No python3 or jq found — raw JSON:"
  cat "$tmp"
fi
