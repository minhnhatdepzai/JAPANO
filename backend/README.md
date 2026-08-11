# JAPANO Backend

Node.js + Express. Khi cấu hình `MONGODB_URI`, MongoDB là nơi lưu dữ liệu chính cho Admin và mobile; `data/db.json` chỉ được dùng để seed/migration khi chưa cấu hình MongoDB. Media chỉ lưu URL Cloudinary trong MongoDB. Trang Admin được phục vụ tại `/`.

Từ thư mục gốc, chạy backend riêng bằng:

```bash
PORT=4100 npm run backend
```

- Admin: <http://localhost:4100>
- API: <http://localhost:4100/api>
- Kiểm tra dịch vụ AI: <http://localhost:4100/api/ai/health>

Để chạy cả backend và app Android, dùng `./start-all.sh` ở thư mục gốc.
