#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -f package.json ]; then
  cd "$(dirname "$(find . -maxdepth 4 -name package.json | head -n 1)")"
fi

echo "=== JAPANO Linux Setup ==="
pwd

rm -rf node_modules .expo
rm -rf android/.gradle android/build android/app/build android/app/.cxx

npm install --legacy-peer-deps

python3 -m venv .venv
source .venv/bin/activate

python -m pip install -U pip setuptools wheel

if [ -f requirements.txt ]; then
  pip install -r requirements.txt
fi

if [ -f server/requirements.txt ]; then
  pip install -r server/requirements.txt
fi

npx expo install react-dom react-native-web @expo/metro-runtime

echo "=== DONE Linux setup ==="
