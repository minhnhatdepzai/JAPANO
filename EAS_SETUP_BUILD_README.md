# JAPANO v26 — EAS Development Build

Bản này đã chuyển project từ flow Expo Go sang **EAS Development Build** mà không thay đổi UI/tính năng chính.

## Đã thêm/cấu hình

- `expo-dev-client` cho development build.
- Plugin `expo-dev-client` trong `app.json` để mở màn hình Development Build giống hình bạn gửi.
- `eas.json` profile `development` dùng `developmentClient: true` và Android `apk`.
- Script npm:
  - `npm run dev-client`
  - `npm run dev-client:clear`
  - `npm run eas:android:dev`
  - `npm run eas:android:preview`
  - `npm run eas:ios:dev`
- Batch Windows:
  - `EAS_BUILD_ANDROID_DEV_APK_WINDOWS.bat`
  - `EAS_START_LOCAL_SERVER_FOR_DEV_BUILD_WINDOWS.bat`
  - `EAS_BACKEND_ONLY_WINDOWS.bat`
  - `EAS_METRO_DEV_CLIENT_ONLY_WINDOWS.bat`

## Lần đầu build EAS Android

Chạy:

```bat
EAS_BUILD_ANDROID_DEV_APK_WINDOWS.bat
```

Script sẽ:

1. Cài package Node nếu thiếu.
2. Cài `expo-dev-client` đúng SDK.
3. Cài EAS CLI nếu máy chưa có.
4. Yêu cầu `eas login` nếu chưa đăng nhập.
5. Chạy `eas init` nếu project chưa gắn với Expo account.
6. Chạy `eas build --platform android --profile development`.

Khi build xong, terminal/EAS Dashboard sẽ hiện link tải APK hoặc trang install. Bạn mở link/QR đó trên điện thoại để tải app Development Build.

## Sau khi đã cài app Development Build trên điện thoại

Chạy:

```bat
EAS_START_LOCAL_SERVER_FOR_DEV_BUILD_WINDOWS.bat
```

Script này mở 2 cửa sổ:

- Backend: `npm run start-server`
- Metro dev-client: `npx expo start --dev-client --host lan -c`

Sau đó mở app Development Build trên điện thoại. Nếu chưa tự thấy server, bấm **Scan QR Code** hoặc **Fetch development servers**.

## Lưu ý iOS

- iOS real device cần Apple Developer account trả phí.
- Android dễ nhất: EAS sẽ tạo file `.apk` dạng internal distribution để tải trực tiếp.

## Backend/local API

App vẫn gọi backend bằng biến:

```env
EXPO_PUBLIC_API_URL=http://<IP_MAY_TINH>:4000
```

Script server sẽ tự ghi `.env` theo IPv4 Wi-Fi/Ethernet nếu tìm được. Nếu điện thoại không kết nối backend, sửa tay `.env` thành IP máy tính, ví dụ:

```env
EXPO_PUBLIC_API_URL=
```
