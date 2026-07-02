#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

chmod +x ./japano_mobile_v47/PATCH_V47_SELECTED_PRODUCT_SERVER.sh
./japano_mobile_v47/PATCH_V47_SELECTED_PRODUCT_SERVER.sh

echo
echo "[1/4] Cài expo-image-picker nếu thiếu..."
npx expo install expo-image-picker

echo
echo "[2/4] Tự thay screen thử đồ cũ sang V47..."
TRYON_FILE="$(grep -RIl "Ảnh sản phẩm / đồ mẫu\|Chọn ảnh sản phẩm\|Hoặc dán link ảnh sản phẩm\|thu-do-ai-v44\|thu-do-ai-v45-shop\|Thử đồ AI Shop V45\|Thử đồ AI V44" app src components 2>/dev/null | grep -v "thu-do-ai-v47-selected-product" | head -n 1 || true)"
echo "TRYON_FILE=$TRYON_FILE"

if [ -n "$TRYON_FILE" ]; then
  cp "$TRYON_FILE" "$TRYON_FILE.bak-v47"
  export TRYON_FILE
  python3 - <<'PY'
from pathlib import Path
import os
target = Path(os.environ["TRYON_FILE"])
src = Path("app/thu-do-ai-v47-selected-product.tsx")
rel = os.path.relpath(src.with_suffix(""), target.parent).replace("\\", "/")
if not rel.startswith("."):
    rel = "./" + rel
target.write_text(f"export {{ default }} from '{rel}';\n", encoding="utf-8")
print("[OK] Đã thay screen thử đồ cũ sang V47:", target)
print("Import:", rel)
PY
else
  echo "[WARN] Không tự tìm thấy screen cũ. Hãy import app/thu-do-ai-v47-selected-product.tsx vào route thử đồ."
fi

echo
echo "[3/4] Done patch. Restart backend rồi seed phụ kiện V47 bằng:"
echo "curl -X POST http://127.0.0.1:4000/api/v47/shop/seed-extra-accessories -H 'Content-Type: application/json' -d '{}'"
echo
echo "[4/4] Khi bấm thử đồ từ trang sản phẩm, route nên truyền productId sang màn hình:"
echo "router.push({ pathname: '/thu-do-ai-v47-selected-product', params: { productId: product._id || product.id } })"
