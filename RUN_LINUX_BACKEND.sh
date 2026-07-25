#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -f package.json ]; then
  cd "$(dirname "$(find . -maxdepth 4 -name package.json | head -n 1)")"
fi

source .venv/bin/activate

export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"

npm run start-server
