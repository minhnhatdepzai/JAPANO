# Báo cáo xác minh ERD — 2026-08-29

Gate bắt buộc: mọi bảng logic được vẽ phải có collection thật trên Atlas, không
trùng bảng và không có quan hệ hỏng. ERD tổng quát không phải bản kiểm kê toàn bộ
collection kỹ thuật.

Chạy lại bất cứ lúc nào:

```bash
node   scripts/atlas_audit.js --out docs/database/atlas-snapshot.json   # chỉ đọc
python3 scripts/build_erd.py                                            # sinh 1 file ERD
python3 scripts/validate_erd_against_atlas.py                           # gate
python3 scripts/validate_drawio.py JAPANO_ERD.drawio                    # XML
```

## File nào là file nào

| File | Vai trò | Bảng |
|---|---|---:|
| `JAPANO_ERD.drawio` | **ERD duy nhất:** đúng một trang tổng quát app. 18 bảng logic đều có collection thật trên Atlas; 11 collection hỗ trợ/kỹ thuật không vẽ để sơ đồ còn dễ đọc. | 18 |

## Kết quả

    Atlas «japano» — snapshot 2026-08-29T09:35:25
      29 collection, 2136 document
    
    ERD tổng quát: JAPANO_ERD.drawio
      1 trang · 18 bảng logic chọn từ 29 collection Atlas
      bảng không có thật: không
      bảng trùng: không
      quan hệ hỏng: không
      dây không nối FK → PK: không
    
    ERD tổng quát hợp lệ với Atlas: ĐẠT

## Kiểm tra XML và hiển thị

    python3 scripts/validate_drawio.py JAPANO_ERD.drawio
    [ĐẠT] 1 trang, 393 ô, 18 bảng, 23 quan hệ

Đã xuất PNG bằng Draw.io Desktop và xem trực tiếp trang ERD app: không có bảng
chồng nhau, connector trùng đoạn/cắt qua bảng; chữ đọc được và ký hiệu khóa/tham
chiếu hiển thị đúng. ERD app được làm lại thành đúng một trang theo kiểu học
thuật: tên bảng căn giữa, PK/FK ở cột trái, tên trường căn trái và mỗi dây bám
trực tiếp từ đúng ô FK nguồn vào đúng ô PK `id` đích. Gate XML kiểm tra cả hai
đầu dây, không chỉ kiểm tra tên bảng.

Màu và độ dày đã được thống nhất: nền trắng, viền bảng/hàng/dây `#222222`, độ
dày `1.2`. Chỉ tên bảng và trường PK được in đậm; tên PK được gạch chân để thể
hiện phân cấp như mẫu, các trường thường không in đậm.

Từ điển đã Việt hóa đủ **29 collection và 214 tên field** để bộ sinh có thể kiểm
tra snapshot. ERD tổng quát chỉ hiển thị 18 bảng cần trình bày. Tên kỹ thuật
được giữ ở thuộc tính XML `data-collection` /
`data-field` để gate vẫn so đúng Atlas. Mỗi connector có nhãn trường nguồn và
cổng vào riêng trên viền bảng; kiểm tra tự động xác nhận 0 quan hệ trùng, 0 đoạn
connector chồng quá 12 px và 0 connector xuyên bảng. Bốn field cũ trong view app
được sửa theo snapshot hiện hành: `receiver → name`, `categories.slug → kanji`,
`vouchers.expiresAt → expiry`, `order_items.color → colorName`.

## Nguyên tắc đang được tuân thủ

- Mỗi bảng được chọn xuất hiện **đúng một lần** trong ERD tổng quát.
- Không vẽ bảng cho cache RAM AI, ảnh Cloudinary, dữ liệu suy ra lúc chạy,
  state phía frontend, service/model, hay object đã nhúng và không còn
  collection riêng. Vì vậy `product_details`, `banners`, `discount_rules`,
  `vip_memberships` và `ai_descriptions` **không còn bảng** — chúng đã bị gộp
  hoặc chuyển thành dữ liệu suy ra.
- Quan hệ ghi là **reference** (tham chiếu tầng ứng dụng), không gọi là foreign
  key: MongoDB không có ràng buộc khoá ngoại phía máy chủ.
- `id` trong ERD là khóa định danh logic mà API dùng; `_id` mới là khóa vật lý
  mặc định của MongoDB. Không diễn giải sơ đồ như ràng buộc FK vật lý trên Atlas.
- Ghi rõ PK, index, unique và TTL. Hiện Atlas có 26 unique index, 0 TTL,
  0 validator.
- Chỉ có một trang; `Tương tác người dùng` thể hiện nguồn tín hiệu cho máy gợi ý.

## Đối chiếu luồng app và tính toàn vẹn dữ liệu

- Backend, dịch vụ thử đồ/phân tích cơ thể/chuyển động đang hoạt động; health
  check xác nhận MongoDB online. Endpoint gợi ý trang chủ trả sản phẩm và lý do
  gợi ý từ các tín hiệu tìm kiếm, xem, yêu thích, giỏ hàng, thử đồ, chat và mua.
- `npm run check` đạt: 342/342 bài kiểm thử Node, TypeScript mobile và 102 bài
  kiểm thử Python đạt (2 bài skip đã có từ trước).
- 22/23 quan hệ có toàn bộ giá trị tham chiếu đang tồn tại được phân giải, không
  có orphan. Riêng `interactions.userId → users.id` có **3 bản ghi orphan** trong
  539 tương tác có `userId`; cả ba là sự kiện `mobile / tryon`. Đây là lỗi dữ
  liệu lịch sử thật cần cleanup/backfill riêng, không phải lý do để xóa quan hệ
  khỏi ERD. Audit này chỉ đọc và chưa sửa dữ liệu Atlas.
- `notifications.userId`, `chats.userId`, `orders.voucherId` và một số tham
  chiếu thanh toán/hoàn trả là tùy chọn theo nghiệp vụ; giá trị trống không bị
  tính là orphan.

## File ERD cũ

`erd.drawio`, `JAPANO_ERD_MongoDB.drawio`, bản Core tách riêng và bản sao trong
`docs/erd-defense/diagrams/` đã được chuyển vào Thùng rác. Repo chỉ giữ đúng một
file một trang: `JAPANO_ERD.drawio`.
