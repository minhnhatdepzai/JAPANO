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

# Android Studio trên Linux của máy này cài SDK ở Android/Sdk (chữ S viết
# hoa). Expo mặc định dò Android/sdk nên cần export rõ để lệnh chạy một lần
# không lặp cảnh báo và luôn mở đúng emulator.
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

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
CATVTON_DIR="${JAPANO_CATVTON_DIR:-$HOME/jp/ai/CatVTON}"
CATVTON_PYTHON="${JAPANO_CATVTON_PYTHON:-$CATVTON_DIR/.venv/bin/python}"
CATVTON_LOG="${JAPANO_CATVTON_LOG:-/tmp/japano-catvton-7861.log}"
CATVTON_PID=""
export JAPANO_CATVTON_URL="${JAPANO_CATVTON_URL:-http://127.0.0.1:7861}"

for required_command in node npm curl awk grep; do
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
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

api_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "$LOCAL_API_URL/api/health" 2>/dev/null)" || return 1
  [[ "$response" == *'"ok":true'* && "$response" == *'"features":['* ]]
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
  [[ "$response" == *'"ok":true'* && "$response" == *'"one-to-all-animation-1.3b-v2"'* ]]
}

catvton_is_ready() {
  local response
  response="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 4 \
    "${JAPANO_CATVTON_URL%/}/health" 2>/dev/null)" || return 1
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
  echo "· Không tìm thấy One-to-All local tại $MOTION_DIR — tính năng Ảnh sống sẽ tạm ẩn."
else
  echo "→ Khởi động One-to-All 1.3B-v2 CUDA + quality gate…"
  (
    JAPANO_ONE_TO_ALL_HOME="$MOTION_DIR" JAPANO_ONE_TO_ALL_PYTHON="$MOTION_PYTHON" \
      "$MOTION_PYTHON" -u "$ROOT_DIR/backend/motion_service.py"
  ) >"$MOTION_LOG" 2>&1 &
  MOTION_PID=$!
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    if motion_is_ready; then break; fi
    if ! kill -0 "$MOTION_PID" 2>/dev/null; then
      echo "· One-to-All không khởi động được; app vẫn dùng thử đồ ảnh. Log: $MOTION_LOG"
      MOTION_PID=""
      break
    fi
    sleep 0.5
  done
  if [[ -n "$MOTION_PID" ]] && motion_is_ready; then
    echo "✓ One-to-All sẵn sàng: $JAPANO_MOTION_URL"
    echo "  Motion log: $MOTION_LOG"
  fi
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

if api_is_ready; then
  echo "✓ Dùng backend JAPANO đang chạy tại $LOCAL_API_URL"
else
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
  exit 1
fi

"$ADB_BIN" start-server >/dev/null
mapfile -t ANDROID_DEVICES < <("$ADB_BIN" devices | awk '$2 == "device" { print $1 }')
if (( ${#ANDROID_DEVICES[@]} == 0 )); then
  echo "✗ Chưa có Android emulator/device ở trạng thái online." >&2
  echo "  Hãy mở Pixel 8 Pro trong Android Studio, chờ máy khởi động xong rồi chạy lại." >&2
  exit 1
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

API_REVERSED=0
if "$ADB_BIN" -s "$ANDROID_SERIAL" reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null 2>&1; then
  API_REVERSED=1
fi
# Khi reverse được Metro, ép Expo mở localhost để tránh emulator bị kẹt ở
# "New update available" do không truy cập được IP LAN của máy host.
METRO_HOST="lan"
if "$ADB_BIN" -s "$ANDROID_SERIAL" reverse tcp:8081 tcp:8081 >/dev/null 2>&1; then
  METRO_HOST="localhost"
fi

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  if (( API_REVERSED == 1 )); then
    export EXPO_PUBLIC_API_URL="http://127.0.0.1:${PORT}"
  elif [[ "$ANDROID_SERIAL" == emulator-* ]]; then
    export EXPO_PUBLIC_API_URL="http://10.0.2.2:${PORT}"
  else
    echo "✗ adb reverse cho API thất bại trên thiết bị thật." >&2
    echo "  Đặt EXPO_PUBLIC_API_URL=http://<IP-LAN-máy-tính>:${PORT} rồi chạy lại." >&2
    exit 1
  fi
fi
export EXPO_PUBLIC_API_PORT="$PORT"
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
npm --workspace mobile run start -- "${EXPO_ARGS[@]}"
