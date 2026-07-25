# PATCH V30 - Web Admin Fix

## Lỗi đã sửa

Expo Web bị fail bundle vì `@stripe/stripe-react-native` import native-only module trên web:

- `codegenNativeComponent`
- `codegenNativeCommands`

Khi Metro fail bundle, browser có thể báo thêm lỗi MIME type `application/json` vì endpoint bundle trả về JSON error thay vì JavaScript.

## Cách sửa

- Thêm `lib/stripe.native.ts`: re-export Stripe thật cho Android/iOS.
- Thêm `lib/stripe.web.tsx`: StripeProvider no-op và hook useStripe stub cho web.
- Đổi import trong:
  - `app/_layout.tsx`
  - `context/AppContext.tsx`
- Web admin vẫn chạy bình thường tại `/admin`.
- Stripe PaymentSheet chỉ test trên Android/iOS; web nên dùng COD hoặc chỉ quản trị admin.
- Thêm script:
  - `npm run web:clear`
- Sửa warning duplicate Mongoose index `idempotencyKey` trong `server/index.mjs` và `server/index.js`.

## Lệnh chạy web admin

Terminal backend:

```powershell
.\.venv\Scripts\Activate.ps1
$env:PYTHON_BIN="$PWD\.venv\Scripts\python.exe"
npm run start-server
```

Terminal web:

```powershell
$env:EXPO_PUBLIC_API_URL="http://localhost:4000"
npm run web:clear
```

Mở:

```text
http://localhost:8081/admin
```
