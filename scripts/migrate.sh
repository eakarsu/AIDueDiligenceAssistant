#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"; cd "$project_dir"
[[ -f .env ]] || { echo "Missing .env" >&2; exit 1; }; set -a; . ./.env; set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
for migration in backend/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
