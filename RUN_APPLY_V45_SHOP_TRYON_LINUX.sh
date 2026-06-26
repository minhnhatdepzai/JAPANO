#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

chmod +x ./japano_mobile_v45/PATCH_V45_SHOP_TRYON_SERVER.sh
./japano_mobile_v45/PATCH_V45_SHOP_TRYON_SERVER.sh

echo
echo "[1/3] Cài expo-image-picker nếu thiếu..."
npx expo install expo-image-picker

echo
echo "[2/3] Tìm screen thử đồ cũ..."
TRYON_FILE="$(grep -RIl "Thử đồ AI\|Demo Mode\|AAE\|credit\|tryon\|try-on" app src components 2>/dev/null | grep -v "thu-do-ai-v44" | grep -v "thu-do-ai-v45-shop" | head -n 1 || true)"
echo "TRYON_FILE=$TRYON_FILE"

if [ -n "$TRYON_FILE" ]; then
  cp "$TRYON_FILE" "$TRYON_FILE.bak-v45-shop"
  export TRYON_FILE
  python3 - <<'PY'
from pathlib import Path
import os
target = Path(os.environ["TRYON_FILE"])
src = Path("app/thu-do-ai-v45-shop.tsx")
rel = os.path.relpath(src.with_suffix(""), target.parent).replace("\\", "/")
if not rel.startswith("."):
    rel = "./" + rel
target.write_text(f"export {{ default }} from '{rel}';\n", encoding="utf-8")
print("[OK] Đã thay screen thử đồ cũ sang V45 Shop:", target)
print("Import:", rel)
PY
else
  echo "[WARN] Không tự tìm thấy screen cũ. Bạn có thể mở trực tiếp app/thu-do-ai-v45-shop.tsx hoặc tự import vào route."
fi

echo
echo "[3/3] Done. Restart backend và rebuild/reload app."
