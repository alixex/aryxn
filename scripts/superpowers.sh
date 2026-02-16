#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME="$ROOT"
cd "$ROOT"

# Usage: ./scripts/superpowers.sh <skill-name>
# Examples:
#   ./scripts/superpowers.sh brainstorming
#   ./scripts/superpowers.sh writing-plans
#   ./scripts/superpowers.sh test-driven-development
#   ./scripts/superpowers.sh using-git-worktrees

if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/superpowers.sh <skill-name>"
  echo ""
  echo "Available skills:"
  ls -1 .codex/superpowers/skills/ | sed 's/^/  superpowers:/'
  exit 0
fi

SKILL="superpowers:$1"
.codex/superpowers/.codex/superpowers-codex use-skill "$SKILL"
