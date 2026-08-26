# Ảnh kiểm thử thủ công cho tính năng thử đồ theo độ vừa vặn

Thư mục này chứa **ảnh thật** để đánh giá bằng mắt — không có ảnh nào được
commit sẵn vì đó là ảnh chân dung của người thật. Bạn tự bỏ ảnh vào đây.

## Cần những ca nào

| Tên file bắt đầu bằng | Người mẫu | Size chọn | Size khuyến nghị | Mong đợi nhìn thấy |
|---|---|---|---|---|
| `normal_body_M_M`  | vóc dáng trung bình | M   | M   | vừa người, form chuẩn, KHÔNG có hiệu ứng |
| `large_body_S_XL`  | vóc dáng lớn        | S   | XL  | vải căng, đường may bị kéo, nút căng |
| `large_body_M_XXL` | vóc dáng lớn        | M   | XXL | căng mạnh, có thể bục một đoạn đường may |
| `small_body_XL_S`  | vóc dáng nhỏ        | XL  | S   | vai trễ, tay áo dài, thân thùng thình |
| `small_body_XXL_M` | vóc dáng nhỏ        | XXL | M   | rủ rất rộng, silhouette như áo choàng |
| `kimono_tight`     | bất kỳ              | nhỏ hơn 2 bậc | — | kimono/haori bó, vẫn giữ cổ áo và tay rộng đặc trưng |
| `kimono_loose`     | bất kỳ              | lớn hơn 2 bậc | — | kimono/haori rủ rộng, tay áo phồng, giữ đúng form |
| `bottom_tight`     | bất kỳ              | quần nhỏ hơn 2 bậc | — | căng ở eo/hông/đùi, KHÔNG có hiệu ứng rách |
| `bottom_loose`     | bất kỳ              | quần lớn hơn 2 bậc | — | cạp rộng, ống rộng, nhiều nếp gấp |

Đặt tên: `<tên ca>_<mô tả>.jpg`, ví dụ `large_body_S_XL_result.jpg`.
Nên lưu cả ảnh gốc (`..._input.jpg`) để so sánh trước/sau.

## Cách chấm

```bash
python3 backend/ai_training/evaluate_tryon_manual.py --init   # tạo bảng chấm
# mở backend/ai_training/manual_evaluation.csv và điền điểm
python3 backend/ai_training/evaluate_tryon_manual.py          # tổng hợp
```

## Lưu ý riêng tư

Ảnh ở đây là dữ liệu cá nhân. `.gitignore` của dự án đã loại trừ thư mục này
để không đẩy ảnh người thật lên nơi công khai.
