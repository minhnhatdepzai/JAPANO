#!/usr/bin/env bash
# Kiểm thử thật trên OPPO A78 sau khi đã cài APK. KHÔNG gỡ app, KHÔNG xoá dữ liệu.
#
#   ./scripts/verify-oppo.sh                 # thiết bị đã nối sẵn (USB hoặc wireless)
#   ./scripts/verify-oppo.sh 100.79.192.97   # tự adb connect qua tailnet trước
#
# In ra đúng những gì kiểm tra được, và nói rõ mục nào KHÔNG kiểm tra được.
set -uo pipefail
PKG=vn.japano.app
TAILSCALE_API="https://rd-system.tail6502ce.ts.net:4101"
OUT="test-results/oppo-$(date +%Y%m%d-%H%M%S)"

if [ $# -ge 1 ]; then
  echo "== adb connect $1:5555"
  adb connect "$1:5555" || true
fi

DEV=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
if [ -z "${DEV:-}" ]; then
  echo "CHƯA CÓ THIẾT BỊ. Bật USB debugging hoặc Wireless debugging rồi chạy lại."
  echo "Không có ADB thì KHÔNG kết luận được gì về máy — không ghi PASS."
  exit 2
fi
mkdir -p "$OUT"
echo "== thiết bị: $DEV"
adb -s "$DEV" shell getprop ro.product.model | sed 's/^/   model: /'

echo "== 1. màn hình và mật độ (không giả định)"
for p in "wm size" "wm density" "settings get system font_scale"; do
  printf '   %-34s %s\n' "$p" "$(adb -s "$DEV" shell $p 2>/dev/null | tr -d '\r')"
done

echo "== 2. version đang cài TRƯỚC khi cập nhật"
adb -s "$DEV" shell dumpsys package $PKG 2>/dev/null \
  | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" | sed 's/^/   /'
FIRST_BEFORE=$(adb -s "$DEV" shell dumpsys package $PKG 2>/dev/null | grep firstInstallTime | head -1)

echo "== 3. cài đè, GIỮ dữ liệu (-r, tuyệt đối không uninstall)"
APK=mobile/android/app/build/outputs/apk/release/JAPANO-oppo-a78-v1.0.4.apk
[ -f "$APK" ] || { echo "   THIẾU $APK"; exit 3; }
adb -s "$DEV" install -r "$APK" | sed 's/^/   /'

echo "== 4. version SAU khi cài + dữ liệu còn nguyên?"
adb -s "$DEV" shell dumpsys package $PKG 2>/dev/null \
  | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" | sed 's/^/   /'
FIRST_AFTER=$(adb -s "$DEV" shell dumpsys package $PKG 2>/dev/null | grep firstInstallTime | head -1)
if [ "$FIRST_BEFORE" = "$FIRST_AFTER" ]; then
  echo "   ✅ firstInstallTime KHÔNG đổi -> dữ liệu app được giữ"
else
  echo "   ❌ firstInstallTime đã đổi -> app đã bị cài lại từ đầu"
fi

echo "== 5. máy có tới được backend qua Tailscale không (chạy TỪ trong máy)"
adb -s "$DEV" shell "curl -sk -o /dev/null -w 'HTTP %{http_code} trong %{time_total}s\n' $TAILSCALE_API/api/health" 2>/dev/null \
  | sed 's/^/   /' || echo "   (máy không có curl — kiểm tra bằng cách mở app)"

echo "== 6. mở app và chụp màn hình"
adb -s "$DEV" shell am force-stop $PKG
adb -s "$DEV" shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 8
adb -s "$DEV" exec-out screencap -p > "$OUT/01-home.png" 2>/dev/null
echo "   -> $OUT/01-home.png"

echo "== 7. logcat lỗi của app (60 dòng cuối)"
adb -s "$DEV" logcat -d -t 400 2>/dev/null | grep -iE "japano|ReactNative|AndroidRuntime|FATAL" \
  | tail -60 > "$OUT/logcat.txt"
echo "   -> $OUT/logcat.txt ($(wc -l < "$OUT/logcat.txt") dòng)"

echo
echo "CÒN PHẢI LÀM BẰNG TAY (script không tự bấm được, MIUI/ColorOS chặn input vào app hệ thống):"
echo "  · Google login bằng tài khoản thật"
echo "  · Chọn ảnh -> xem đủ 5 khoảng phân tích vóc dáng"
echo "  · Thử đồ -> ảnh trả về thật"
echo "  · Ảnh cắt chân -> phải hiện hộp 'Cần chụp lại ảnh'"
echo "  · Motion -> video phát được"
echo "Chụp màn hình từng bước rồi để vào $OUT/"
