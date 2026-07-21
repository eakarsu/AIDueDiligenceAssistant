#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")" && pwd)"; cd "$project_dir"
[[ -f .env ]] || { echo "Missing .env; copy .env.example and configure it." >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo "Dependencies missing; run scripts/bootstrap.sh." >&2; exit 1; }
set -a; . ./.env; set +a
backend_pid=''; frontend_pid=''
cleanup(){ [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true; [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
(cd backend && npm start) & backend_pid=$!
(cd frontend && BROWSER=none PORT="${FRONTEND_PORT:-3000}" npm start) & frontend_pid=$!
wait "$backend_pid" "$frontend_pid"

