#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== JAPANO V50 FORCE IMAGE OUTPUT FIX ==="

echo "[1/6] Cài Pillow cho Python fallback..."
if [ -d ".venv" ]; then
  . .venv/bin/activate
  python -m pip install -U pillow requests >/dev/null
else
  python3 -m pip install --user -U pillow requests >/dev/null || true
fi

echo "[2/6] Patch server/index.mjs: chèn route V50 trước V49..."
python3 - <<'PY'
from pathlib import Path
import time

server = Path("server/index.mjs")
block = Path("japano_mobile_v50/server_routes_v50_force_image_output_block.mjs")
if not server.exists():
    raise SystemExit("Không thấy server/index.mjs")
if not block.exists():
    raise SystemExit("Không thấy japano_mobile_v50/server_routes_v50_force_image_output_block.mjs")

text = server.read_text(encoding="utf-8")
if "JAPANO V50 FORCE IMAGE OUTPUT ROUTES START" in text:
    print("[OK] V50 route đã có.")
    raise SystemExit(0)

backup = server.with_suffix(".mjs.bak-v50-%d" % int(time.time()))
backup.write_text(text, encoding="utf-8")

b = block.read_text(encoding="utf-8")
markers = [
    "// ================= JAPANO V49 SHOPEE TRYON UI ROUTES START =================",
    "// ================= JAPANO V48 FORCE TRYON FRONTEND ROUTES START =================",
    "// ================= JAPANO V47 SELECTED PRODUCT ACCESSORY ROUTES START =================",
    "function getLanApiUrls()",
]
for m in markers:
    if m in text:
        text = text.replace(m, b + "\n\n" + m, 1)
        break
else:
    text = text + "\n\n" + b

# Ensure spawn import exists for ESM server files
if "from 'child_process'" not in text and 'from "child_process"' not in text:
    # Insert after first import block when possible
    lines = text.splitlines()
    insert_at = 0
    for i, line in enumerate(lines[:80]):
        if line.strip().startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, "import { spawn } from 'child_process';")
    text = "\n".join(lines) + "\n"
elif "spawn" not in text.split("from 'child_process'")[0][-80:] and "from 'child_process'" in text:
    # If child_process import exists but not spawn, leave it; many servers already import exec/spawn separately.
    pass

server.write_text(text, encoding="utf-8")
print("[OK] Đã patch V50.")
print("Backup:", backup)
PY

echo "[3/6] Kiểm tra còn route /api/v49/mobile/tryon-selected-product..."
grep -RIn "api/v49/mobile/tryon-selected-product\|JAPANO V50 FORCE IMAGE" server/index.mjs | head -20 || true

echo "[4/6] Xong patch."
echo
echo "Bây giờ restart backend:"
echo "cd /home/rd/Downloads/v37"
echo "source .venv/bin/activate"
echo "export PYTHON_BIN=\"\$PWD/.venv/bin/python\""
echo "export JAPANO_AI_GATEWAY_URL=\"http://127.0.0.1:8001\""
echo "npm run start-server"
echo
echo "[5/6] Sau khi backend chạy, test route bằng lệnh trong README."
echo "[6/6] Nếu app vẫn báo Gateway chưa trả ảnh thật nhưng có ảnh preview là đúng: V50 đã fallback."
