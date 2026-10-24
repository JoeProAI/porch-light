#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v python3 >/dev/null 2>&1; then
  exec python3 scripts/smoke-national.py "$@"
fi
exec python scripts/smoke-national.py "$@"
