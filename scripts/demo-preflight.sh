#!/usr/bin/env bash
# Kiểm tra trước khi demo: mọi thứ cần cho một lượt thử đồ thật đã sẵn sàng chưa.
#
# Chỉ ĐỌC trạng thái, không sửa gì. Chạy trước khi thuyết trình để không phải
# phát hiện service chết ngay lúc đang trình bày.
set -uo pipefail

API="${JAPANO_API:-http://127.0.0.1:4100}"
FASHN="${JAPANO_FASHN:-http://127.0.0.1:7862}"
loi=0
dat()   { printf '  %-14s OK    %s\n' "$1" "${2:-}"; }
truot() { printf '  %-14s TRƯỢT %s\n' "$1" "${2:-}"; loi=$((loi+1)); }

printf '\nJAPANO — KIỂM TRA TRƯỚC DEMO\n\n'

# --- Backend ---------------------------------------------------------------
if HEALTH="$(curl -fsS --max-time 5 "$API/api/health" 2>/dev/null)"; then
  dat Backend "$API"
  echo "$HEALTH" | python3 -c '
import sys, json
d = json.load(sys.stdin)
fit = d.get("fit") or {}
if fit:
    print("                 hiệu ứng fit =", fit.get("fitEffectEnabled"),
          "| phân tích cơ thể =", fit.get("bodyAnalysisEnabled"))
' 2>/dev/null
else
  truot Backend "không trả lời ở $API — systemctl --user start japano-backend"
fi

# --- Dịch vụ thử đồ --------------------------------------------------------
if FH="$(curl -fsS --max-time 5 "$FASHN/health" 2>/dev/null)"; then
  echo "$FH" | python3 -c '
import sys, json
d = json.load(sys.stdin)
model = d.get("modelReady")
refiner = d.get("fitRefinerReady")
lora = (d.get("fitLora") or {}).get("adapterLoaded")
san = bool(model and refiner)
nhan = "OK   " if san else "TRƯỢT"
print("  %-14s %s model=%s fit-refine=%s lora=%s" % ("FASHN", nhan, model, refiner, lora))
raise SystemExit(0 if san else 1)
' || loi=$((loi+1))
else
  truot FASHN "cổng 7862 im — systemctl --user start japano-fashn"
fi

# --- GPU -------------------------------------------------------------------
if command -v nvidia-smi >/dev/null 2>&1; then
  read -r DUNG TONG < <(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits | head -1 | tr ',' ' ')
  CON=$((TONG - DUNG))
  # Một lượt thử đồ cần tráo FASHN rồi FLUX; dưới ~9 GB trống là dễ OOM giữa chừng.
  if [ "$CON" -ge 9000 ]; then dat GPU "còn ${CON} MiB / ${TONG} MiB"
  else truot GPU "chỉ còn ${CON} MiB — tiến trình khác đang giữ VRAM"; fi
else
  truot GPU "không có nvidia-smi"
fi

# --- Đĩa -------------------------------------------------------------------
CON_GB="$(df -BG --output=avail . 2>/dev/null | tail -1 | tr -dc '0-9')"
if [ "${CON_GB:-0}" -ge 5 ]; then dat Đĩa "còn ${CON_GB}G"; else truot Đĩa "chỉ còn ${CON_GB}G"; fi

# --- Dữ liệu ---------------------------------------------------------------
SO_SP="$(curl -fsS --max-time 8 "$API/api/products" 2>/dev/null | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"
if [ "${SO_SP:-0}" -gt 0 ]; then dat "Sản phẩm" "$SO_SP món"; else truot "Sản phẩm" "API không trả sản phẩm"; fi

AUTH="$(curl -fsS --max-time 5 "$API/api/auth/providers" 2>/dev/null || echo '')"
if echo "$AUTH" | grep -q '"ok":true'; then
  dat "Đăng nhập" "$(echo "$AUTH" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("mật khẩu=",d.get("password")," google=",d.get("google"))' 2>/dev/null)"
else
  truot "Đăng nhập" "/api/auth/providers không trả lời"
fi

# --- Đường mạng ------------------------------------------------------------
MAY="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [ -n "$MAY" ]; then
  adb -s "$MAY" reverse --list 2>/dev/null | grep -q 'tcp:4100' \
    && dat "USB" "$(adb -s "$MAY" shell getprop ro.product.model 2>/dev/null | tr -d '\r')" \
    || truot "USB" "chưa mở adb reverse tcp:4100 tcp:4100"
else
  printf '  %-14s –     không có máy Android cắm USB (bỏ qua nếu demo từ xa)\n' "USB"
fi

LAN_IP="$(ip -4 addr show scope global 2>/dev/null | grep -oE 'inet 192\.168\.[0-9.]+' | awk '{print $2}' | head -1)"
[ -n "$LAN_IP" ] && dat "LAN" "http://$LAN_IP:4100" || printf '  %-14s –     không thấy IP LAN\n' "LAN"

if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  TS="$(tailscale status --json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin).get("Self",{}).get("DNSName","").rstrip("."))' 2>/dev/null)"
  [ -n "$TS" ] && dat "Tailscale" "https://$TS:4101" || truot "Tailscale" "không đọc được trạng thái"
else
  printf '  %-14s –     tailscaled không chạy (chỉ cần cho demo từ xa)\n' "Tailscale"
fi

printf '\n'
if [ "$loi" -eq 0 ]; then printf 'TRẠNG THÁI: SẴN SÀNG\n\n'; else printf 'TRẠNG THÁI: CHƯA SẴN SÀNG (%d mục trượt)\n\n' "$loi"; fi
exit "$loi"
