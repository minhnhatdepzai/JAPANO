#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import json, urllib.request
checks=[('Try-on','http://127.0.0.1:7862/health',lambda d:d.get('modelReady') and d.get('poseEditorReady')),
        ('Motion','http://127.0.0.1:7864/health',lambda d:d.get('ok')),
        ('Uploaded-photo vision','http://127.0.0.1:11434/api/tags',lambda d:any(m.get('name')=='qwen3-vl:8b' for m in d.get('models',[])))]
ready=True
for name,url,check in checks:
    try:
        data=json.load(urllib.request.urlopen(url,timeout=5));ok=bool(check(data))
    except Exception:ok=False
    ready=ready and ok
    print(f'{name}: {"READY" if ok else "NOT READY"}')
raise SystemExit(0 if ready else 1)
PY
