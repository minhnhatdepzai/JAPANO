# JAPANO Fashion AI V37 - Full Code

Bản này là full source đã gộp:

- V33: fix logout/login admin
- V34: mỗi sản phẩm 4 ảnh, gallery ảnh lớn/ảnh nhỏ, size, màu sắc, kích thước
- V35: fix API timeout/IP LAN cũ + warning web
- V36: Stripe API keys + PaymentSheet endpoints
- V37: Cloudinary upload ảnh/video/audio/file qua backend

## Chạy nhanh trên Windows

1. Giải nén ZIP.
2. Mở thư mục `japano-fashion-ai-v37-cloudinary-stripe-full-code`.
3. Bấm chạy:

```bat
RUN_WEB_ADMIN_WINDOWS.bat
```

Hoặc chạy full app Expo Go:

```bat
START_HERE_WINDOWS.bat
```

## Lệnh thủ công

```bat
npm install --legacy-peer-deps
npm run start-server
npx expo start -c
```

Test backend:

- http://localhost:4000/api/health
- http://localhost:4000/api/cloudinary/config
- http://localhost:4000/api/stripe/config

Admin demo:

- Email: `a@gmail.com`
- Mật khẩu: `1`

## Lưu ý bảo mật

File `.env.server` trong bản này đang chứa test keys bạn đã cung cấp để chạy nhanh. Không upload ZIP/source này lên GitHub hoặc gửi cho người khác. Khi chạy ổn, hãy rotate lại Stripe/Cloudinary/Gemini/Fotor/MongoDB keys nếu các key đã từng bị lộ.
