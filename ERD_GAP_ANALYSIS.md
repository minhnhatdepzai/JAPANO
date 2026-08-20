# ERD GAP ANALYSIS — JAPANO

## 1. Thành quả được kế thừa

- Giữ nguyên bốn output chính và tiếp tục từ generator Claude, không tạo bộ tài liệu song song.
- Giữ các phần mạnh: historical snapshot, variant-level stock, idempotency, logical FK trong MongoDB, index-vs-application validation, weaknesses Y-01–Y-10 và phong cách Word hiện có.
- Trước nâng cấp: 53 trang, 77 bảng Word, 36 entity trong Matrix, 50 relationship dạng bảng tổng hợp và 59 câu hỏi.

## 2. Gap phát hiện

- Generator phụ thuộc `/tmp/claude-*`; chưa có data snapshot bền vững.
- 29/36 entity trong Matrix dùng mô tả generic; Word chưa có Defense Card cho toàn bộ 36 entity.
- Relationship table cũ gộp theo bảng con, chưa chỉ rõ từng logical FK, meaning, cardinality và delete behavior cho đủ 50 dây.
- Mock Viva mới có 5 chủ đề; orders/payment/random table chưa đạt số lượt yêu cầu và thiếu viva kiến trúc database.
- Question Bank chỉ có 59 câu, chưa có hai mức trả lời/truy đuổi cho nhóm trọng tâm.
- Thiếu WHY TREE, Random Pointer Training và đủ năm cheat sheet cuối.

## 3. Claim đã sửa sau khi đối chiếu source/live database

- **C-01:** Không còn viết “đơn online thất bại không tự hoàn kho”. Stripe/VNPay đã gọi `restockCancelledOrder()` ở nhánh failed/cancelled/expired; điểm yếu đúng là order `pending` treo vẫn cần callback/reconcile/timeout.
- **C-02:** Không còn viết “cửa sổ đúng 40 ms và mất tối đa một write”. Timer debounce bị reset bởi write mới; response có thể đi trước durable persist và có thể còn nhiều thay đổi chưa flush.
- **C-03:** Unit test 50 lượt/tồn 5 chỉ chứng minh synchronous update trong một process/file-mode, không chứng minh multi-instance MongoDB safety.
- **C-04:** Payment idempotency được mô tả theo handler/provider ID thực; `payments.transactionCode` chưa có unique index nên không tuyên bố chống trùng hoàn toàn ở nhiều instance.
- **C-05:** Live MongoDB xác nhận 35 collections; `users.email` non-unique, reviews thiếu UNIQUE user+product, wishlist có UNIQUE user+product, payment orderId non-unique, 317 variants và 94 orders/94 payments.

## 4. Nâng cấp đã hoàn tất

- Snapshot bền vững: `data/db_schema.json`, `data/erd.json`, cùng script refresh không lưu sample nhạy cảm.
- Matrix: 36/36 hồ sơ cụ thể, có role, bỏ thì hỏng gì, PK/field/nullability/index, FK/cardinality, delete, scenario, weakness, hard question và extension.
- Word: đủ R01–R50, 36 Defense Card, 6 WHY TREE, Random Pointer phủ 36 entity, 6 Mock Viva đúng ngưỡng và 5 cheat sheet.
- Question Bank: 120 câu Q001–Q120; 24 câu trọng tâm có trả lời nhanh, trả lời sâu, follow-up và evidence.

## 5. Validation cuối

- DOCX: **94 trang**, **141 bảng Word**, **136 heading mọi cấp**.
- H1/H2 dùng cho TOC: **118**, page map phủ **117/117** heading ngoài mục lục.
- Matrix: **36 entity**. Relationship: **50/50**. Question Bank: **120 câu**, trong đó **24 câu trọng tâm hai mức**.
- Placeholder/TODO/TBD/Lorem: **0**.

### Chi tiết kiểm tra tự động

- [PASS] tồn tại ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.docx — /home/nhat/Downloads/japano/ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.docx
- [PASS] tồn tại ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.pdf — /home/nhat/Downloads/japano/ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.pdf
- [PASS] tồn tại ERD_DEFENSE_MATRIX.md — /home/nhat/Downloads/japano/ERD_DEFENSE_MATRIX.md
- [PASS] tồn tại ERD_QUESTION_BANK.md — /home/nhat/Downloads/japano/ERD_QUESTION_BANK.md
- [PASS] không có TODO
- [PASS] không có TBD
- [PASS] không có lorem ipsum
- [PASS] không có PLACEHOLDER
- [PASS] có nhãn [THỰC TẾ]
- [PASS] có nhãn [SUY LUẬN]
- [PASS] có nhãn [ĐỀ XUẤT]
- [PASS] 36 logical entities trong source
- [PASS] 50 logical relationships trong source
- [PASS] 35 MongoDB collections
- [PASS] catalog entity đủ 36
- [PASS] catalog relationship khớp ERD
- [PASS] Matrix phủ đúng 36 entity — 36
- [PASS] Matrix không còn defense generic
- [PASS] Matrix có 36 mục Câu mở đầu — 36
- [PASS] Matrix có 36 mục Nếu bỏ bảng/thực thể này — 36
- [PASS] Matrix có 36 mục Logical FK / cardinality / FK owner — 36
- [PASS] Matrix có 36 mục Điểm yếu thật — 36
- [PASS] Matrix có 36 mục Hướng mở rộng [ĐỀ XUẤT] — 36
- [PASS] Word có 36 Defense Card — 36
- [PASS] Word tra đủ R01-R50 — []
- [PASS] Word có sáu WHY TREE
- [PASS] Word Random Pointer phủ 36
- [PASS] Word có năm cheat sheet
- [PASS] Mock Viva 14.1. >= 10 lượt — 10
- [PASS] Mock Viva 14.2. >= 10 lượt — 10
- [PASS] Mock Viva 14.3. >= 12 lượt — 12
- [PASS] Mock Viva 14.4. >= 12 lượt — 12
- [PASS] Mock Viva 14.5. >= 10 lượt — 10
- [PASS] Mock Viva 14.6. >= 10 lượt — 10
- [PASS] Question Bank đúng Q001-Q120 — 120
- [PASS] 24 câu trọng tâm hai mức — 24
- [PASS] 24 câu có follow-up
- [PASS] users.email index không unique
- [PASS] reviews thiếu composite unique
- [PASS] wishlist có composite unique
- [PASS] product variant selection unique
- [PASS] payment orderId non-unique
- [PASS] live critical counts
- [PASS] generator không phụ thuộc tmp Claude
- [PASS] claim cũ hoàn kho đã bị loại
- [PASS] claim cũ mất tối đa một write đã bị loại
- [PASS] headings.json khớp DOCX — 118/118
- [PASS] TOC page map phủ mọi heading
- [PASS] PDF có số trang hợp lệ — 94
- [PASS] TOC page number trong phạm vi PDF
