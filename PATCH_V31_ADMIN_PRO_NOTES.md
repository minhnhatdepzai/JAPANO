# PATCH V31 - Admin JAPANO Pro

Bản này nâng cấp trang `/admin` từ trang cấp quyền cơ bản thành web admin thực tế hơn.

## Frontend

- Thay `app/admin.tsx` bằng dashboard nhiều tab:
  - Dashboard doanh số, KPI, biểu đồ doanh thu 6 tháng.
  - Top sản phẩm bán chạy.
  - Khu Machine Learning / dự đoán sản phẩm bán chạy.
  - Xu hướng khách hàng theo category.
  - Quản lý sản phẩm: thêm, sửa, ẩn/hiện, ảnh, mô tả, giá, category, SKU, tồn kho, tăng/giảm giá.
  - Quản lý tài khoản: xem thông tin, cấp/gỡ admin, tăng/giảm xu.
  - Marketing: gửi thông báo chung, tạo/bật/tắt voucher.
  - Giao dịch: xem payment và đơn hàng gần đây.
  - Game: thêm, sửa, xóa game.

## Backend

- Mở rộng API admin trong `server/index.mjs`:
  - `/api/admin/overview`
  - `/api/admin/products`
  - `/api/admin/users/:id/coins`
  - `/api/admin/orders`
  - `/api/admin/payments`
  - `/api/admin/vouchers`
  - `/api/admin/notifications`
  - `/api/admin/games`
- Thêm model dự đoán nhẹ `JAPANO DemandScore v1` dùng các tín hiệu:
  - unitsSold
  - wishlistCount
  - cartQuantity
  - avgRating
  - recency
  - chatMention
- Game vẫn lưu RAM để không tạo collection ngoài ERD cũ.

## API client

- Thêm các hàm admin mới vào `lib/api.ts`.

## Kiểm tra

- Đã chạy `node --check server/index.mjs`: OK.
