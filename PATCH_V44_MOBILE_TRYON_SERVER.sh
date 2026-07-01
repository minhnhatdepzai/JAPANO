#!/usr/bin/env bash
set -e
python3 - <<'PY'
from pathlib import Path
import time
root = Path('.').resolve()
server = root / 'server' / 'index.mjs'
block = root / 'japano_mobile_v44' / 'server_routes_v44_mobile_tryon_block.mjs'
if not server.exists():
    raise SystemExit(f'Khong tim thay {server}')
if not block.exists():
    raise SystemExit(f'Khong tim thay {block}')
text = server.read_text(encoding='utf-8')
if 'JAPANO V44 MOBILE TRYON ROUTES START' in text:
    print('[OK] V44 mobile tryon routes da ton tai.')
    raise SystemExit(0)
backup = server.with_suffix('.mjs.bak-v44-linux-%d' % int(time.time()))
backup.write_text(text, encoding='utf-8')
b = block.read_text(encoding='utf-8')
needle = 'function getLanApiUrls()'
if needle in text:
    text = text.replace(needle, b + '\n\n' + needle, 1)
else:
    text = text + '\n\n' + b
server.write_text(text, encoding='utf-8')
print('[OK] Da patch V44 mobile tryon routes.')
print('Backup:', backup)
PY
