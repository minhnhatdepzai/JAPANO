# Kiểm thử tải — tăng dần số client đồng thời

Môi trường: máy phát triển cục bộ, backend Node.js + MongoDB Atlas thật.
Không kiểm thử tải lên Stripe/VNPay (chỉ dùng sandbox, không bắn tải vào dịch vụ bên thứ ba).
Giới hạn tần suất được nới tạm thời chỉ để đo (JAPANO_RATE_LIMIT_MAX), không phải cấu hình chạy thật.

| Điểm cuối | Client đồng thời | avg (ms) | p95 (ms) | p99 (ms) | req/s | Tỉ lệ lỗi |
|---|---:|---:|---:|---:|---:|---:|
| products (danh sách đầy đủ) | 1 | 9.5 | 11.2 | 11.2 | 105.6 | 0% |
| state (toàn bộ dữ liệu quản trị) | 1 | 10.5 | 12.2 | 12.2 | 95 | 0% |
| products (danh sách đầy đủ) | 10 | 50 | 87.5 | 92.6 | 192.3 | 0% |
| state (toàn bộ dữ liệu quản trị) | 10 | 70.1 | 124.4 | 130.6 | 137.3 | 0% |
| products (danh sách đầy đủ) | 25 | 124.5 | 239 | 244.7 | 192.6 | 0% |
| state (toàn bộ dữ liệu quản trị) | 25 | 172.6 | 333.5 | 345.1 | 139.1 | 0% |
| products (danh sách đầy đủ) | 50 | 260.1 | 274.1 | 526.2 | 183.7 | 0% |
| state (toàn bộ dữ liệu quản trị) | 50 | 349.2 | 407 | 712.3 | 137.4 | 0% |
| products (danh sách đầy đủ) | 100 | 528.4 | 570.1 | 1052.7 | 180.9 | 0% |
| state (toàn bộ dữ liệu quản trị) | 100 | 701.2 | 734.7 | 1439.2 | 136.8 | 0% |
