#!/usr/bin/env bash
# muse-make-fun — full setup for make.fun (https://make.fun)
# Installs the make-fun skill + MCP config example for Muse owners and CLI AI agents.
# Idempotent: safe to re-run. It NEVER creates a wallet/keypair, NEVER
# makes a payment, NEVER installs paid things, NEVER asks for a secret,
# and NEVER writes into the repo checkout (latest downloads go to .cache/).
# Usage:
#   AGENT=muse bash setup/setup.sh
#   AGENT=claude-code bash setup/setup.sh
#   AGENT=codex|cursor|copilot|gemini|opencode|generic bash setup/setup.sh
#   bash setup/setup.sh            # default: generic
# Override the install folder with DEST=/path/to/skills/make-fun.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${AGENT:-generic}"
PINNED="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"

echo "== muse-make-fun setup =="
echo "Repo:    $REPO_DIR"
echo "Agent:   $AGENT"
echo "Pinned:  make.fun skill v$PINNED"
echo

# --- 1. Prereqs (single source: tools/check-prereqs.sh) ---------------------
if ! bash "$REPO_DIR/tools/check-prereqs.sh"; then
  echo
  echo "Missing or wrong required tools above. Install Node 22.18+ (or 23.8+ / 24+),"
  echo "git and curl first, then re-run this script. See setup/README.md."
  exit 1
fi
echo

# --- 2. Destination dir per agent ------------------------------------------
if [ -z "${DEST:-}" ]; then
  case "$AGENT" in
    muse)        DEST="$HOME/workspace/custom-skills/make-fun" ;;
    claude-code) DEST="$HOME/.claude/skills/make-fun" ;;
    codex)       DEST="$HOME/.codex/skills/make-fun" ;;
    cursor)      DEST="$HOME/.cursor/skills/make-fun" ;;
    copilot)     DEST="$HOME/.copilot/skills/make-fun" ;;
    gemini)      DEST="$HOME/.gemini/skills/make-fun" ;;
    opencode)    DEST="$HOME/.config/opencode/skills/make-fun" ;;
    generic)     DEST="$HOME/.config/agent-skills/make-fun" ;;
    *)
      echo "Unknown AGENT='$AGENT' — using generic layout."
      DEST="$HOME/.config/agent-skills/make-fun"
      ;;
  esac
fi

mkdir -p "$DEST"
echo "Installing skill to: $DEST"

# --- 3. Copy skill files -----------------------------------------------------
# SKILL.md points at docs/ and tools/, so they are installed next to it.
cp "$REPO_DIR/SKILL.md" "$DEST/SKILL.md"
cp "$REPO_DIR/skill.yaml" "$DEST/skill.yaml"
cp "$REPO_DIR/VERSION" "$DEST/VERSION"
echo "Copied: SKILL.md, skill.yaml, VERSION"
for dir in references docs tools; do
  rm -rf "${DEST:?}/$dir"
  cp -R "$REPO_DIR/$dir" "$DEST/$dir"
  echo "Copied: $dir/"
done
# Old pinned copies from earlier installs are gone because each dir is replaced.
echo

# --- 4. Latest official skill.md (best effort, never fatal) -----------------
echo "Checking the latest official skill.md ..."
if MF_CACHE_DIR="$DEST/.cache" bash "$REPO_DIR/tools/fetch-skill.sh"; then
  :
else
  echo "WARN: could not check https://make.fun/skill.md (offline?)."
  echo "      The pinned copy in references/ is still usable — run tools/fetch-skill.sh later."
fi
echo

# --- 5. MCP config example ---------------------------------------------------
cp "$REPO_DIR/setup/mcp.json" "$DEST/mcp.json.example"
echo "Copied: mcp.json.example (add your key via the MAKEFUN_API_KEY env var — never hardcode it)"
echo

echo "== Done =="
echo "Skill installed at: $DEST"
echo
echo "Next steps (manual — this script does NOT do them):"
echo "  1. Create / sign in to your make.fun account in a browser: https://make.fun"
echo "  2. Connect your agent to that account (you approve the link yourself)."
echo "     Do NOT create a keypair or wallet unless you have decided to —"
echo "     see docs/06-keamanan-dompet.md in this repo first."
echo "  3. List open bounties: bash tools/list-bounties.sh"
echo "  4. Read the skill: $DEST/SKILL.md"
echo "     and the full guide: guides/panduan-pemula-id.md"
echo "  5. Pick ONE bounty, read its requirements, then build in a recorded session."
echo
echo "Re-run this script any time to update the skill — it is idempotent."
