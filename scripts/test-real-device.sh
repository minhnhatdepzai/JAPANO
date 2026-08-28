#!/usr/bin/env bash
# Dựng môi trường test THẬT trên điện thoại Android cắm USB vào PC.
#
# Việc script này làm:
#   1. Kiểm tra backend + dịch vụ AI đã sống chưa
#   2. Tìm máy qua adb và mở đường hầm ngược cho cổng 4100
#   3. Chứng minh máy GỌI ĐƯỢC backend (không chỉ "adb reverse báo OK")
#   4. Đẩy ảnh test vào thư viện ảnh của máy
#   5. Cài APK nếu máy cho phép; nếu MIUI chặn thì đẩy file vào Download
#
# Không tự cài đè, không xoá dữ liệu, không đụng tới cài đặt bảo mật của máy.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${JAPANO_API:-http://127.0.0.1:4100}"
PORT="${JAPANO_PORT:-4100}"
APK="$ROOT/mobile/android/app/build/outputs/apk/release/app-release.apk"
PKG="vn.japano.app"
loi=0

buoc() { printf '\n=== %s ===\n' "$1"; }
dat()  { printf '  [ĐẠT] %s\n' "$1"; }
truot(){ printf '  [TRƯỢT] %s\n' "$1"; loi=$((loi+1)); }

buoc "1. Backend"
if curl -fsS --max-time 5 "$API/api/health" >/dev/null 2>&1; then
  dat "$API/api/health trả lời"
  curl -fsS --max-time 5 "$API/api/health" \
    | python3 -c 'import sys,json;f=json.load(sys.stdin).get("fit",{});print("  hiệu ứng fit:",f.get("fitEffectEnabled"),"| phân tích cơ thể:",f.get("bodyAnalysisEnabled"))' 2>/dev/null
else
  truot "backend không trả lời ở $API — chạy: systemctl --user start japano-backend"
fi

buoc "2. Dịch vụ thử đồ"
if curl -fsS --max-time 5 http://127.0.0.1:7862/health 2>/dev/null \
   | python3 -c 'import sys,json;d=json.load(sys.stdin);raise SystemExit(0 if d.get("modelReady") else 1)' 2>/dev/null; then
  dat "FASHN VTON sẵn sàng (cổng 7862)"
else
  truot "FASHN chưa sẵn sàng — chạy: systemctl --user start japano-fashn"
fi

buoc "3. Thiết bị"
MAY="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [ -z "$MAY" ]; then
  truot "không thấy máy nào ở trạng thái 'device' (bật Gỡ lỗi USB và chấp nhận khoá RSA)"
  exit 1
fi
MODEL="$(adb -s "$MAY" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
SDK="$(adb -s "$MAY" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')"
dat "$MODEL (serial $MAY, Android SDK $SDK)"

buoc "4. Đường hầm ngược cổng $PORT"
adb -s "$MAY" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null 2>&1 \
  && dat "đã mở" || truot "adb reverse thất bại"

buoc "5. Máy có gọi được backend thật không"
# `adb reverse` báo thành công ngay cả khi không chuyển được byte nào, nên phải
# đo từ phía máy. Không có curl trên máy thì mở trình duyệt để soi bằng mắt.
KQ="$(adb -s "$MAY" shell "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/health" 2>/dev/null | tr -d '\r')"
if [ "$KQ" = "200" ]; then
  dat "máy nhận HTTP 200 từ backend"
else
  printf '  [?] máy không có curl — mở trình duyệt để kiểm tra bằng mắt\n'
  adb -s "$MAY" shell am start -a android.intent.action.VIEW \
    -d "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1
  printf '      màn hình máy phải hiện JSON có "ok":true\n'
fi

buoc "6. Ảnh test"
NGUON="$ROOT/test-assets/people"
if [ -d "$NGUON" ]; then
  SO=0
  while IFS= read -r anh; do
    adb -s "$MAY" push "$anh" "/sdcard/Pictures/japano-test/$(basename "$(dirname "$anh")")-$(basename "$anh")" >/dev/null 2>&1 && SO=$((SO+1))
  done < <(find "$NGUON" -type f \( -name '*.jpg' -o -name '*.png' \) | head -20)
  adb -s "$MAY" shell "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/japano-test" >/dev/null 2>&1
  dat "đã đẩy $SO ảnh vào /sdcard/Pictures/japano-test"
else
  truot "chưa có test-assets — chạy: python3 scripts/build-test-assets.py"
fi

buoc "7. Ứng dụng"
if [ ! -f "$APK" ]; then
  truot "chưa có APK — build: cd mobile && JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \\
      EXPO_PUBLIC_API_URL=http://127.0.0.1:$PORT ./android/gradlew -p android assembleRelease"
elif adb -s "$MAY" install -r -d "$APK" >/dev/null 2>&1; then
  dat "đã cài $PKG"
  adb -s "$MAY" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  dat "đã mở ứng dụng"
else
  # MIUI/HyperOS chặn cài qua USB nếu chưa bật "Cài đặt qua USB" trong Tuỳ chọn
  # nhà phát triển. Đẩy file vào Download để cài tay là đường vòng đáng tin nhất.
  adb -s "$MAY" push "$APK" /sdcard/Download/japano-fit.apk >/dev/null 2>&1
  adb -s "$MAY" shell "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/japano-fit.apk" >/dev/null 2>&1
  printf '  [?] máy chặn cài qua USB. APK đã nằm ở /sdcard/Download/japano-fit.apk\n'
  printf '      Mở Quản lý tệp -> Tải xuống -> chạm japano-fit.apk để cài tay.\n'
  adb -s "$MAY" shell am start -a android.intent.action.VIEW_DOWNLOADS >/dev/null 2>&1
fi

buoc "Kết quả"
if [ "$loi" -eq 0 ]; then
  printf '  Môi trường sẵn sàng để test tay trên máy.\n'
else
  printf '  %d bước chưa đạt — xem phần [TRƯỢT] ở trên.\n' "$loi"
fi
exit "$loi"
