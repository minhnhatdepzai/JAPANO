# PATCH V28 - MongoDB chỉ giữ collection theo ERD

Bản này đã chỉnh backend để MongoDB không còn tạo collection phụ ngoài ERD.

## Collection MongoDB được giữ lại

- `categories`
- `products`
- `productvariants`
- `images`
- `colors`
- `sizes`
- `users`
- `aichats`
- `wishlists`
- `notifications`
- `forgotpasswords`
- `reviews`
- `orders`
- `orderitems`
- `payments`
- `discountcodes`
- `carts`

## Collection phụ đã chuyển sang RAM, không lưu MongoDB nữa

Các dữ liệu phụ như `services`, `fileassets`, `generatedimages`, `searchhistories`, `games`, `gamehistories`, `visionanalyses`, `stylistprofiles`, `bodyprofiles`, `outfitcollections`, `dailystylistquizzes` không còn được tạo thành collection MongoDB.

Lý do: chúng không nằm trong ERD bạn gửi, nên backend chỉ giữ dạng tạm trong RAM cho demo/app chạy tiếp, tránh database bị lung tung.

## Cách xoá collection thừa đang có trong MongoDB thật

Trên Windows, chạy:

```bat
CLEAN_MONGO_ERD_ONLY_WINDOWS.bat
```

Hoặc chạy thủ công:

```bash
npm run mongo:clean-erd
```

Script sẽ đọc `MONGODB_URI` trong `.env.server`, liệt kê collection thừa, sau đó xoá những collection không nằm trong danh sách ERD.

## Lưu ý

- Đây là thao tác xoá thật trong MongoDB, nên hãy chắc chắn đang trỏ đúng database.
- Nếu cần backup, export database trước khi chạy script.
- Sau bản này, khi backend chạy lại, các collection phụ ngoài ERD sẽ không bị tạo lại nữa.
