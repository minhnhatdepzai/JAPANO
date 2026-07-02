# PATCH V32 - Admin UI Pro

Bản này chỉnh lại trang admin theo style dashboard web hiện đại:

- Sidebar tối, topbar tìm kiếm, layout responsive cho web admin.
- Dashboard đa dạng: KPI, revenue chart, monthly goal, conversion funnel, top products, recent activity.
- Analytics / ML: DemandScore, dự đoán sản phẩm bán chạy, xu hướng khách hàng theo category.
- Products: thêm/sửa/ẩn/hiện sản phẩm, ảnh, mô tả, giá bán, giá gốc, % giảm, badge, quick sale -15%, tăng/giảm giá.
- Hiển thị giảm giá kiểu marketplace: giá bán + giá gốc gạch ngang + badge giảm %.
- Promotions: thêm voucher, thêm khuyến mãi/campaign, bật/tắt voucher/campaign, thông báo chung.
- Users: xem tài khoản, cấp/gỡ admin, tăng/giảm xu.
- Transactions: xem đơn hàng và thanh toán.
- Games: thêm/sửa/xóa game.

Backend vẫn giữ collections theo ERD. Promotion được lưu chung trong `discountcodes` với `kind: promotion`, không tạo collection mới.
