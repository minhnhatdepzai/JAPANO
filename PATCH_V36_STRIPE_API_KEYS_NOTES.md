# V36 - Stripe API Keys Setup

Patch này cấu hình Stripe test mode cho JAPANO.

## File đã chỉnh

- `.env`: cập nhật `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` cho Expo/frontend.
- `.env.server`: cập nhật `STRIPE_SECRET_KEY`, `STRIPE_RESTRICTED_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_CURRENCY`, `STRIPE_API_VERSION`.
- `.env.example`: thêm mẫu cấu hình Stripe an toàn.
- `app/_layout.tsx`: bỏ publishable key cũ bị hard-code, chỉ đọc từ `.env`.
- `server/index.mjs` và `server/index.js`: backend đọc `STRIPE_SECRET_KEY`; nếu trống thì fallback sang `STRIPE_RESTRICTED_KEY`. Endpoint `/api/stripe/config` chỉ trả trạng thái, không trả secret.

## Cách test

1. Copy đè các file trong ZIP vào project.
2. Chạy lại backend:

```bat
npm run start-server
```

3. Mở:

```txt
http://localhost:4000/api/stripe/config
```

Kỳ vọng:

```json
{"enabled":true,"currency":"vnd","keyMode":"secret"}
```

4. Chạy lại Expo bằng cache clear:

```bat
npx expo start -c
```

5. Đăng nhập app, thêm sản phẩm vào giỏ, vào Thanh toán, chọn Stripe.

## Lưu ý bảo mật

Bạn đã dán `sk_test` và `rk_test` trong chat. Đây là test key nhưng vẫn nên rotate sau khi test xong. Secret/restricted key chỉ để trong `.env.server`, không đưa vào frontend, không commit lên GitHub.
