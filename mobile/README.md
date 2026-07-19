# JAPANO Mobile — React Native + Expo Router

App mobile dùng giao diện mới và gọi trực tiếp backend JAPANO cho catalog, đặt hàng, gợi ý cá nhân, trợ lý Ori, tư vấn size, thử đồ, AI mô tả ảnh sản phẩm và mục tiêu mua sắm/làm đẹp.

## Cách chạy khuyến nghị

Mở Pixel/AVD trong Android Studio, chờ emulator khởi động xong, sau đó chạy từ thư mục gốc:

```bash
./start-all.sh
```

Lệnh này tự chạy backend/Admin ở cổng `4100`, cấu hình kết nối Android bằng `adb reverse` và mở Expo. Xem hướng dẫn biến môi trường ở [README gốc](../README.md).

## Chạy mobile riêng

Khi backend đã chạy ở cổng `4100`:

```bash
npm install
EXPO_USE_METRO_WORKSPACE_ROOT=1 EXPO_PUBLIC_API_URL=http://10.0.2.2:4100 npm --workspace mobile run android -- --localhost
```

Hoặc từ chính thư mục `mobile/`:

```bash
EXPO_USE_METRO_WORKSPACE_ROOT=1 EXPO_PUBLIC_API_URL=http://10.0.2.2:4100 npm run android -- --localhost
```

- Android emulator truy cập máy host qua `10.0.2.2`.
- Điện thoại thật dùng `adb reverse tcp:4100 tcp:4100`, hoặc đặt `EXPO_PUBLIC_API_URL=http://<IP-LAN-máy-tính>:4100`.
- Dùng `JAPANO_EXPO_CLEAR=1 ./start-all.sh` nếu Metro giữ cache cũ.

## Cấu trúc chính

```text
app/                     Điều hướng theo file với Expo Router
  (tabs)/                Trang chủ, sản phẩm, camera, yêu thích, tài khoản
  product/[slug].tsx     Chi tiết sản phẩm
  camera.tsx             Ống kính và gợi ý phong cách
  tryon.tsx              Thử đồ AI/fallback cục bộ
  goals.tsx              Lộ trình tiết kiệm và thói quen sức khoẻ an toàn
  chat.tsx               Trợ lý mua sắm Ori
  cart/checkout/orders   Giỏ hàng và đơn hàng
components/              Thành phần UI dùng chung
lib/api.ts               API client và cơ chế fallback
lib/store.tsx            Trạng thái app được lưu bằng AsyncStorage
assets/products/         Ảnh catalog đi kèm
```

## Kiểm tra

Từ thư mục gốc:

```bash
npm --workspace mobile run typecheck
npm run verify
```

API mặc định là cổng `4100`; không cần sửa cứng `lib/api.ts` khi đổi máy hoặc cổng, chỉ cần đặt `EXPO_PUBLIC_API_URL`.
