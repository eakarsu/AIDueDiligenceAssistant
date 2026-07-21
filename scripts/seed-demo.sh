#!/usr/bin/env bash
set -euo pipefail
[[ "${CONFIRM_DEMO_SEED:-}" == "yes" ]] || { echo "Refusing destructive seed. Set CONFIRM_DEMO_SEED=yes only for an isolated demo database." >&2; exit 1; }
project_dir="$(cd "$(dirname "$0")/.." && pwd)"; cd "$project_dir/backend"; node seed.js

