#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "=== JAPANO V51 HARDCODE TRY-ON PARAMS ==="
echo "Set cứng: steps=60, cfg=3.5, seed=70 cho thử đồ + phụ kiện trong app JAPANO."

SERVER="$ROOT/server/index.mjs"
if [ ! -f "$SERVER" ]; then
  echo "[ERROR] Không thấy server/index.mjs. Hãy copy zip này vào thư mục project /home/rd/Downloads/v37 rồi chạy."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re, time

server = Path('server/index.mjs')
s = server.read_text(encoding='utf-8')
backup = server.with_suffix('.mjs.bak-v51-hardcode-%d' % int(time.time()))
backup.write_text(s, encoding='utf-8')

CONST = """
// ================= JAPANO V51 HARDCODE TRYON PARAMS START =================
// User requested fixed quality parameters for every try-on case, including accessories.
const JAPANO_V51_TRYON_FIXED_PARAMS = Object.freeze({
  inferenceSteps: 60,
  numInferenceSteps: 60,
  steps: 60,
  cfg: 3.5,
  guidanceScale: 3.5,
  seed: 70,
  fixedTryOnParams: true,
  applyToAccessories: true,
  accessoryMode: true,
});
// ================= JAPANO V51 HARDCODE TRYON PARAMS END =================
"""

if 'JAPANO V51 HARDCODE TRYON PARAMS START' not in s:
    markers = [
        '// ================= JAPANO V50 FORCE IMAGE OUTPUT ROUTES START =================',
        '// ================= JAPANO V49 SHOPEE TRYON UI ROUTES START =================',
        '// ================= JAPANO V48 FORCE TRYON FRONTEND ROUTES START =================',
    ]
    for m in markers:
        if m in s:
            s = s.replace(m, CONST + '\n' + m, 1)
            break
    else:
        # put after import block
        lines = s.splitlines()
        idx = 0
        for i, line in enumerate(lines[:120]):
            if line.strip().startswith('import '): idx = i+1
        lines.insert(idx, CONST)
        s = '\n'.join(lines) + '\n'

# Remove old duplicate spread lines we may have added to avoid repeated keys.
s = re.sub(r'\n\s*\.\.\.JAPANO_V51_TRYON_FIXED_PARAMS,\s*', '\n', s)

# Add params to every advanced try-on request object. This catches both V49 and V50 blocks.
needle = "consistencyPolicy: 'first-image-anchor',"
if needle in s:
    s = s.replace(needle, needle + "\n        ...JAPANO_V51_TRYON_FIXED_PARAMS,")

# Add params also near prompts for V50/V49 if consistency line variant changes.
needle2 = "anchorIdentity: 'uploaded-person-is-source',"
if needle2 in s and '...JAPANO_V51_TRYON_FIXED_PARAMS' not in s[s.find(needle2):s.find(needle2)+500]:
    s = s.replace(needle2, needle2 + "\n        ...JAPANO_V51_TRYON_FIXED_PARAMS,", 1)

# Replace low fallback steps, and add cfg/seed for generate realistic fallback.
s = s.replace('steps: 4,', 'steps: JAPANO_V51_TRYON_FIXED_PARAMS.steps,\n          cfg: JAPANO_V51_TRYON_FIXED_PARAMS.cfg,\n          guidanceScale: JAPANO_V51_TRYON_FIXED_PARAMS.guidanceScale,\n          seed: JAPANO_V51_TRYON_FIXED_PARAMS.seed,')
s = s.replace('steps: 30,', 'steps: JAPANO_V51_TRYON_FIXED_PARAMS.steps,\n          cfg: JAPANO_V51_TRYON_FIXED_PARAMS.cfg,\n          guidanceScale: JAPANO_V51_TRYON_FIXED_PARAMS.guidanceScale,\n          seed: JAPANO_V51_TRYON_FIXED_PARAMS.seed,')

# Add explicit accessory instruction to prompts.
accessory_line = "'Attach accessories naturally: umbrella in hand, necklace on neck, headscarf on head/hair, watch/bracelet on wrist, bag on shoulder/hand, glasses on eyes.',"
if accessory_line in s and 'Use fixed try-on parameters: steps 60, CFG 3.5, seed 70.' not in s:
    s = s.replace(accessory_line, accessory_line + "\n          'Use fixed try-on parameters: steps 60, CFG 3.5, seed 70 for clothing and accessories.',")

# Ensure response debug contains params for route responses.
# We avoid complex JSON insertion if absent; add params near debug object when available.
s = s.replace('v50ForcedRoute: true,', 'v50ForcedRoute: true,\n        fixedTryOnParams: JAPANO_V51_TRYON_FIXED_PARAMS,')

server.write_text(s, encoding='utf-8')
print('[OK] Patched', server)
print('[OK] Backup:', backup)
print('[OK] Fixed params: steps=60 cfg=3.5 seed=70')
PY

echo
echo "=== Kiểm tra patch trong server/index.mjs ==="
grep -RIn "JAPANO_V51_TRYON_FIXED_PARAMS\|steps: JAPANO_V51\|cfg: JAPANO_V51\|seed: JAPANO_V51\|Use fixed try-on parameters" server/index.mjs | head -60 || true

echo
echo "=== Patch CatVTON simple web nếu file có tồn tại ==="
CAT="/home/rd/jp/ai/CatVTON/japano_catvton_simple_web.py"
if [ -f "$CAT" ]; then
  python3 - <<'PY'
from pathlib import Path
import re, time
p = Path('/home/rd/jp/ai/CatVTON/japano_catvton_simple_web.py')
s = p.read_text(encoding='utf-8')
b = p.with_suffix('.py.bak-v51-hardcode-%d' % int(time.time()))
b.write_text(s, encoding='utf-8')

# UI defaults
s = re.sub(r'name="steps" type="number" value="[^"]+"', 'name="steps" type="number" value="60" readonly', s)
s = re.sub(r'name="cfg" type="number" value="[^"]+"', 'name="cfg" type="number" value="3.5" readonly', s)
s = re.sub(r'name="seed" type="number" value="[^"]+"', 'name="seed" type="number" value="70" readonly', s)

# hard force inside endpoint after function starts / try block.
if 'JAPANO V51 hardcode params' not in s:
    s = s.replace('try:\n        person_path = await save_upload(person, "person")', 'try:\n        # JAPANO V51 hardcode params: apply to all CatVTON try-on calls\n        steps = 60\n        cfg = 3.5\n        seed = 70\n        person_path = await save_upload(person, "person")')

# replace any existing direct values if present
s = s.replace('int(steps),\n            float(cfg),\n            int(seed),', '60,\n            3.5,\n            70,')

p.write_text(s, encoding='utf-8')
print('[OK] Patched', p)
print('[OK] Backup:', b)
PY
else
  echo "[SKIP] Chưa thấy $CAT. Nếu bạn tạo web 7861 sau này, chạy lại script V51 này."
fi

echo
echo "=== XONG V51 ==="
echo "Restart backend JAPANO:"
echo "cd /home/rd/Downloads/v37"
echo "source .venv/bin/activate"
echo "export PYTHON_BIN=\"\$PWD/.venv/bin/python\""
echo "export JAPANO_AI_GATEWAY_URL=\"http://127.0.0.1:8001\""
echo "npm run start-server"
echo
echo "Nếu dùng CatVTON simple web 7861 thì restart lại web đó để nhận 60 / 3.5 / 70."
