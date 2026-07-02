#!/usr/bin/env bash
set -e

ROOT="/home/nhat/Downloads/v37"
AI="/home/nhat/jp/ai"
CAT="$AI/CatVTON"

echo "=== 1) Cài gói hệ thống ==="
sudo apt update
sudo apt install -y git git-lfs python3-venv python3-pip ffmpeg libgl1 libglib2.0-0

mkdir -p "$AI"

echo "=== 2) Clone CatVTON official ==="
if [ ! -d "$CAT" ]; then
  git clone https://github.com/Zheng-Chong/CatVTON.git "$CAT"
fi

cd "$CAT"

echo "=== 3) Tạo venv CatVTON ==="
python3 -m venv .venv
source .venv/bin/activate

echo "=== 4) Cài Python package ==="
python -m pip install -U pip setuptools wheel
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 || \
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

python -m pip install -r requirements.txt
python -m pip install gradio pillow opencv-python-headless fastapi uvicorn python-multipart requests

echo "=== 5) Check GPU ==="
python - <<'PY'
import torch
print("TORCH =", torch.__version__)
print("CUDA =", torch.cuda.is_available())
print("GPU =", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "NO CUDA")
PY

echo "=== 6) Chạy CatVTON thật ==="
echo "Mở trình duyệt: http://127.0.0.1:7860"
CUDA_VISIBLE_DEVICES=0 python app.py \
  --output_dir="resource/demo/output" \
  --mixed_precision="bf16" \
  --allow_tf32
