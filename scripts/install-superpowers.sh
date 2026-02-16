#!/usr/bin/env bash
set -euo pipefail

# Clone or update obra/superpowers into the project-local .codex directory.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/.codex/superpowers"
REPO_URL="https://github.com/obra/superpowers.git"

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }

mkdir -p "$ROOT_DIR/.codex"

if [ -d "$TARGET_DIR/.git" ]; then
  echo "Updating superpowers in $TARGET_DIR"
  git -C "$TARGET_DIR" pull --ff-only
else
  echo "Cloning superpowers into $TARGET_DIR"
  rm -rf "$TARGET_DIR"
  git clone "$REPO_URL" "$TARGET_DIR"
fi

echo "Superpowers fetched. Next, run:"
echo "  .codex/superpowers/.codex/superpowers-codex bootstrap"
echo "and follow the prompts to enable the skills for this repo."
