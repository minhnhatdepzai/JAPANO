# Rà soát nhất quán cuối cùng

Ngày 16/08/2026, trên `baocaototnghiep_JAPANO_FINAL_REVISED.pdf` (168 trang).

## Khẳng định đã gỡ hoặc sửa (kiểm tra bằng tìm chuỗi trên toàn bộ PDF)

| Chuỗi tìm | Số lần xuất hiện | Kết luận |
|---|---:|---|
| `Gemini` | 0 | đã gỡ hết |
| `Fotor` | 0 | đã gỡ hết |
| `minigame` | 0 | đã gỡ hết |
| `Mongoose` | 0 | đã gỡ hết |
| `ReactJS` | 0 | đã gỡ hết |
| `scrypt` | 0 | đã gỡ hết |
| `Payment Sheet` | 0 | đã gỡ hết |
| `products:manage` | 0 | đã gỡ hết |
| `roles:grant` | 0 | đã gỡ hết |
| `60 FPS` | 0 | đã gỡ hết |
| `99,9` | 0 | đã gỡ hết |
| `a@gmail` | 0 | đã gỡ hết |
| `sk_test_` | 0 | đã gỡ hết |
| `pk_test_` | 0 | đã gỡ hết |
| `AIza` | 0 | đã gỡ hết |
| `mongodb+srv` | 0 | đã gỡ hết |
| `bảo mật tuyệt đối` | 0 | đã gỡ hết |

## Khẳng định phải có mặt và nhất quán

| Chuỗi tìm | Số lần | Ghi chú |
|---|---:|---|
| `36 bảng` | 3 | mô hình logic |
| `35 collection` | 4 | hiện thực vật lý |
| `50 quan hệ` / `50 mối quan hệ` | 5 | khớp `erd.drawio` |
| `115` (điểm cuối) | 7 | khớp số đếm từ mã nguồn |
| `Ollama` | 6 | AI cục bộ |
| `CatVTON` | 5 | thử đồ ảo |
| `VNPay` | 43 | cổng thanh toán thứ hai |
| `bcrypt` | 7 | băm mật khẩu |
| `gần thời gian thực` | 1 | thay cho "thời gian thực" |
| `HitRate` | 3 | số đo tìm kiếm ngữ nghĩa |
| `phân vị 95` | 5 | số đo hiệu năng |

## Đối chiếu số liệu giữa báo cáo, mã nguồn và tệp bằng chứng

| Chỉ tiêu | Báo cáo | Nguồn kiểm chứng |
|---|---|---|
| Điểm cuối REST | 115 | đếm từ `backend/routes/*.js` |
| Collection vật lý | 35 | `NORMALIZED_COLLECTIONS` trong `mongoCollections.js` |
| Thực thể ERD | 36 | `erd.drawio` |
| Quan hệ ERD | 50 | `erd.drawio` (đếm cạnh) |
| Vai trò | 4 | `ROLE_RANK` trong `backend/lib/auth.js` |
| Kiểm thử | 156 đạt / 0 hỏng | `docs/project_evidence/automated_tests/per_file_results.txt` |
| p95 chậm nhất | 335,7 ms | `docs/project_evidence/api_benchmarks/api_benchmark.json` |
| Thông lượng bão hoà | ~180 req/s | `docs/project_evidence/load_tests/ramp.md` |
| MRR từ khoá / ngữ nghĩa | 0,846 / 0,793 | `docs/project_evidence/ai_benchmarks/semantic_search.json` |

**Kết luận:** không còn khẳng định nào trong báo cáo mà mã nguồn hoặc tệp bằng chứng không đỡ được.
