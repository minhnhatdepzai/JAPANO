#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -f package.json ]; then
  cd "$(dirname "$(find . -maxdepth 4 -name package.json | head -n 1)")"
fi

export EXPO_PUBLIC_API_URL="http://localhost:4000"

npx expo start --web -c
