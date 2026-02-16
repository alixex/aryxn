#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME="$ROOT"
cd "$ROOT"

pnpm dlx skills "$@"
