# 00 — Source inventory

> Snapshot kiểm chứng: **20/08/2026 22:33 +07**. Gói này không sửa source nghiệp vụ hoặc database.

| Nguồn | File | Vai trò | Mức độ tin cậy |
|---|---|---|---|
| Báo cáo tốt nghiệp đã hiệu chỉnh | `baocaototnghiep_JAPANO_FINAL_REVISED.pdf` (175 trang) và `.docx` | Bài toán, actor, use case, kiến trúc, chương 4.2 ERD | Cao cho ý định thiết kế; phải đối chiếu source |
| ERD logic gốc | `erd.drawio` | 36 thực thể, field logic, 50 cạnh | Cao cho mô hình logic; không phải constraint MongoDB |
| Snapshot ERD | `tools/snapshots/erd.json` | Parse tự động từ Draw.io | Cao; kiểm tra đúng 36/50 |
| Snapshot MongoDB | `tools/snapshots/db_schema.json` | 35 collection, count/index/field-presence | Rất cao tại thời điểm snapshot; không chứa sample/secret |
| Ánh xạ collection | `backend/lib/mongoCollections.js` | Serialize/hydrate, 35 collection, index, relationshipErrors | Rất cao cho implementation |
| Cơ chế state/persistence | `backend/lib/store.js`, `backend/lib/mongo.js` | In-memory mutation, debounce persist, fallback | Rất cao |
| API nghiệp vụ | `backend/routes/*.js` (17 tệp) | CRUD và workflow thật | Rất cao |
| Kiểm thử | `backend/test/*.test.js` | Concurrency, pricing, authz, refund, integrity | Cao; bằng chứng hành vi trong phạm vi test |
| Seed/fallback | `backend/data/db.json` | State demo và fallback | Trung bình; không thay MongoDB hiện hành |
| Audit trước | `docs/project_audit/*.md` | Facts, data dictionary, report-vs-code, risk | Cao sau khi tái kiểm tra; là nguồn thứ cấp |
| ERD defense hiện có | `ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.*`, `ERD_DEFENSE_MATRIX.md`, `ERD_QUESTION_BANK.md` | Thẻ học và câu hỏi đã audit | Trung bình-cao; tái sử dụng có kiểm chứng |
| SQL/DBML tham khảo | `JAPANO/japano_erd.sql`, `.dbml`, `japano_schema_v2.sql` | Bản biểu diễn quan hệ/phục vụ xuất sơ đồ | Thấp hơn source MongoDB; không coi là migration runtime |

## Thứ tự ưu tiên khi có mâu thuẫn

`MongoDB/index hiện hành + source runtime` → `erd.drawio` → `báo cáo đã hiệu chỉnh` → `tài liệu sinh` → `SQL/DBML tham khảo`.

- `[THỰC TẾ]`: có bằng chứng source/schema/snapshot.
- `[SUY LUẬN]`: giải thích hợp lý nhưng chưa có constraint trực tiếp.
- `[ĐỀ XUẤT]`: hướng cải tiến, chưa tồn tại.
- `⚠️ CẦN XÁC MINH`: không đủ bằng chứng để kết luận.
