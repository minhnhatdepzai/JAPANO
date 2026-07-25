#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== V48 FORCE TRYON FRONTEND FIX ==="

echo "[1/6] Patch backend V48 routes..."
python3 - <<'PY'
from pathlib import Path
import time
server = Path('server/index.mjs')
block = Path('japano_mobile_v48/server_routes_v48_force_tryon_frontend_block.mjs')
if not server.exists():
    raise SystemExit('Không thấy server/index.mjs')
if not block.exists():
    raise SystemExit('Không thấy japano_mobile_v48/server_routes_v48_force_tryon_frontend_block.mjs')
text = server.read_text(encoding='utf-8')
if 'JAPANO V48 FORCE TRYON FRONTEND ROUTES START' not in text:
    backup = server.with_suffix('.mjs.bak-v48-%d' % int(time.time()))
    backup.write_text(text, encoding='utf-8')
    b = block.read_text(encoding='utf-8')
    needle = 'function getLanApiUrls()'
    if needle in text:
        text = text.replace(needle, b + '\n\n' + needle, 1)
    else:
        text = text + '\n\n' + b
    server.write_text(text, encoding='utf-8')
    print('[OK] Đã patch backend V48. Backup:', backup)
else:
    print('[OK] Backend đã có V48 routes.')
PY

echo "[2/6] Cài expo-image-picker nếu thiếu..."
npx expo install expo-image-picker

echo "[3/6] Tạo alias để mọi route cũ đều mở V48..."
python3 - <<'PY'
from pathlib import Path
import os, shutil

src = Path('app/thu-do-ai-v48-force.tsx')
if not src.exists():
    raise SystemExit('Không thấy app/thu-do-ai-v48-force.tsx')

aliases = [
    Path('app/thu-do-ai-v44.tsx'),
    Path('app/thu-do-ai-v45-shop.tsx'),
    Path('app/thu-do-ai-v47-selected-product.tsx'),
]

for a in aliases:
    if a.exists():
        shutil.copy(a, a.with_suffix(a.suffix + '.bak-v48-alias'))
    rel = os.path.relpath(src.with_suffix(''), a.parent).replace("\\", "/")
    if not rel.startswith("."):
        rel = "./" + rel
    a.write_text(f"export {{ default }} from '{rel}';\n", encoding='utf-8')
    print('[OK] alias', a, '->', rel)
PY

echo "[4/6] Ép thay các file frontend try-on cũ còn chứa ô chọn ảnh sản phẩm..."
python3 - <<'PY'
from pathlib import Path
import os, shutil, time

src = Path('app/thu-do-ai-v48-force.tsx')
patterns = [
    'Ảnh sản phẩm / đồ mẫu',
    'Chọn ảnh sản phẩm',
    'Hoặc dán link ảnh sản phẩm',
    'Phụ kiện bổ sung',
    'Thử đồ AI V44',
    'Thử đồ AI Shop V45',
    'productImageBase64',
    'garmentImageBase64',
    'garmentImageUrl',
]

roots = [Path('app'), Path('src'), Path('components')]
changed = []
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob('*'):
        if p.suffix.lower() not in ['.tsx', '.ts', '.jsx', '.js']:
            continue
        if p.name == 'thu-do-ai-v48-force.tsx':
            continue
        try:
            text = p.read_text(encoding='utf-8')
        except Exception:
            continue
        if any(x in text for x in patterns):
            backup = p.with_suffix(p.suffix + '.bak-v48-force')
            shutil.copy(p, backup)
            rel = os.path.relpath(src.with_suffix(''), p.parent).replace("\\", "/")
            if not rel.startswith("."):
                rel = "./" + rel
            p.write_text(f"export {{ default }} from '{rel}';\n", encoding='utf-8')
            changed.append(str(p))

print('[OK] files replaced:', len(changed))
for x in changed:
    print(' -', x)
if not changed:
    print('[WARN] Không tìm thấy file cũ chứa text. Nếu app vẫn cũ, gửi kết quả grep.')
PY

echo "[5/6] Seed thêm phụ kiện V48 nếu backend đang chạy..."
if curl -s http://127.0.0.1:4000/api/health >/dev/null 2>&1 || curl -s http://127.0.0.1:4000 >/dev/null 2>&1; then
  curl -X POST "http://127.0.0.1:4000/api/v48/shop/seed-extra-accessories" -H "Content-Type: application/json" -d "{}" || true
else
  echo "[INFO] Backend chưa chạy. Sau khi restart backend, chạy:"
  echo "curl -X POST http://127.0.0.1:4000/api/v48/shop/seed-extra-accessories -H 'Content-Type: application/json' -d '{}'"
fi

echo "[6/6] Xong. Hãy restart backend và rebuild/reload app."
echo "Nếu vẫn còn giao diện cũ, chạy:"
echo "grep -RIn \"Chọn ảnh sản phẩm\|Hoặc dán link ảnh sản phẩm\|Ảnh sản phẩm / đồ mẫu\" app src components 2>/dev/null"
