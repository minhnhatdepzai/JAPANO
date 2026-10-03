#!/usr/bin/env bash
# One-command local JAPANO runtime; services survive this terminal.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec python3 scripts/run_all.py "$@"
