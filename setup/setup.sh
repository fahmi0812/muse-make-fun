#!/usr/bin/env bash
# muse-make-fun — full setup for make.fun (https://make.fun)
# Installs the make-fun skill + MCP config for Muse owners and CLI AI agents.
# Idempotent: safe to re-run. It NEVER creates a wallet/keypair, NEVER
# makes a payment, NEVER installs paid things, NEVER asks for a secret.
# Usage:
#   AGENT=muse ./setup/setup.sh
#   AGENT=claude-code ./setup/setup.sh
#   AGENT=codex|cursor|copilot|gemini|opencode|generic ./setup/setup.sh
#   ./setup/setup.sh            # default: generic
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${AGENT:-generic}"
SKILL_SRC="$REPO_DIR/SKILL.md"
SKILL_YAML_SRC="$REPO_DIR/skill.yaml"
MCP_SRC="$REPO_DIR/setup/mcp.json"

echo "== muse-make-fun setup =="
echo "Repo:   $REPO_DIR"
echo "Agent:  $AGENT"
echo

# --- 1. Prereqs (warn, do not install anything paid) -----------------------
fail=0
check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "PASS: $1 found ($(command -v "$1"))"
  else
    echo "FAIL: $1 not found"
    fail=1
  fi
}
check_cmd git
check_cmd curl
check_cmd node
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${node_major:-0}" -ge 22 ]; then
    echo "PASS: node $(node --version) (>= 22)"
  else
    echo "FAIL: node $(node --version) — make.fun kit needs Node >= 22"
    fail=1
  fi
fi
if [ "$fail" -ne 0 ]; then
  echo
  echo "Missing required tools above. Install Node >= 22, git and curl first,"
  echo "then re-run this script. See setup/README.md."
  exit 1
fi
echo

# --- 2. Destination dir per agent ------------------------------------------
case "$AGENT" in
  muse)
    DEST="$HOME/workspace/custom-skills/make-fun"
    ;;
  claude-code)
    DEST="$HOME/.claude/skills/make-fun"
    ;;
  codex)
    DEST="$HOME/.codex/skills/make-fun"
    ;;
  cursor)
    DEST="$HOME/.cursor/skills/make-fun"
    ;;
  copilot)
    DEST="$HOME/.copilot/skills/make-fun"
    ;;
  gemini)
    DEST="$HOME/.gemini/skills/make-fun"
    ;;
  opencode)
    DEST="$HOME/.config/opencode/skills/make-fun"
    ;;
  generic|*)
    if [ "$AGENT" != "generic" ]; then
      echo "Unknown AGENT='$AGENT' — using generic layout."
    fi
    DEST="$HOME/.config/agent-skills/make-fun"
    # Also keep a copy next to the repo when run from a checkout, for
    # agents that read skills from the working directory.
    if [ -w "$REPO_DIR" ]; then
      mkdir -p "$REPO_DIR/skills/make-fun"
    fi
    ;;
esac

mkdir -p "$DEST"
echo "Installing skill to: $DEST"

# --- 3. Copy skill files (only if the repo copy exists) ---------------------
if [ -f "$SKILL_SRC" ]; then
  cp "$SKILL_SRC" "$DEST/SKILL.md"
  echo "Copied: SKILL.md"
else
  echo "WARN: $SKILL_SRC not found (root files are written by another step)."
  echo "      Skill copy skipped — re-run setup after SKILL.md exists."
fi
if [ -f "$SKILL_YAML_SRC" ]; then
  cp "$SKILL_YAML_SRC" "$DEST/skill.yaml"
  echo "Copied: skill.yaml"
fi
if [ -d "$REPO_DIR/references" ]; then
  mkdir -p "$DEST/references"
  cp "$REPO_DIR/references/"*.md "$DEST/references/" 2>/dev/null || true
  echo "Copied: references/*.md"
fi
if [ "$AGENT" = "generic" ] && [ -f "$SKILL_SRC" ]; then
  cp "$SKILL_SRC" "$REPO_DIR/skills/make-fun/SKILL.md"
  echo "Copied: skills/make-fun/SKILL.md (repo-local copy)"
fi
echo

# --- 4. Latest official skill.md (best effort, never fatal) -----------------
LATEST="$REPO_DIR/references/skill-upstream-latest.md"
echo "Fetching latest official skill.md from https://make.fun/skill.md ..."
if curl -fsSL --max-time 30 "https://make.fun/skill.md" -o "$LATEST.tmp" 2>/dev/null; then
  if grep -q '^version:' "$LATEST.tmp" && grep -q 'make.fun' "$LATEST.tmp"; then
    mv "$LATEST.tmp" "$LATEST"
    echo "Saved: references/skill-upstream-latest.md"
    echo "Version: $(grep -m1 '^version:' "$LATEST")"
    cp "$LATEST" "$DEST/references/skill-upstream-latest.md" 2>/dev/null || true
  else
    rm -f "$LATEST.tmp"
    echo "WARN: download did not look like skill.md — kept existing copy."
  fi
else
  rm -f "$LATEST.tmp"
  echo "WARN: could not download skill.md (offline?)."
  echo "      Existing copy in references/ is still usable — run tools/fetch-skill.sh later."
fi
echo

# --- 5. MCP config example ---------------------------------------------------
if [ -f "$MCP_SRC" ]; then
  cp "$MCP_SRC" "$DEST/mcp.json.example"
  echo "Copied: mcp.json.example (edit it, add your key via env var — never hardcode it)"
else
  echo "WARN: $MCP_SRC not found — MCP example skipped."
fi
echo

echo "== Done =="
echo "Skill installed at: $DEST"
echo
echo "Next steps (manual — this script does NOT do them):"
echo "  1. Create / sign in to your make.fun account in a browser: https://make.fun"
echo "  2. Connect your agent to that account (you approve the link yourself)."
echo "     Do NOT create a keypair or wallet unless you have decided to —"
echo "     see docs/06-keamanan-dompet.md in this repo first."
echo "  3. List open bounties: ./tools/list-bounties.sh"
echo "  4. Read the skill: $DEST/SKILL.md"
echo "     and the full guide: guides/panduan-pemula-id.md"
echo "  5. Pick ONE bounty, read its requirements, then build in a recorded session."
echo
echo "Re-run this script any time to update the skill — it is idempotent."
