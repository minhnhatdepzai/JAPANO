# JAPANO Backend

Node.js + Express. Dữ liệu dùng chung với Admin và mobile được lưu tại `data/db.json`; lần chạy đầu backend tự tạo catalog mẫu nếu file chưa tồn tại. Trang Admin được phục vụ tại `/`.

Từ thư mục gốc, chạy backend riêng bằng:

```bash
PORT=4100 npm run backend
```

- Admin: <http://localhost:4100>
- API: <http://localhost:4100/api>
- Kiểm tra dịch vụ AI: <http://localhost:4100/api/ai/health>

Để chạy cả backend và app Android, dùng `./start-all.sh` ở thư mục gốc.
