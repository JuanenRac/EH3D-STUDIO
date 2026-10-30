#!/usr/bin/env bash
# PRETTY_RUN_BEGIN
if [ -z "${PRETTY_RUN:-}" ] && [ -f "$(dirname "$0")/tools/pretty_run.py" ] && command -v python3 >/dev/null 2>&1; then
    NOPAUSE=1 PRETTY_RUN=1 exec python3 "$(dirname "$0")/tools/pretty_run.py" --wrap --mode "${PRETTY_MODE:-build}" -- bash "$0" "$@"
fi
# PRETTY_RUN_END
# EH3D-STUDIO: installs what it needs (npm ci) the first time and builds the pages into dist/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[ -d node_modules ] || npm ci
npm run build
