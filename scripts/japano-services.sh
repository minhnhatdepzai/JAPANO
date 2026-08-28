#!/usr/bin/env bash
# Bật/tắt toàn bộ service JAPANO trong một lệnh.
#
#   ./scripts/japano-services.sh on      # bật lại tất cả + chờ sẵn sàng + tự kiểm tra
#   ./scripts/japano-services.sh off     # tắt tạm, nhường CPU/GPU cho việc khác
#   ./scripts/japano-services.sh status  # xem đang chạy gì, GPU đang bị ai giữ
#
# Dùng `stop`, KHÔNG dùng `disable`: các service vẫn được bật lại tự động khi
# đăng nhập lại. Tắt ở đây chỉ là tạm thời.
set -uo pipefail

SERVICES=(japano-backend japano-fashn japano-body-analysis)
# japano-motion chỉ bật khi cần dựng video; không nằm trong bộ mặc định.
OPTIONAL=(japano-motion)

wait_http() { # url, tên, số giây tối đa
  local url="$1" name="$2" limit="${3:-180}" waited=0
  while ! curl -sf --max-time 2 "$url" >/dev/null 2>&1; do
    sleep 2; waited=$((waited + 2))
    if [ "$waited" -ge "$limit" ]; then
      echo "  ✗ $name chưa phản hồi sau ${limit}s — xem log: journalctl --user -u $name -n 50"
      return 1
    fi
  done
  echo "  ✓ $name sẵn sàng sau ${waited}s"
}

case "${1:-status}" in
  on)
    echo "Đang bật service JAPANO..."
    systemctl --user start "${SERVICES[@]}" || exit 1
    wait_http http://127.0.0.1:4100/api/products japano-backend 120
    wait_http http://127.0.0.1:7863/health      japano-body-analysis 180
    # FASHN nạp model nặng nên lâu hơn hẳn; chỉ báo, không chặn.
    wait_http http://127.0.0.1:7862/health      japano-fashn 300 || \
      echo "  (FASHN có thể còn đang nạp model — thử đồ sẽ chờ, phân tích cơ thể thì không.)"
    echo
    echo "Kiểm tra nhanh phân tích cơ thể:"
    curl -sf --max-time 60 -X POST http://127.0.0.1:4100/api/stylist/body-analysis \
      -H 'Content-Type: application/json' \
      -d "{\"personImageBase64\":\"$(base64 -w0 "${JAPANO_TEST_PHOTO:-/tmp/red-person-from-device.jpg}" 2>/dev/null)\",\"measurementMode\":\"image\",\"profile\":{}}" \
      2>/dev/null | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('  (bỏ qua — không có ảnh test)'); raise SystemExit
h,w=d.get('estimatedHeight') or {}, d.get('estimatedWeight') or {}
g=d.get('estimatedGirthRanges') or {}
f=lambda x,k:(f\"{x.get(k)}-{x.get(k.replace('min','max'))}\") if x and x.get(k) is not None else 'null'
print(f\"  cao {f(h,'minCm')}cm | nặng {f(w,'minKg')}kg | ngực {f(g.get('bust'),'minCm')} | eo {f(g.get('waist'),'minCm')} | hông {f(g.get('hip'),'minCm')} | size {d.get('recommendedSize')}\")
" 2>/dev/null || echo "  (bỏ qua kiểm tra nhanh)"
    ;;
  off)
    echo "Đang tắt tạm service JAPANO (không disable — vẫn tự bật lại khi đăng nhập)..."
    systemctl --user stop "${SERVICES[@]}" "${OPTIONAL[@]}" 2>/dev/null
    sleep 2
    echo "GPU còn lại:"
    nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader 2>/dev/null \
      | grep -v "^$" || echo "  (không tiến trình nào giữ GPU)"
    ;;
  status)
    # Hỏi ĐÍCH DANH từng unit. `list-units` bỏ qua service đã stop và bị systemd
    # dỡ khỏi bộ nhớ, khiến "đang tắt" trông giống hệt "chưa cài bao giờ".
    for unit in "${SERVICES[@]}" "${OPTIONAL[@]}"; do
      printf '  %-24s %s\n' "$unit" "$(systemctl --user is-active "$unit" 2>/dev/null)"
    done
    echo
    nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv 2>/dev/null
    nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader 2>/dev/null
    ;;
  *)
    echo "Dùng: $0 {on|off|status}"; exit 2;;
esac
