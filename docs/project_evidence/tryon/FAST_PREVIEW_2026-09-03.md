# JAPANO try-on fast preview — 2026-09-03

## Mục tiêu

Giảm thời gian chờ cho lượt thử một món quần áo và giảm trường hợp ảnh hợp lệ bị
coverage gate huỷ nhầm. Đây là tối ưu inference và calibration của cổng chất
lượng, không phải fine-tuning model.

## Môi trường

- GPU: NVIDIA GeForce RTX 5060 Ti, 16 GB VRAM.
- Engine: `fashn-vton-1.5+fast-16steps`.
- Profile: 16 diffusion steps, cạnh dài tối đa 1280 px.
- Người: preset nội bộ `nu-can-doi`.
- Sản phẩm: `ao-len-co-lo`, size M.
- Request dùng màu định danh riêng để tránh đọc lại cache.
- API: `POST /api/tryon`, backend và FASHN service cục bộ.

## Kết quả đo trực tiếp

| Mốc | `durationMs` từ API | Wall time | Kết quả |
|---|---:|---:|---|
| Trước thay đổi coverage/fast routing | 22.780 ms | 23 s | HTTP thành công, không cảnh báo coverage |
| Sau thay đổi | 22.835 ms | 23 s | HTTP thành công, không cảnh báo coverage |

Hai lượt trên đo khi model đã sẵn sàng; không tính cold-start tải model. App khởi
động GPU focus song song với body analysis để che một phần cold-start thay vì
đợi tuần tự.

Ma trận fast đã có trong `docs/project_evidence/tryon/fast_profile_matrix.json`:
6/6 loại trang phục thành công, từ 22 đến 41,6 giây, trung bình 28,37 giây. Không
dùng số liệu phụ kiện của script cũ vì đường dẫn asset phụ kiện trong script đó
không còn đúng.

## Thay đổi chất lượng và an toàn

- Mức màu da mơ hồ trong một ô — cổ chữ V, bóng da, vải nude, quần/váy ngắn —
  chỉ tạo `coverage_review:*`, không tự huỷ ảnh.
- Vùng lõi ngực/chậu/mông gần như toàn bộ là da vẫn bị chặn.
- Profile fast không chạy thêm một lượt FLUX 20–35 giây chỉ để sửa thẩm mỹ phần
  gấu áo hở; final quality/coverage gate vẫn chạy.
- Consent, quyền sử dụng ảnh và cổng người trưởng thành cho trang phục 18+ không
  thay đổi.

## Validation

- Backend Node: 374/374 test pass.
- Python: 110 test được chạy; 108 pass, 2 configured skip.
- Coverage target: 24/24 pass, gồm regression cổ chữ V rộng chỉ cảnh báo.
- Mobile TypeScript: pass.
- Python compile và Node syntax: pass.
- Chưa kiểm tra trực tiếp màn hình trên OPPO A78 hoặc Redmi Note 8 trong lượt
  này; số liệu trên là API/GPU thật tại máy chủ.
