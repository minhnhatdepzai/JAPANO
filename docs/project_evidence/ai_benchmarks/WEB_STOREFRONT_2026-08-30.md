# Web storefront — smoke AI thật và đo hiệu năng, 2026-08-30

Nguồn: `web/e2e/real-ai.spec.ts` và Lighthouse 12 chạy trên bản build production.
Mọi số dưới đây đến từ một lượt chạy thật trên máy này, không phải ước lượng.

## Phần cứng và cấu hình

| Mục | Giá trị |
| --- | --- |
| GPU | NVIDIA RTX 5060 Ti 16 GB |
| Backend | `japano-backend` (systemd user service), Express `:4100` |
| Đường vào của website | `https://rd-system.tail6502ce.ts.net:4101` (Tailscale Serve, tailnet-only) |
| Website | `web/` build production, chạy bằng `wrangler dev` trên workerd, `127.0.0.1:4300` |
| Dịch vụ AI | `japano-fashn` `:7862`, `japano-body-analysis` `:7863`, `japano-motion` |
| Ảnh đầu vào | `test-assets/people/average/00858_00.jpg` |

## Smoke AI thật qua hàng đợi bất đồng bộ của storefront

Tất cả đi qua BFF same-origin của website (`/api/...`), tức là đúng đường mà
trình duyệt khách dùng — không gọi tắt vào dịch vụ AI.

| Bước | Endpoint | Kết quả | Thời gian |
| --- | --- | --- | --- |
| Thử đồ | `POST /api/tryon/jobs` → poll → `completed` | PNG **641 477 byte**, 1152×1536, engine `fashn-vton-1.5+balanced-20steps` | 57 854 ms (backend tự báo) |
| Chuyển động | `POST /api/tryon/motion/jobs` | MP4 **438 489 byte**, có hộp `ftyp` của ISO-BMFF nên mở được | khoảng 84 s (cả vòng job) |
| Ghép cảnh Nhật | `POST /api/japan-spots/scene-photo/jobs` | JPEG **399 027 byte**, 1024×1536, attribution `Ảnh nền: Wikimedia Commons (Creative Commons)` | 2,9 s |
| Huỷ job | `DELETE /api/tryon/jobs/:id` khi job đang chạy | trạng thái chuyển `cancelled`, lần `GET` sau vẫn `cancelled` | 1,0 s |

Điều kiện đạt trong test, không phải chỉ HTTP 200:

- Ảnh phải giải mã được thành PNG hoặc JPEG hợp lệ và lớn hơn 50 KB — placeholder
  1×1 hay chuỗi rỗng đều trượt.
- Video phải lớn hơn 100 KB và có `ftyp` ở byte 4–8.
- Kết quả được ghi ra `web/test-results/real-ai/` để kiểm tra bằng mắt.

Đã xem lại bằng mắt: ảnh thử đồ giữ đúng khuôn mặt và dáng người của ảnh gốc,
mặc áo khoác len dáng dài; ảnh ghép cảnh đặt người đứng trên mặt đất ở cánh đồng
nemophila Hitachi Seaside Park với tỉ lệ và ánh sáng hợp cảnh.

Đây là **tối ưu suy luận**, không phải fine-tune. Không có dataset huấn luyện,
optimizer, checkpoint hash hay đánh giá held-out nào mới trong lượt này.

## Lighthouse 12 (desktop preset, bản build production)

| Trang | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 95 | 100 | 100 | 100 | 1,5 s | 0,003 | 0 ms |
| `/san-pham` | 93 | 100 | 100 | 100 | 1,7 s | 0,002 | 0 ms |
| `/thu-do` | 98 | 100 | 100 | 100 | 1,1 s | 0,024 | 0 ms |
| `/cua-hang` | 99 | 100 | 100 | 100 | 1,0 s | 0,003 | 0 ms |
| `/du-lich-nhat-ban` | 95 | 100 | 100 | 100 | 1,5 s | 0,038 | 0 ms |

Đạt toàn bộ ngưỡng yêu cầu (≥ 90 cả bốn hạng mục, LCP ≤ 2,5 s, CLS ≤ 0,1).
INP không đo được bằng Lighthouse lab; TBT 0 ms là chỉ dấu thay thế trong phòng
lab, chưa phải số INP thực địa.

Điểm số đi từ 96/95/74/100 lên mức trên sau khi sửa: favicon nội tuyến (bỏ 404
`/favicon.ico` trong console), đưa ảnh Wikimedia qua BFF same-origin (bỏ cookie
bên thứ ba `WMF-Uniq`), đặt `f_auto,q_auto` cho cả `src` chứ không chỉ `srcset`,
nâng tương phản chữ trang trí `余白` và chữ phụ trên khung thử đồ, sửa
"label in name" của logo và nút trợ lý, và gắn nhãn cho input file ẩn.

## Kiểm thử tự động kèm theo

- Sau khi bổ sung Three.js/GSAP, Lighthouse production mới của `/`: Performance
  **94**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP 0,8 s,
  LCP 1,5 s, CLS 0,003, TBT 10 ms, Speed Index 1,0 s. Three.js chỉ tải trễ trên
  desktop đủ ngân sách; mobile/reduced-motion giữ fallback CSS.
- Playwright **31 pass, 1 skip có chủ đích** trên hai project `mobile-390` và
  `desktop-1440`. Test mới xác nhận canvas Three.js, GSAP cart-flight, drawer,
  order-success và route brush; case đó được skip trong project mobile.
- Vitest **7/7 pass**.
- Kiểm tra thị giác 9 trang × 6 chiều rộng (360/390/768/1024/1440/1920): không
  console error, không ảnh vỡ, không tràn ngang, không control nhỏ hơn 44×44.
- Trên bản build production, PDP sạch console ở cả 6 chiều rộng. Cảnh báo
  `<link rel=preload> must have a valid as value` chỉ xuất hiện ở dev server của
  vinext; mọi thẻ preload trong HTML của chúng ta đều có `as` hợp lệ.

## Chưa xác minh

- Chưa deploy Cloudflare thật (máy chưa `wrangler login`, và origin tailnet-only
  không gọi được từ Worker công khai). Chỉ `build` và `deploy --dry-run` đã chạy.
- Chưa đo INP thực địa và chưa chạy Lighthouse ở preset mobile có tiết lưu mạng.
- Chưa đăng nhập Google thật trên web (thiếu `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`).
- Chưa chạy hết một giao dịch Stripe/VNPay sandbox từ website.
- Không kiểm tra trên thiết bị OPPO/Redmi trong lượt này — đây là công việc web.
