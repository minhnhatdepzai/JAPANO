# V25 - Stripe PaymentSheet

## Đã thêm

- Cài dependency:
  - `@stripe/stripe-react-native` cho Expo/React Native PaymentSheet.
  - `stripe` cho backend Node.js.
- Root app được bọc bằng `StripeProvider`.
- Checkout đơn hàng online dùng Stripe PaymentSheet.
- Nâng cấp VIP 500.000đ dùng Stripe PaymentSheet, thanh toán xong mới set VIP.
- Backend tạo `PaymentIntent`, `EphemeralKey`, `Customer` và xác nhận `PaymentIntent` trước khi lưu đơn/VIP.

## API mới

- `GET /api/stripe/config`
- `POST /api/stripe/payment-sheet`
- `POST /api/stripe/confirm-vip`
- `POST /api/stripe/confirm-order`

## Env cần có

Frontend `.env`:

```env
EXPO_PUBLIC_API_URL=http://<IP_WIFI_MAY_TINH>:4000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Backend `.env.server`:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_CURRENCY=vnd
STRIPE_API_VERSION=2024-06-20
STRIPE_MERCHANT_DISPLAY_NAME=JAPANO Fashion AI
VIP_PRICE=500000
FREE_TRY_ON_LIMIT=2
```

## Lưu ý

- Không đưa `STRIPE_SECRET_KEY` vào frontend.
- Không public `.env.server` lên GitHub.
- Google Pay / Apple Pay cần development build, Expo Go không hỗ trợ hai ví này. PaymentSheet thẻ vẫn dùng cho test flow.
