#!/usr/bin/env bash
# Chạy từng tệp kiểm thử riêng, mỗi tệp có hạn giờ riêng.
#
# Lý do: chạy `node --test backend/test/*.test.js` một lượt thì chỉ cần MỘT tệp
# treo (thường là tệp gọi ra dịch vụ ngoài) là cả bộ đứng im, và không biết được
# những tệp còn lại đạt hay hỏng. Tách ra thì luôn có kết quả đầy đủ.
cd "$(dirname "$0")/../.." || exit 1
set -a
# shellcheck disable=SC1091
[ -f ./.env.server ] && . ./.env.server
set +a

OUT=docs/project_evidence/automated_tests/per_file_results.txt
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

TOTAL_PASS=0
TOTAL_FAIL=0
TIMEOUTS=0

for f in backend/test/*.test.js; do
  RESULT=$(timeout "${TEST_TIMEOUT:-90}" node --test "$f" 2>&1)
  PASS=$(printf '%s' "$RESULT" | grep -E '^# pass' | grep -oE '[0-9]+' | head -1)
  FAIL=$(printf '%s' "$RESULT" | grep -E '^# fail' | grep -oE '[0-9]+' | head -1)
  NAME=$(basename "$f")
  if [ -z "$PASS" ]; then
    TIMEOUTS=$((TIMEOUTS + 1))
    printf '%-42s HẾT GIỜ (>%ss)\n' "$NAME" "${TEST_TIMEOUT:-90}" | tee -a "$OUT"
  else
    TOTAL_PASS=$((TOTAL_PASS + PASS))
    TOTAL_FAIL=$((TOTAL_FAIL + FAIL))
    if [ "$FAIL" = "0" ]; then STATUS="đạt"; else STATUS="HỎNG"; fi
    printf '%-42s %3s đạt / %3s hỏng   %s\n' "$NAME" "$PASS" "$FAIL" "$STATUS" | tee -a "$OUT"
  fi
done

{
  echo ""
  echo "TỔNG: ${TOTAL_PASS} đạt · ${TOTAL_FAIL} hỏng · ${TIMEOUTS} tệp hết giờ"
  echo "Thời điểm: $(date '+%d/%m/%Y %H:%M')"
} | tee -a "$OUT"
