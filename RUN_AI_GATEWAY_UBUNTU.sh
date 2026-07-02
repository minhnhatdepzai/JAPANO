#!/usr/bin/env bash
set -e

cd /home/rd/Downloads/v37/japano_v41

echo "=== Stop port 8001 nếu đang kẹt ==="
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8001/tcp || true
fi

echo "=== Tạo venv AI Gateway ==="
python3 -m venv .venv
source .venv/bin/activate

echo "=== Cài package Gateway ==="
python -m pip install -U pip setuptools wheel
python -m pip install -r requirements_v41.txt
python -m pip install fastapi uvicorn pillow python-multipart requests numpy opencv-python-headless

echo "=== Start AI Gateway :8001 ==="
python -m uvicorn gateway_v41:app --host 0.0.0.0 --port 8001
