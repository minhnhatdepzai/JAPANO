# 34 bảng có quá nhiều không?

Ngày phân tích: **2026-08-28**, số liệu đọc trực tiếp từ MongoDB Atlas (`japano`).

## Trả lời ngắn

**34 collection vật lý không phải là quá nhiều cho một hệ thống thương mại điện
tử có AI.** Cái đang gây rối là **sơ đồ**, không phải database.

Nhưng có **5 collection không nên đứng độc lập**. Sau migration, mục tiêu hợp lý
là 29 collection. Không được giảm bằng cách xoá lịch sử nghiệp vụ hoặc dữ liệu
người dùng đang nhìn thấy.

## Vì sao 34 không phải con số bất thường

Nhóm lại theo nghiệp vụ thì chỉ có **9 nhóm**:

| Nhóm | Collection | Docs |
|---|---:|---:|
| Sản phẩm | 5 | 795 |
| Hành vi / AI | 5 | 934 |
| Khuyến mãi / Loyalty | 6 | 29 |
| Mua hàng | 4 | 278 |
| Hạ tầng | 4 | 73 |
| Người dùng | 3 | 59 |
| Đánh giá | 3 | 125 |
| Thanh toán | 2 | 107 |
| Nhật Bản | 2 | 10 |

Một sàn thương mại điện tử tối thiểu đã cần: người dùng, địa chỉ, danh mục, sản
phẩm, biến thể, ảnh, giỏ, yêu thích, đơn, dòng đơn, thanh toán, trả hàng, voucher,
đánh giá — **14 bảng chưa tính gì đến AI, loyalty hay nội dung cộng đồng.**

## 5 collection nên gộp hoặc bỏ persist

| # | Gộp gì | Vào đâu | Bằng chứng | Rủi ro |
|---|---|---|---|---|
| 1 | `product_details` (71) | `products` (71) | **Đúng 1:1** — mỗi sản phẩm có đúng một bản ghi chi tiết. Đây là cắt dọc thuần tuý một thực thể, không phải quan hệ. | Thấp |
| 2 | `ai_descriptions` (8) | **bỏ persist** hoặc ghi bản đã duyệt vào `products` | Kết quả Qwen3-VL có thể tạo lại; không phải dữ liệu nguồn. | Thấp |
| 3 | `banners` (3) | `settings.shop.banners` | Là cấu hình trang chủ và luôn được Admin/mobile tải như một khối nhỏ. | Thấp |
| 4 | `discount_rules` (3) | `settings.promotionRules` | Chỉ là ba luật cấu hình; voucher giao dịch vẫn giữ riêng. | Thấp |
| 5 | `vip_memberships` (6) | **bỏ, tính lại khi cần** | `deriveVipMemberships()` tính lại từ đơn hàng và thời gian hiện tại. | Trung bình |

**34 → 29 collection.** Không tính năng nào mất đi nếu migration giữ tương
thích đọc trong giai đoạn chuyển đổi.

Không còn đề xuất bỏ `flagcard_collections`: collection này lưu cả phần thưởng
`admin-grant`, không thể tái tạo đầy đủ chỉ từ `orders`. Cũng chưa gộp
`japan_spot_reviews` vào `reviews` vì hai route có vòng đời moderation và đích
hiển thị khác nhau; lợi ích dung lượng chỉ khoảng vài KB nhưng rủi ro nghiệp vụ
cao hơn.

## Vì sao KHÔNG gộp thêm

| Bị đề nghị gộp | Vì sao giữ |
|---|---|
| `product_variants` (497) | Tồn kho theo màu-size nằm ở đây. Nhúng vào `products` thì mỗi lần trừ tồn kho phải ghi lại cả document sản phẩm — đúng lỗi khuếch đại ghi vừa sửa. |
| `order_items` (160) | Chuẩn hoá kinh điển. Refund theo từng món cần khoá riêng. |
| `product_media` (151) | Một sản phẩm nhiều ảnh, có `position`. Nhúng mảng thì mất index theo thứ tự. |
| `interactions` (877) | Collection lớn nhất, chỉ-thêm, cần retention sau khi có aggregate. Trộn vào chỗ khác là tự tạo hot partition. |
| `review_reactions` (88) | Nhiều-nhiều giữa user và review. Nhúng vào review gây tranh ghi khi nhiều người bấm cùng lúc. |
| `payments` / `return_requests` | Chứng từ tài chính, vòng đời khác đơn hàng. |
| `cart_items` / `wishlist_items` | Vòng đời và retention khác hẳn nhau (giỏ 60 ngày, yêu thích theo tài khoản). |

## Cái thật sự gây rối là sơ đồ

Vấn đề không nằm ở 34 collection mà ở chỗ **một sơ đồ duy nhất cố vẽ cả 34**.

| Sơ đồ | Số entity | Dùng để làm gì |
|---|---:|---|
| `JAPANO_ERD_CORE` | **14** | Trình bày cho khách/giảng viên |
| `JAPANO_ERD_PHYSICAL` | 34 (chia trang) | Tra cứu kỹ thuật |
| `JAPANO_DATA_LIFECYCLE` | 9 nhóm | Vòng đời và quyền riêng tư |
| `JAPANO_USE_CASE` | theo actor | Nghiệp vụ |

14 entity của sơ đồ CORE: `users`, `addresses`, `categories`, `products`,
`product_variants`, `product_media`, `cart_items`, `wishlist_items`, `orders`,
`order_items`, `payments`, `return_requests`, `vouchers`, `reviews`.

Đó là toàn bộ luồng "khách xem hàng → bỏ giỏ → đặt → trả tiền → đánh giá →
đổi trả". Log, AI telemetry, loyalty và nội dung cộng đồng **không xuất hiện** —
chúng nằm ở sơ đồ PHYSICAL.

## Chưa thực hiện

Bảng gộp ở trên là **[ĐỀ XUẤT]**. Chưa migration nào được chạy. Mỗi mục cần:
backup → dry-run → đối chiếu count trước/sau → cập nhật route/test/ERD → rollback
sẵn sàng. Xin quyết định từng mục trước khi làm.
