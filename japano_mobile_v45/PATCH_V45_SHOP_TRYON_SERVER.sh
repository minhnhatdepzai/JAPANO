#!/usr/bin/env bash
set -e
python3 - <<'PY'
from pathlib import Path
import time
server = Path('server/index.mjs')
block = Path('japano_mobile_v45/server_routes_v45_shop_tryon_block.mjs')
if not server.exists():
    raise SystemExit('Không thấy server/index.mjs')
if not block.exists():
    raise SystemExit('Không thấy japano_mobile_v45/server_routes_v45_shop_tryon_block.mjs')
text = server.read_text(encoding='utf-8')
if 'JAPANO V45 SHOP TRYON ROUTES START' in text:
    print('[OK] V45 shop tryon routes đã có.')
    raise SystemExit(0)
backup = server.with_suffix('.mjs.bak-v45-shop-%d' % int(time.time()))
backup.write_text(text, encoding='utf-8')
b = block.read_text(encoding='utf-8')
needle = 'function getLanApiUrls()'
if needle in text:
    text = text.replace(needle, b + '\n\n' + needle, 1)
else:
    text = text + '\n\n' + b
server.write_text(text, encoding='utf-8')
print('[OK] Đã patch V45 shop tryon routes.')
print('Backup:', backup)
PY
