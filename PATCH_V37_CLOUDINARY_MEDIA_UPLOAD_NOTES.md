# PATCH V37 - Cloudinary Media Upload

Patch này thêm Cloudinary vào backend và admin để media không chỉ nằm local.

## Đã thêm

- Cấu hình Cloudinary trong `.env.server`:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_URL`
  - `CLOUDINARY_ROOT_FOLDER=japano`
- Endpoint kiểm tra cấu hình:
  - `GET /api/cloudinary/config`
- Endpoint upload file chung cho app:
  - `POST /api/media/upload`
  - nhận ảnh, video, audio, file thường
- Endpoint copy file từ URL sang Cloudinary:
  - `POST /api/media/upload-remote`
- Endpoint upload riêng cho admin:
  - `POST /api/admin/media/upload`
- Admin Products có nút upload ảnh 1/2/3/4 lên Cloudinary rồi tự điền URL.
- Admin Promotions có nút upload banner lên Cloudinary.
- Avatar user trong profile được upload lên Cloudinary thay vì chỉ lưu local URI.
- Chat upload, Vision upload, Try-on và ảnh AI generated vẫn lưu qua Cloudinary như nền cũ.

## Cách test

1. Copy đè các file trong patch vào project.
2. Chạy backend:

```bat
npm run start-server
```

3. Mở:

```txt
http://localhost:4000/api/cloudinary/config
```

Kết quả đúng sẽ có:

```json
{
  "enabled": true,
  "cloudName": "dhnonixkw",
  "rootFolder": "japano"
}
```

4. Vào `/admin` > Products > bấm Upload ảnh 1/2/3/4.
5. Kiểm tra Cloudinary Media Library, file sẽ nằm trong folder `japano/admin/products`.

## Lưu ý bảo mật

File `.env.server` có chứa Cloudinary API secret. Không upload lên GitHub, không gửi cho người khác. Nếu key đã bị lộ ở chat hoặc nơi công khai, hãy rotate API secret trong Cloudinary sau khi test xong.
