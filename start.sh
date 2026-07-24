#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")" && pwd)"; cd "$project_dir"
[[ -f .env ]] || { echo "Missing .env; copy .env.example and configure it." >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo "Dependencies missing; run scripts/bootstrap.sh." >&2; exit 1; }
set -a; . ./.env; set +a
backend_port="${BACKEND_PORT:-3001}"
frontend_port="${FRONTEND_PORT:-3000}"
for port in "$backend_port" "$frontend_port"; do
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "Port $port is already in use." >&2; exit 1; }
done
if [[ "${MIGRATE_ON_START:-false}" == "true" ]]; then
  [[ "${ALLOW_SCHEMA_MIGRATION:-}" == "1" || "${ALLOW_SCHEMA_MIGRATION:-}" == "true" ]] || { echo "MIGRATE_ON_START requires ALLOW_SCHEMA_MIGRATION=1." >&2; exit 1; }
  bash "$project_dir/scripts/migrate.sh"
  node "$project_dir/backend/create-admin.js"
fi
backend_pid=''; frontend_pid=''
cleanup(){ [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true; [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
(cd backend && npm start) & backend_pid=$!
(cd frontend && BROWSER=none PORT="$frontend_port" REACT_APP_API_URL="http://127.0.0.1:$backend_port/api" ./node_modules/.bin/react-scripts start) & frontend_pid=$!
wait "$backend_pid" "$frontend_pid"
