#!/usr/bin/env bash
set -e

ROOT="/home/rd/Downloads/v37"
GW="$ROOT/japano_v41"
MODELS="/home/rd/jp/ai/v41/models"

cd "$ROOT"

echo "=== 1) Tao thu muc model Linux ==="
mkdir -p "$MODELS"
mkdir -p "$MODELS/sdxl-turbo" "$MODELS/catvton" "$MODELS/birefnet"

echo "=== 2) Patch gateway_v41.py: C:\\jp\\ai -> /home/rd/jp/ai ==="
python3 - <<'PY'
from pathlib import Path
import re

p = Path("/home/rd/Downloads/v37/japano_v41/gateway_v41.py")
s = p.read_text(encoding="utf-8")

if "import os" not in s[:500]:
    s = "import os\n" + s

# thay các kiểu path Windows thường gặp
for old in [
    r"C:\\jp\\ai\\v41\\models",
    r"C:\jp\ai\v41\models",
    "C:/jp/ai/v41/models",
    "C:\\\\jp\\\\ai\\\\v41\\\\models",
]:
    s = s.replace(old, "/home/rd/jp/ai/v41/models")

# nếu có biến MODELS_DIR thì ép dùng env Linux
s = re.sub(
    r"MODELS_DIR\s*=\s*Path\([^\n]+\)",
    'MODELS_DIR = Path(os.environ.get("JAPANO_MODELS_DIR", "/home/rd/jp/ai/v41/models"))',
    s
)

p.write_text(s, encoding="utf-8")
print("[OK] patched", p)
PY

echo "=== 3) Tao venv Gateway ==="
cd "$GW"
python3 -m venv .venv
source .venv/bin/activate

echo "=== 4) Cai package ==="
python -m pip install -U pip setuptools wheel
python -m pip install -r requirements_v41.txt
python -m pip install -U "huggingface_hub[hf_xet]" hf_transfer diffusers transformers accelerate safetensors pillow opencv-python-headless fastapi uvicorn python-multipart requests numpy

echo "=== 5) Cai PyTorch CUDA, thu cu128 roi fallback cu126 ==="
python -m pip uninstall -y torch torchvision torchaudio || true
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 || \
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

echo "=== 6) Check GPU ==="
python - <<'PY'
import torch
print("TORCH =", torch.__version__)
print("CUDA =", torch.cuda.is_available())
print("GPU =", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "NO CUDA")
PY

echo "=== 7) Tai model SDXL / CatVTON / BiRefNet ==="
export HF_HUB_ENABLE_HF_TRANSFER=1

python - <<'PY'
from huggingface_hub import snapshot_download

models = [
    ("stabilityai/sdxl-turbo", "/home/rd/jp/ai/v41/models/sdxl-turbo"),
    ("zhengchong/CatVTON", "/home/rd/jp/ai/v41/models/catvton"),
    ("ZhengPeng7/BiRefNet", "/home/rd/jp/ai/v41/models/birefnet"),
]

for repo, out in models:
    print("\n[DOWNLOAD]", repo, "->", out)
    try:
        snapshot_download(
            repo_id=repo,
            local_dir=out,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print("[OK]", repo)
    except Exception as e:
        print("[FAIL]", repo, e)
PY

echo "=== 8) Model folders ==="
ls -lah /home/rd/jp/ai/v41/models

echo "=== 9) Start AI Gateway :8001 ==="
fuser -k 8001/tcp || true
export JAPANO_MODELS_DIR="/home/rd/jp/ai/v41/models"
export HF_HOME="/home/rd/jp/ai/hf-cache"
python -m uvicorn gateway_v41:app --host 0.0.0.0 --port 8001
