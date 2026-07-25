# PATCH V34 - Product gallery, size, dimensions, color

## Đã thêm

1. Mỗi sản phẩm có gallery 4 ảnh:
   - `image`: ảnh chính / ảnh lớn.
   - `images`: mảng 4 ảnh.
   - Nếu admin chỉ nhập thiếu ảnh, backend tự bù ảnh mẫu để đủ 4 ảnh.

2. Trang chi tiết sản phẩm:
   - Hiển thị 1 ảnh lớn.
   - Hiển thị 4 ảnh nhỏ bên dưới.
   - Ảnh lớn tự thay phiên đổi theo 4 ảnh nhỏ.
   - Bấm ảnh nhỏ sẽ đổi ảnh lớn ngay.

3. Thuộc tính sản phẩm mới:
   - `sizes`: size / kích cỡ, ví dụ S, M, L, XL.
   - `dimensions`: kích thước chi tiết, ví dụ dài áo, ngang vai, vòng ngực.
   - `colors`: màu sắc.
   - `fit`: form / kiểu vừa, ví dụ Regular fit, Oversize, Slim.

4. Trang admin Products:
   - Thêm 4 ô ảnh: ảnh lớn / ảnh 1, ảnh nhỏ 2, ảnh nhỏ 3, ảnh nhỏ 4.
   - Thêm ô Size / kích cỡ.
   - Thêm ô Màu sắc.
   - Thêm ô Kích thước.
   - Thêm ô Form / kiểu vừa.
   - Preview và danh sách sản phẩm hiển thị 4 ảnh nhỏ, size, màu sắc, kích thước và form.

5. Backend admin:
   - `POST /api/admin/products` và `PATCH /api/admin/products/:productId` lưu các trường mới.
   - Collection products hỗ trợ `images`, `sizes`, `dimensions`, `colors`, `fit`.
   - Collection images được đồng bộ 4 ảnh theo `sortOrder`.
   - Variant dùng màu/size đầu tiên làm biến thể mặc định.

## File đã chỉnh

- `data/catalog.ts`
- `app/product/[id].tsx`
- `app/admin.tsx`
- `server/index.mjs`
