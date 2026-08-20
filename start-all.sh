#!/usr/bin/env bash
# Một lệnh chạy backend/admin và mở app trên Android emulator/device qua Expo.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Secret backend (Stripe Test Mode, webhook...) chỉ nằm ở máy chạy demo và đã
# được .gitignore. Export trước khi khởi động Node để các API thanh toán dùng
# đúng key mà không đưa secret vào bundle mobile.
if [[ -f "$ROOT_DIR/.env.server" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.server"
  set +a
fi

# Chọn Android SDK thực sự tồn tại. Máy dev có thể dùng Android Studio trong
# thư mục người dùng hoặc gói hệ thống Ubuntu tại /usr/lib/android-sdk.
if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
  DEFAULT_ANDROID_SDK="$ANDROID_HOME"
elif [[ -d "$HOME/Android/Sdk" ]]; then
  DEFAULT_ANDROID_SDK="$HOME/Android/Sdk"
elif [[ -d "$HOME/Android/sdk" ]]; then
  DEFAULT_ANDROID_SDK="$HOME/Android/sdk"
elif [[ -d /usr/lib/android-sdk ]]; then
  DEFAULT_ANDROID_SDK="/usr/lib/android-sdk"
else
  DEFAULT_ANDROID_SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
fi
export ANDROID_HOME="$DEFAULT_ANDROID_SDK"
if [[ -z "${ANDROID_SDK_ROOT:-}" || ! -d "$ANDROID_SDK_ROOT" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

# Pose/accessory pipeline cần numpy + OpenCV + Ultralytics. Python hệ thống
# tối giản không có các gói này; ưu tiên môi trường pyenv đã cài model YOLO.
if [[ -x "$HOME/.pyenv/shims/python3" ]]; then
  DEFAULT_ACCESSORY_PYTHON="$HOME/.pyenv/shims/python3"
else
  DEFAULT_ACCESSORY_PYTHON="$(command -v python3)"
fi
export JAPANO_ACCESSORY_PYTHON="${JAPANO_ACCESSORY_PYTHON:-$DEFAULT_ACCESSORY_PYTHON}"
export PYTHON_BIN="${PYTHON_BIN:-$JAPANO_ACCESSORY_PYTHON}"

export PORT="${PORT:-4100}"
LOCAL_API_URL="http://127.0.0.1:${PORT}"
# Marker chỉ gồm source backend, không gồm db.json đang thay đổi khi app chạy.
# Nhờ đó một backend còn sống từ lượt chạy trước không thể bị nhận nhầm là bản
# vừa sửa chỉ vì /api/health vẫn trả ok.
JAPANO_SOURCE_VERSION="$(sha256sum backend/server.js backend/routes/*.js backend/lib/*.js | sha256sum | awk '{print $1}')"
export JAPANO_SOURCE_VERSION
BACKEND_LOG="${JAPANO_BACKEND_LOG:-/tmp/japano-backend-${PORT}.log}"
BACKEND_PID=""
FASHN_DIR="${JAPANO_FASHN_DIR:-$HOME/jp/ai/fashn-vton-1.5}"
FASHN_PYTHON="${JAPANO_FASHN_PYTHON:-$FASHN_DIR/.venv/bin/python}"
FASHN_LOG="${JAPANO_FASHN_LOG:-/tmp/japano-fashn-7862.log}"
FASHN_PID=""
export JAPANO_FASHN_URL="${JAPANO_FASHN_URL:-http://127.0.0.1:7862}"
MOTION_DIR="${JAPANO_ONE_TO_ALL_HOME:-$HOME/jp/ai/One-to-All-Animation}"
MOTION_PYTHON="${JAPANO_ONE_TO_ALL_PYTHON:-$MOTION_DIR/.venv/bin/python}"
MOTION_LOG="${JAPANO_MOTION_LOG:-/tmp/japano-motion-7864.log}"
MOTION_PID=""
export JAPANO_MOTION_URL="${JAPANO_MOTION_URL:-http://127.0.0.1:7864}"
export JAPANO_MOTION_ENGINE_LABEL="${JAPANO_MOTION_ENGINE_LABEL:-one-to-all-animation-1.3b-v1}"
CATVTON_DIR="${JAPANO_CATVTON_DIR:-$HOME/jp/ai/CatVTON}"
CATVTON_PYTHON="${JAPANO_CATVTON_PYTHON:-$CATVTON_DIR/.venv/bin/python}"
CATVTON_LOG="${JAPANO_CATVTON_LOG:-/tmp/japano-catvton-7861.log}"
CATVTON_PID=""
export JAPANO_CATVTON_URL="${JAPANO_CATVTON_URL:-http://127.0.0.1:7861}"
EMBED_DIR="${JAPANO_EMBEDDING_DIR:-$HOME/jp/ai/embedding-service}"
if [[ -n "${JAPANO_EMBEDDING_PYTHON:-}" ]]; then
  EMBED_PYTHON="$JAPANO_EMBEDDING_PYTHON"
elif [[ -x "$EMBED_DIR/.venv/bin/python" ]]; then
  EMBED_PYTHON="$EMBED_DIR/.venv/bin/python"
elif [[ -x "$HOME/.pyenv/shims/python3" ]]; then
  EMBED_PYTHON="$HOME/.pyenv/shims/python3"
else
  EMBED_PYTHON="$MOTION_PYTHON"
fi
EMBED_LOG="${JAPANO_EMBEDDING_LOG:-/tmp/japano-embedding-7865.log}"
EMBED_PID=""
export JAPANO_EMBEDDING_URL="${JAPANO_EMBEDDING_URL:-http://127.0.0.1:7865}"

for required_command in node npm curl awk grep sha256sum lsof readlink; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "✗ Thiếu lệnh '$required_command'. Hãy cài công cụ này rồi chạy lại." >&2
    exit 1
  fi
done

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo
    echo "→ Dừng backend JAPANO (PID $BACKEND_PID)…"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FASHN_PID" ]] && kill -0 "$FASHN_PID" 2>/dev/null; then
    echo "→ Dừng FASHN VTON (PID $FASHN_PID)…"
    kill "$FASHN_PID" 2>/dev/null || true
    wait "$FASHN_PID" 2>/dev/null || true
  fi
  if [[ -n "$MOTION_PID" ]] && kill -0 "$MOTION_PID" 2>/dev/null; then
    echo "→ Dừng One-to-All motion service (PID $MOTION_PID)…"
    kill "$MOTION_PID" 2>/dev/null || true
    wait "$MOTION_PID" 2>/dev/null || true
  fi
  if [[ -n "$CATVTON_PID" ]] && kill -0 "$CATVTON_PID" 2>/dev/null; then
    echo "→ Dừng CatVTON (PID $CATVTON_PID)…"
    kill "$CATVTON_PID" 2>/dev/null || true
    wait "$CATVTON_PID" 2>/dev/null || true
  fi
  if [[ -n "$EMBED_PID" ]] && kill -0 "$EMBED_PID" 2>/dev/null; then
    echo "→ Dừng embedding service (PID $EMBED_PID)…"
    kill "$EMBED_PID" 2>/dev/null || true
    wait "$EMBED_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

api_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "$LOCAL_API_URL/api/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* && "$response" == *'"features":['* \
    && "$response" == *"\"sourceVersion\":\"$JAPANO_SOURCE_VERSION\""* ]]
}

stop_stale_backend() {
  local stale_pid stale_cwd stale_cmd
  stale_pid="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  [[ -n "$stale_pid" ]] || return 0
  stale_cwd="$(readlink -f "/proc/$stale_pid/cwd" 2>/dev/null || true)"
  stale_cmd="$(tr '\0' ' ' <"/proc/$stale_pid/cmdline" 2>/dev/null || true)"
  if [[ "$stale_cwd" != "$ROOT_DIR" || "$stale_cmd" != *"backend/server.js"* ]]; then
    echo "✗ Cổng $PORT đang do tiến trình khác sử dụng (PID $stale_pid). Không tự ý dừng." >&2
    echo "  Thư mục: ${stale_cwd:-không đọc được}" >&2
    echo "  Lệnh: ${stale_cmd:-không đọc được}" >&2
    exit 1
  fi
  echo "→ Backend JAPANO cũ không khớp source hiện tại; nạp lại PID $stale_pid…"
  kill "$stale_pid"
  for ((attempt = 1; attempt <= 50; attempt += 1)); do
    kill -0 "$stale_pid" 2>/dev/null || return 0
    sleep 0.1
  done
  echo "✗ Backend cũ PID $stale_pid chưa dừng. Không khởi động chồng cổng." >&2
  exit 1
}

fashn_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "${JAPANO_FASHN_URL%/}/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* && "$response" == *'"modelReady":true'* && "$response" == *'"poseEditorReady":true'* ]]
}

motion_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "${JAPANO_MOTION_URL%/}/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* && "$response" == *"\"engine\":\"$JAPANO_MOTION_ENGINE_LABEL\""* ]]
}

catvton_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "${JAPANO_CATVTON_URL%/}/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* ]]
}

embedding_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "${JAPANO_EMBEDDING_URL%/}/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* ]]
}

if [[ "${JAPANO_SKIP_INSTALL:-0}" == "1" ]]; then
  echo "→ Bỏ qua npm install (JAPANO_SKIP_INSTALL=1)."
elif [[ ! -d node_modules ]] || ! npm ls --workspaces --depth=0 >/dev/null 2>&1; then
  echo "→ Cài đặt/cập nhật dependencies…"
  npm install
else
  echo "✓ Dependencies đã đầy đủ."
fi

if [[ "${JAPANO_SKIP_FASHN:-0}" == "1" ]]; then
  echo "→ Bỏ qua FASHN VTON (JAPANO_SKIP_FASHN=1)."
elif fashn_is_ready; then
  echo "✓ Dùng FASHN VTON đang chạy tại $JAPANO_FASHN_URL"
else
  if [[ ! -x "$FASHN_PYTHON" || ! -f "$ROOT_DIR/backend/fashn_service.py" || ! -f "$FASHN_DIR/weights/model.safetensors" ]]; then
    echo "✗ Không tìm thấy FASHN VTON 1.5 đã cài tại $FASHN_DIR." >&2
    echo "  Cần .venv, weights/model.safetensors và backend/fashn_service.py." >&2
    exit 1
  fi
  echo "→ Khởi động FASHN VTON 1.5 + FLUX.2 pose/accessory refiner…"
  (
    HF_HOME="${HF_HOME:-$HOME/jp/ai/huggingface}" CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}" \
      JAPANO_FASHN_HOME="$FASHN_DIR" \
      JAPANO_FLUX_REPOSE_HOME="${JAPANO_FLUX_REPOSE_HOME:-$HOME/jp/ai/FLUX.2-klein-4B}" \
      JAPANO_TRYON_RUNTIME_DIR="${JAPANO_TRYON_RUNTIME_DIR:-/tmp/japano-tryon-runtime}" \
      "$FASHN_PYTHON" -u "$ROOT_DIR/backend/fashn_service.py"
  ) >"$FASHN_LOG" 2>&1 &
  FASHN_PID=$!

  for ((attempt = 1; attempt <= 120; attempt += 1)); do
    if fashn_is_ready; then
      break
    fi
    if ! kill -0 "$FASHN_PID" 2>/dev/null; then
      echo "✗ FASHN VTON dừng trước khi sẵn sàng. Log gần nhất:" >&2
      tail -n 60 "$FASHN_LOG" >&2 || true
      exit 1
    fi
    sleep 1
  done

  if ! fashn_is_ready; then
    echo "✗ FASHN VTON chưa sẵn sàng sau 2 phút. Xem log: $FASHN_LOG" >&2
    tail -n 60 "$FASHN_LOG" >&2 || true
    exit 1
  fi
  echo "✓ FASHN VTON đã sẵn sàng: $JAPANO_FASHN_URL"
  echo "  FASHN log: $FASHN_LOG"
fi

# One-to-All chỉ giữ một service nhẹ khi idle. Model video được nạp sau khi
# người dùng chọn action, sau khi FASHN đã tạo xong ảnh và nhả GPU.
if [[ "${JAPANO_SKIP_MOTION:-0}" == "1" ]]; then
  echo "→ Bỏ qua motion (JAPANO_SKIP_MOTION=1)."
elif motion_is_ready; then
  echo "✓ Dùng One-to-All motion đang chạy tại $JAPANO_MOTION_URL"
elif [[ ! -x "$MOTION_PYTHON" || ! -f "$ROOT_DIR/backend/motion_service.py" ]]; then
  echo "✗ Không tìm thấy One-to-All local tại $MOTION_DIR." >&2
  echo "  Full stack yêu cầu .venv và backend/motion_service.py; chỉ bỏ qua khi bạn tự đặt JAPANO_SKIP_MOTION=1." >&2
  exit 1
else
  echo "→ Khởi động $JAPANO_MOTION_ENGINE_LABEL CUDA + quality gate…"
  (
    JAPANO_ONE_TO_ALL_HOME="$MOTION_DIR" JAPANO_ONE_TO_ALL_PYTHON="$MOTION_PYTHON" \
      "$MOTION_PYTHON" -u "$ROOT_DIR/backend/motion_service.py"
  ) >"$MOTION_LOG" 2>&1 &
  MOTION_PID=$!
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    if motion_is_ready; then break; fi
    if ! kill -0 "$MOTION_PID" 2>/dev/null; then
      echo "✗ One-to-All dừng trước khi sẵn sàng. Log gần nhất:" >&2
      tail -n 60 "$MOTION_LOG" >&2 || true
      exit 1
    fi
    sleep 0.5
  done
  if ! motion_is_ready; then
    echo "✗ One-to-All chưa sẵn sàng sau 30 giây. Xem log: $MOTION_LOG" >&2
    tail -n 60 "$MOTION_LOG" >&2 || true
    exit 1
  fi
  echo "✓ One-to-All sẵn sàng: $JAPANO_MOTION_URL"
  echo "  Motion log: $MOTION_LOG"
fi

# CatVTON là phương án dự phòng (fallback) khi FASHN lỗi/không đạt quality gate —
# hoàn toàn tuỳ chọn, không chặn script nếu thiếu hoặc không khởi động được. Chạy
# cùng lúc với FASHN+FLUX.2 cần nhiều VRAM hơn; bỏ qua bằng JAPANO_SKIP_CATVTON=1
# nếu GPU không đủ VRAM cho cả ba.
if [[ "${JAPANO_SKIP_CATVTON:-1}" == "1" ]]; then
  echo "· Bỏ qua CatVTON fallback (mặc định; đặt JAPANO_SKIP_CATVTON=0 để bật)."
elif catvton_is_ready; then
  echo "✓ Dùng CatVTON đang chạy tại $JAPANO_CATVTON_URL"
elif [[ ! -x "$CATVTON_PYTHON" || ! -f "$ROOT_DIR/backend/catvton_service.py" ]]; then
  echo "· Không tìm thấy CatVTON đã cài tại $CATVTON_DIR — bỏ qua fallback này."
else
  echo "→ Khởi động CatVTON fallback…"
  (
    cd "$CATVTON_DIR"
    JAPANO_CATVTON_HOME="$CATVTON_DIR" "$CATVTON_PYTHON" -u "$ROOT_DIR/backend/catvton_service.py"
  ) >"$CATVTON_LOG" 2>&1 &
  CATVTON_PID=$!
  for ((attempt = 1; attempt <= 90; attempt += 1)); do
    if catvton_is_ready; then
      echo "✓ CatVTON fallback đã sẵn sàng: $JAPANO_CATVTON_URL"
      break
    fi
    if ! kill -0 "$CATVTON_PID" 2>/dev/null; then
      echo "· CatVTON dừng trước khi sẵn sàng (không chặn, chỉ mất fallback). Log: $CATVTON_LOG"
      CATVTON_PID=""
      break
    fi
    sleep 1
  done
  if [[ -n "$CATVTON_PID" ]] && ! catvton_is_ready; then
    echo "· CatVTON chưa sẵn sàng sau 90 giây (không chặn, chỉ mất fallback). Log: $CATVTON_LOG"
  fi
fi

# Semantic embeddings cho related-products — hoàn toàn tuỳ chọn, không có thì
# recommend.js chỉ mất tín hiệu này, engine gợi ý chính vẫn chạy bình thường.
if [[ "${JAPANO_SKIP_EMBEDDING:-0}" == "1" ]]; then
  echo "→ Bỏ qua embedding service (JAPANO_SKIP_EMBEDDING=1)."
elif embedding_is_ready; then
  echo "✓ Dùng embedding service đang chạy tại $JAPANO_EMBEDDING_URL"
elif [[ ! -x "$EMBED_PYTHON" || ! -f "$ROOT_DIR/backend/embedding_service.py" ]]; then
  echo "· Không tìm thấy embedding service đã cài tại $EMBED_DIR — related-products sẽ tạm thiếu tín hiệu semantic."
else
  echo "→ Khởi động embedding service (CUDA nếu có GPU, tự rơi về CPU)…"
  (
    CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}" \
      "$EMBED_PYTHON" -u "$ROOT_DIR/backend/embedding_service.py"
  ) >"$EMBED_LOG" 2>&1 &
  EMBED_PID=$!
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    if embedding_is_ready; then
      echo "✓ Embedding service đã sẵn sàng: $JAPANO_EMBEDDING_URL"
      break
    fi
    if ! kill -0 "$EMBED_PID" 2>/dev/null; then
      echo "· Embedding service dừng trước khi sẵn sàng (không chặn, chỉ mất tín hiệu semantic). Log: $EMBED_LOG"
      EMBED_PID=""
      break
    fi
    sleep 1
  done
  if [[ -n "$EMBED_PID" ]] && ! embedding_is_ready; then
    echo "· Embedding service chưa sẵn sàng sau 60 giây (không chặn). Log: $EMBED_LOG"
  fi
fi

if api_is_ready; then
  echo "✓ Dùng backend JAPANO đang chạy tại $LOCAL_API_URL"
else
  stop_stale_backend
  echo "→ Khởi động backend + Admin ở cổng $PORT…"
  PORT="$PORT" node backend/server.js >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!

  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    if api_is_ready; then
      break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "✗ Backend dừng trước khi sẵn sàng. Log gần nhất:" >&2
      tail -n 40 "$BACKEND_LOG" >&2 || true
      exit 1
    fi
    sleep 0.5
  done

  if ! api_is_ready; then
    echo "✗ Backend chưa sẵn sàng sau 30 giây. Xem log: $BACKEND_LOG" >&2
    tail -n 40 "$BACKEND_LOG" >&2 || true
    exit 1
  fi
  echo "✓ Backend API: $LOCAL_API_URL/api"
fi
echo "✓ Web Admin : $LOCAL_API_URL"
echo "  Backend log: $BACKEND_LOG"

if [[ -n "${JAPANO_ADB_BIN:-}" ]]; then
  ADB_BIN="$JAPANO_ADB_BIN"
elif command -v adb >/dev/null 2>&1; then
  ADB_BIN="$(command -v adb)"
elif [[ -x "${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb" ]]; then
  ADB_BIN="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb"
else
  echo "✗ Không tìm thấy adb. Hãy cài Android SDK Platform-Tools hoặc đặt JAPANO_ADB_BIN." >&2
  echo "· Không có ADB — giữ Backend/AI ở chế độ server-only (Ctrl+C để dừng)." >&2
  wait
  exit 0
fi

"$ADB_BIN" start-server >/dev/null
mapfile -t ANDROID_DEVICES < <("$ADB_BIN" devices | awk '$2 == "device" { print $1 }')
if (( ${#ANDROID_DEVICES[@]} == 0 )); then
  echo "· Không có Android emulator/device online — giữ Backend/AI ở chế độ server-only." >&2
  echo "  Web Admin/API vẫn chạy; APK release từ xa không cần ADB/Metro." >&2
  echo "  Nhấn Ctrl+C để dừng toàn bộ process do script tạo." >&2
  wait
  exit 0
fi

ANDROID_SERIAL="${JAPANO_ANDROID_SERIAL:-}"
if [[ -z "$ANDROID_SERIAL" ]]; then
  for serial in "${ANDROID_DEVICES[@]}"; do
    if [[ "$serial" == emulator-* ]]; then
      ANDROID_SERIAL="$serial"
      break
    fi
  done
fi
ANDROID_SERIAL="${ANDROID_SERIAL:-${ANDROID_DEVICES[0]}}"
if ! printf '%s\n' "${ANDROID_DEVICES[@]}" | grep -Fxq -- "$ANDROID_SERIAL"; then
  echo "✗ Android serial '$ANDROID_SERIAL' không online." >&2
  echo "  Thiết bị online: ${ANDROID_DEVICES[*]}" >&2
  exit 1
fi
export ANDROID_SERIAL

# `adb reverse` trả về 0 ngay cả khi đường hầm USB không thực sự chuyển dữ liệu
# (gặp trên máy MIUI). Lúc này app treo ở "Reloading…" vì localhost:8081 timeout,
# nên phải thử lấy HTTP qua chính đường hầm mới tin là nó sống. Backend đã chạy ở
# trên nên dùng luôn PORT làm điểm thử.
reverse_tunnel_alive() {
  "$ADB_BIN" -s "$ANDROID_SERIAL" shell \
    "printf 'GET / HTTP/1.0\r\n\r\n' | toybox nc -w 5 127.0.0.1 ${PORT} 2>/dev/null | head -n 1" \
    2>/dev/null | grep -q '^HTTP/'
}

API_REVERSED=0
if "$ADB_BIN" -s "$ANDROID_SERIAL" reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null 2>&1 \
  && reverse_tunnel_alive; then
  API_REVERSED=1
fi
# Khi reverse được Metro, ép Expo mở localhost để tránh emulator bị kẹt ở
# "New update available" do không truy cập được IP LAN của máy host.
METRO_HOST="lan"
if (( API_REVERSED == 1 )) \
  && "$ADB_BIN" -s "$ANDROID_SERIAL" reverse tcp:8081 tcp:8081 >/dev/null 2>&1; then
  METRO_HOST="localhost"
fi

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  if (( API_REVERSED == 1 )); then
    export EXPO_PUBLIC_API_URL="http://127.0.0.1:${PORT}"
  elif [[ "$ANDROID_SERIAL" == emulator-* ]]; then
    export EXPO_PUBLIC_API_URL="http://10.0.2.2:${PORT}"
  else
    # Máy thật không có đường hầm USB thì đi đường LAN — cùng IP mà Metro dùng
    # cho `--host lan`, nên app tải bundle và gọi API trên một địa chỉ duy nhất.
    HOST_LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
    if [[ -z "$HOST_LAN_IP" ]]; then
      echo "✗ adb reverse cho API thất bại và không dò được IP LAN của máy." >&2
      echo "  Đặt EXPO_PUBLIC_API_URL=http://<IP-LAN-máy-tính>:${PORT} rồi chạy lại." >&2
      exit 1
    fi
    echo "→ adb reverse không chuyển dữ liệu — chuyển sang LAN $HOST_LAN_IP."
    export EXPO_PUBLIC_API_URL="http://${HOST_LAN_IP}:${PORT}"
  fi
fi
export EXPO_PUBLIC_API_PORT="$PORT"

# Google Client ID phải tới app qua biến EXPO_PUBLIC_* chứ không qua app.json:
# dev client đọc app config từ bản nướng sẵn trong APK lúc build, nên sửa
# app.json xong app vẫn không thấy cho tới khi build lại. Metro thì nhúng
# EXPO_PUBLIC_* vào bundle mỗi lần đóng gói, nên chỉ cần khởi động lại là xong.
# Giá trị lấy từ .env.server (đã source ở đầu file) — một nguồn duy nhất.
export EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID="${GOOGLE_CLIENT_ID_ANDROID:-}"
export EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS="${GOOGLE_CLIENT_ID_IOS:-}"
export EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB="${GOOGLE_CLIENT_ID_WEB:-}"
# SDK 51 cần lấy workspace root làm Metro server root; nếu không URL entry bị
# chuẩn hoá từ ../node_modules thành mobile/node_modules và Expo Go báo đỏ.
export EXPO_USE_METRO_WORKSPACE_ROOT=1

echo "→ Android   : $ANDROID_SERIAL"
echo "→ Mobile API: $EXPO_PUBLIC_API_URL"
echo "→ Metro host: $METRO_HOST"
NATIVE_PACKAGE="${JAPANO_ANDROID_PACKAGE:-vn.japano.app}"
NATIVE_APK="$ROOT_DIR/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
USE_DEV_CLIENT=0
if [[ -d "$ROOT_DIR/mobile/android" ]]; then
  if ! "$ADB_BIN" -s "$ANDROID_SERIAL" shell pm path "$NATIVE_PACKAGE" 2>/dev/null | grep -q '^package:'; then
    if [[ -f "$NATIVE_APK" ]]; then
      echo "→ Cài JAPANO native development build lên máy ảo…"
      "$ADB_BIN" -s "$ANDROID_SERIAL" install -r "$NATIVE_APK" >/dev/null
    else
      echo "✗ Chưa có APK native tại $NATIVE_APK." >&2
      echo "  Hãy chạy một lần: cd mobile && JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 npm run android" >&2
      exit 1
    fi
  fi
  USE_DEV_CLIENT=1
fi

if (( USE_DEV_CLIENT == 1 )); then
  # MainActivity của development client dùng launchMode giữ lại task cũ. Nếu
  # không force-stop, Android có thể tiếp tục dùng URL Metro/IP LAN từ lần chạy
  # trước dù Expo vừa gửi URL localhost mới.
  "$ADB_BIN" -s "$ANDROID_SERIAL" shell am force-stop "$NATIVE_PACKAGE" >/dev/null 2>&1 || true
  echo "→ Mở JAPANO native development build (Ctrl+C để dừng)…"
  EXPO_ARGS=(--dev-client --android --host "$METRO_HOST")
else
  echo "→ Mở JAPANO bằng Expo Go (Ctrl+C để dừng)…"
  EXPO_ARGS=(--android --host "$METRO_HOST")
fi
if [[ "${JAPANO_EXPO_CLEAR:-0}" == "1" ]]; then
  EXPO_ARGS+=(--clear)
fi

# Expo hỏi đổi sang 8082 nếu một Metro cũ vẫn giữ 8081. Câu hỏi tương tác đó
# khiến chạy lại script dễ mở app bằng bundle/biến môi trường cũ, hoặc chọn
# "không" rồi cleanup dừng luôn backend vừa nạp. Chỉ dừng Metro khi xác nhận
# nó thuộc đúng workspace JAPANO; cổng của dự án khác thì báo và giữ nguyên.
METRO_PID="$(lsof -nP -t -iTCP:8081 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$METRO_PID" ]]; then
  METRO_CWD="$(readlink -f "/proc/$METRO_PID/cwd" 2>/dev/null || true)"
  METRO_CMD="$(tr '\0' ' ' <"/proc/$METRO_PID/cmdline" 2>/dev/null || true)"
  if [[ "$METRO_CWD" != "$ROOT_DIR/mobile" || "$METRO_CMD" != *"expo"* ]]; then
    echo "✗ Cổng Metro 8081 đang do tiến trình khác sử dụng (PID $METRO_PID). Không tự ý dừng." >&2
    echo "  Thư mục: ${METRO_CWD:-không đọc được}" >&2
    exit 1
  fi
  echo "→ Nạp lại Metro JAPANO ở cổng 8081 để dùng đúng source và cấu hình hiện tại…"
  kill "$METRO_PID"
  for ((attempt = 1; attempt <= 50; attempt += 1)); do
    kill -0 "$METRO_PID" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$METRO_PID" 2>/dev/null; then
    echo "✗ Metro cũ PID $METRO_PID chưa dừng. Không mở chồng sang cổng khác." >&2
    exit 1
  fi
fi
npm --workspace mobile run start -- "${EXPO_ARGS[@]}"
