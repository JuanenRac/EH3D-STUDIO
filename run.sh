#!/usr/bin/env bash
# Opens Studio in development: ./run.sh [SERVER_URL]  (the server whose API it talks to; default http://127.0.0.1:18200)
set -u
cd "$(dirname "$0")"
pause() { [ -n "${NOPAUSE:-}" ] || { read -r -p "Press Enter to close..." _ || true; }; }
trap pause EXIT
[ -d node_modules ] || npm ci
EH3D_SERVER="${1:-http://127.0.0.1:18200}" npm run dev
