# Bàn giao — thử đồ bơi và trang phục hở (18+)

> **Không có credential nào trong file này.** `kaggle.json` đã `chmod 600` và
> được ignore ở cả `.gitignore` lẫn `.git/info/exclude`.

## 1. Pipeline hiện tại

```
Mobile (tryon.tsx)
  └─ nếu món cần 18+ → hiện ô xác nhận, CHƯA tick thì KHÔNG gửi ảnh đi
       ↓  adultConsent: true
POST /api/tryon  (backend/routes/tryon.js)
  ├─ safetyPolicyFor()          lib/garmentCoverage.js   → loại đồ + vùng che phủ
  ├─ checkAdultImage()          lib/adultImageCheck.js   → hỏi model thị giác 1 câu
  ├─ evaluateAdultGate()        lib/adultTryonPolicy.js  → cho phép / từ chối (fail-closed)
  │     ↑ CHẶN TẠI ĐÂY nếu không đạt — ảnh chưa hề chạm tới GPU
  ├─ body analysis → fit analysis (tearAllowed bị loại trang phục phủ quyết)
  ├─ FASHN VTON 1.5 (mặc đồ) → [multi-garment: mặc chồng từng lớp]
  ├─ FIT REFINE (FLUX.2, prompt riêng cho đồ bơi/crop/short/đồ Nhật)
  ├─ COVERAGE GATE  accessory_pipeline.coverage_quality()
  │     ↑ hở vùng bắt buộc kín ⇒ HUỶ ảnh, trả 422 COVERAGE_UNSAFE
  └─ accessory refine → trả ảnh + `safety` cho client
```

## 2. Ba tầng an toàn (độc lập, tầng nào hỏng thì tầng sau vẫn chặn)

| Tầng | Ở đâu | Chặn cái gì |
|---|---|---|
| Xác nhận 18+ | `lib/adultTryonPolicy.js` | thiếu `adultConsent === true` |
| Kiểm tra ảnh | `lib/adultImageCheck.js` | ảnh có dấu hiệu vị thành niên, hoặc không đủ căn cứ |
| Độ che phủ | `accessory_pipeline.coverage_quality()` | ảnh kết quả hở ngực/chậu/mông |

Sàn an toàn `ALWAYS_COVERED_ZONES = ['chest','pelvis','buttocks']` là hằng số —
sản phẩm khai báo `coverageProfile` kiểu gì cũng bị ép về `covered`.

`tearAllowed` chỉ được SIẾT, không được NỚI: đồ bơi/crop/short/váy ngắn cấm
tuyệt đối, kể cả khi catalog khai `tearAllowed: true`.

## 3. File đã thêm / sửa

**Thêm mới**
- `backend/lib/garmentCoverage.js` — 20 loại trang phục + coverage profile
- `backend/lib/adultTryonPolicy.js` — cổng 18+ (fail-closed)
- `backend/lib/adultImageCheck.js` — hỏi model thị giác một câu nhị phân
- `backend/scripts/generateJapaneseCatalog.py` — sinh 36 sản phẩm Nhật + ảnh flat-lay (17 món bổ sung để catalog công khai đạt 70)
- `backend/scripts/mergeJapaneseCatalog.js` — gộp vào catalog (Mongo hoặc db.json)
- `backend/data/japanese-products.json` — metadata 36 sản phẩm Nhật + nguồn thông tin văn hoá
- Test: `garment-coverage`, `adult-tryon-policy`, `swimwear-tryon`,
  `japanese-catalog` (Node); `test_coverage_quality.py` (Python)

**Sửa**
- `backend/routes/tryon.js` — cổng 18+, cổng che phủ, `safety` trong response
- `backend/lib/fitAnalysis.js` — `garmentTearAllowed` phủ quyết hiệu ứng rách
- `backend/accessory_pipeline.py` — `coverage_quality()` + mode `coverage_quality`
- `backend/fashn_service.py` — COVERAGE/SWIMWEAR/CROP/SHORT_HEM/JAPANESE lock
- `mobile/lib/api.ts` — `TryOnSafety`, `TryOnSafetyError`, `ApiHttpError.code`
- `mobile/app/tryon.tsx` — ô xác nhận 18+, banner lỗi an toàn, ghi chú vùng hở

## 4. Lỗi đã tìm ra khi chạy thật (không phải lý thuyết)

1. **`áo bikini` khớp nhầm `lưng c-ao bikini`** → quần bikini bị phân loại thành
   áo bikini. Sửa bằng ranh giới từ; có test hồi quy.
2. **`analyzePortrait` bị gọi thiếu `ollamaUrl`** → trả fallback trong 1ms, nên
   cổng tuổi luôn từ chối vì "không đủ căn cứ" dù chưa hề hỏi model.
3. **Prompt của stylist không dùng được làm cổng tuổi**: nó được dặn "không bình
   luận ngoại hình" và trả `ageRange: ""` sau 67 giây. Đã thay bằng
   `adultImageCheck.js` hỏi một câu, trả lời trong ~4 giây.
4. **Parser chỉ đọc khoá `adult`** trong khi model trả `{"answer":"yes"}` →
   câu trả lời hợp lệ bị đọc thành "unsure". Nay nhận mọi khoá.
5. **`num_predict: 24` làm model trả chuỗi rỗng** → nâng lên 80.

## 5. Lệnh chạy lại

```bash
cd /home/nhat/Downloads/japano
npm run check                                  # 230 test Node + 47 Python + typecheck
node backend/ai_training/evaluate_fit_classifier.js

# Sinh lại catalog (cần dừng japano-fashn để nhường VRAM)
systemctl --user stop japano-fashn
/home/nhat/jp/ai/fashn-vton-1.5/.venv/bin/python backend/scripts/generateJapaneseCatalog.py
systemctl --user start japano-fashn
node backend/scripts/mergeJapaneseCatalog.js --write
systemctl --user restart japano-backend

# Test ảnh thật 9 ca
/home/nhat/jp/ai/flux2-fit-train/.venv/bin/python /tmp/smoke_tryon.py
```

## 6. Còn lại / rủi ro đã biết

- **Chưa fine-tune LoRA cho da hở.** Việc đó cần dataset ảnh người mặc đồ bơi có
  license rõ ràng; VITON-HD (đang có) là upper-body mặc áo thường, không chứa
  lớp swimwear. Trạng thái phải giữ là `MODEL_NOT_TRAINED` cho nhánh này.
- Cổng tuổi phụ thuộc Ollama vision. Khi GPU đang bận try-on, model phải nạp lại
  và có thể quá hạn → trả `AGE_VERIFICATION_UNAVAILABLE` (fail-closed, đúng
  thiết kế, nhưng người dùng phải thử lại).
- Khung vùng cơ thể trong `BODY_ZONE_BOXES` là tỉ lệ cố định theo box người, chưa
  dùng keypoint. Với tư thế nghiêng mạnh, vùng đo có thể lệch.
