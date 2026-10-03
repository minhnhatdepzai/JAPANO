#!/usr/bin/env bash
# Local development services; preserves running processes and existing database.
set -euo pipefail
JAPANO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
JAPANO_TRAIN_PYTHON="${JAPANO_TRAIN_PYTHON:-$HOME/Downloads/fanpage-chatbot/.venv/bin/python}"
JAPANO_IMAGE_PYTHON="${JAPANO_IMAGE_PYTHON:-$HOME/jp/ai/fashn-vton-1.5/.venv/bin/python}"
JAPANO_CHAT_RUN="${JAPANO_CHAT_RUN:-$JAPANO_ROOT/backend/ai_training/runs/chat-lora-20260928}"
for executable in "$JAPANO_TRAIN_PYTHON" "$JAPANO_IMAGE_PYTHON"; do
  [[ -x "$executable" ]] || { echo "Missing Python: $executable"; exit 1; }
done
[[ -f "$JAPANO_CHAT_RUN/report.json" ]] || { echo "Train an adapter first; missing $JAPANO_CHAT_RUN/report.json"; exit 1; }

start_unit() {
  local unit="$1"; shift
  if systemctl --user is-active --quiet "$unit"; then
    echo "$unit already running (configuration preserved)"
  else
    systemd-run --user --collect --unit="$unit" --working-directory="$JAPANO_ROOT" --setenv="PATH=$PATH" "$@"
  fi
}

start_unit japano-chat-adapter "$JAPANO_TRAIN_PYTHON" backend/ai_training/serve_chat_adapter.py --run "$JAPANO_CHAT_RUN"
JAPANO_OLLAMA_BIN="${JAPANO_OLLAMA_BIN:-$HOME/.local/ollama/bin/ollama}"
if [[ -x "$JAPANO_OLLAMA_BIN" ]]; then
  start_unit japano-ollama --setenv=OLLAMA_HOST=127.0.0.1:11434 "$JAPANO_OLLAMA_BIN" serve
else
  echo "Missing Ollama: uploaded swimwear photos need the vision service. Set JAPANO_OLLAMA_BIN."
fi
start_unit japano-backend --setenv=JAPANO_CHAT_LANGGRAPH=1 --setenv=JAPANO_CHAT_ADAPTER_URL=http://127.0.0.1:7866 \
  --setenv="PYTHON_BIN=$JAPANO_IMAGE_PYTHON" --setenv="JAPANO_ACCESSORY_PYTHON=$JAPANO_IMAGE_PYTHON" "$(command -v node)" backend/server.js
start_unit japano-body-analysis "$JAPANO_IMAGE_PYTHON" backend/body_analysis_service.py
start_unit japano-fashn "$JAPANO_IMAGE_PYTHON" backend/fashn_service.py
start_unit japano-motion "$JAPANO_IMAGE_PYTHON" backend/motion_service.py
start_unit japano-storefront-local --setenv=JAPANO_API_ORIGIN=http://127.0.0.1:4100 "$(command -v npm)" --prefix "$JAPANO_ROOT/web" run dev
echo "Storefront: http://localhost:4200 | Admin: http://localhost:4100/admin/"
echo "Read readiness at :4100/api/health, :7862/health, :7863/health, :7864/health, :7866/health."
echo "A running process does not prove its model files are complete."
echo "Uploaded swimwear photos also require qwen3-vl:8b in Ollama; run scripts/check-ai-ready.sh."
