#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== JAPANO V49 SHOPEE TRYON UI PATCH ==="

echo "[1/7] Patch backend V49 routes..."
python3 - <<'PY'
from pathlib import Path
import time
server = Path('server/index.mjs')
block = Path('japano_mobile_v49/server_routes_v49_shopee_tryon_ui_block.mjs')
if not server.exists():
    raise SystemExit('Không thấy server/index.mjs')
if not block.exists():
    raise SystemExit('Không thấy japano_mobile_v49/server_routes_v49_shopee_tryon_ui_block.mjs')
text = server.read_text(encoding='utf-8')
if 'JAPANO V49 SHOPEE TRYON UI ROUTES START' not in text:
    backup = server.with_suffix('.mjs.bak-v49-%d' % int(time.time()))
    backup.write_text(text, encoding='utf-8')
    b = block.read_text(encoding='utf-8')
    needle = 'function getLanApiUrls()'
    if needle in text:
        text = text.replace(needle, b + '\n\n' + needle, 1)
    else:
        text = text + '\n\n' + b
    server.write_text(text, encoding='utf-8')
    print('[OK] Đã patch backend V49. Backup:', backup)
else:
    print('[OK] Backend đã có V49 routes.')
PY

echo "[2/7] Cài expo-image-picker..."
npx expo install expo-image-picker

echo "[3/7] Tạo alias route thử đồ cũ -> V49..."
python3 - <<'PY'
from pathlib import Path
import os, shutil

src = Path('app/thu-do-ai-v49-shop-flow.tsx')
aliases = [
    Path('app/thu-do-ai-v44.tsx'),
    Path('app/thu-do-ai-v45-shop.tsx'),
    Path('app/thu-do-ai-v47-selected-product.tsx'),
    Path('app/thu-do-ai-v48-force.tsx'),
]
for a in aliases:
    if a.exists():
        shutil.copy(a, a.with_suffix(a.suffix + '.bak-v49'))
    rel = os.path.relpath(src.with_suffix(''), a.parent).replace("\\", "/")
    if not rel.startswith("."):
        rel = "./" + rel
    a.write_text(f"export {{ default }} from '{rel}';\n", encoding='utf-8')
    print('[OK] alias', a, '->', rel)
PY

echo "[4/7] Ép thay các screen thử đồ cũ còn chứa ô chọn ảnh sản phẩm..."
python3 - <<'PY'
from pathlib import Path
import os, shutil
src = Path('app/thu-do-ai-v49-shop-flow.tsx')
patterns = [
    'Ảnh sản phẩm / đồ mẫu',
    'Chọn ảnh sản phẩm',
    'Hoặc dán link ảnh sản phẩm',
    'Ảnh sản phẩm',
    'productImageBase64',
    'garmentImageBase64',
    'garmentImageUrl',
    'Thử đồ AI V44',
    'Thử đồ AI Shop V45',
    'Thử đồ AI Shop V48',
]
roots = [Path('app'), Path('src'), Path('components')]
changed = []
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob('*'):
        if p.suffix.lower() not in ['.tsx', '.ts', '.jsx', '.js']:
            continue
        if p.name in ['thu-do-ai-v49-shop-flow.tsx', 'product-detail-v49-shopee.tsx']:
            continue
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue
        if any(x in text for x in patterns) and ('Thử đồ' in text or 'tryon' in str(p).lower() or 'try-on' in str(p).lower()):
            shutil.copy(p, p.with_suffix(p.suffix + '.bak-v49-force'))
            rel = os.path.relpath(src.with_suffix(''), p.parent).replace("\\", "/")
            if not rel.startswith("."):
                rel = "./" + rel
            p.write_text(f"export {{ default }} from '{rel}';\n", encoding='utf-8')
            changed.append(str(p))
print('[OK] try-on files replaced:', len(changed))
for x in changed:
    print(' -', x)
PY

echo "[5/7] Tạo route chi tiết sản phẩm Shopee-like..."
python3 - <<'PY'
from pathlib import Path
import os, shutil

src = Path('app/product-detail-v49-shopee.tsx')
candidate_names = [
    'product-detail.tsx', 'productDetail.tsx', 'product.tsx',
    'chi-tiet-san-pham.tsx', 'san-pham.tsx',
]
created = []
for name in candidate_names:
    p = Path('app') / name
    if p.exists():
        shutil.copy(p, p.with_suffix(p.suffix + '.bak-v49-product'))
        rel = os.path.relpath(src.with_suffix(''), p.parent).replace("\\", "/")
        if not rel.startswith("."):
            rel = "./" + rel
        p.write_text(f"export {{ default }} from '{rel}';\n", encoding='utf-8')
        created.append(str(p))
print('[INFO] product detail aliases replaced:', created)
print('[INFO] Nếu app dùng route khác, hãy mở app/product-detail-v49-shopee trực tiếp hoặc gửi grep bên dưới.')
PY

echo "[6/7] Seed phụ kiện nếu backend đang chạy..."
if curl -s http://127.0.0.1:4000/api/v49/shop/products >/dev/null 2>&1; then
  curl -X POST "http://127.0.0.1:4000/api/v49/shop/seed-extra-accessories" -H "Content-Type: application/json" -d "{}" || true
else
  echo "[INFO] Backend chưa chạy. Sau khi restart backend, chạy:"
  echo "curl -X POST http://127.0.0.1:4000/api/v49/shop/seed-extra-accessories -H 'Content-Type: application/json' -d '{}'"
fi

echo "[7/7] DONE."
echo
echo "Restart backend, seed accessories, rồi rebuild app nếu vẫn thấy giao diện cũ."
echo
echo "Lệnh kiểm tra UI cũ còn sót:"
echo "grep -RIn \"Chọn ảnh sản phẩm\\|Hoặc dán link ảnh sản phẩm\\|Ảnh sản phẩm / đồ mẫu\" app src components 2>/dev/null"
echo
echo "Lệnh tìm route sản phẩm cần gắn nút thử đồ:"
echo "grep -RIn \"Thử đồ\\|Mua ngay\\|Thêm giỏ\\|Chi tiết sản phẩm\" app src components 2>/dev/null | head -80"
