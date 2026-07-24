# JAPANO v18 - Fotor Try-on + Cloudinary + Chatbot Memory

## Điểm đã sửa

- Tạo ảnh thử đồ dùng Fotor OpenAPI, không dùng Gemini image model.
- Backend gọi `/v1/aiart/imagegeneration/{provider}` để tạo task, sau đó poll `/v1/aiart/tasks/{taskId}` để lấy ảnh kết quả.
- Ảnh người dùng upload, ảnh link, ảnh kết quả Fotor, file và video chatbot/Vision đều được upload lên Cloudinary. MongoDB chỉ lưu metadata và URL Cloudinary.
- Chatbot không lưu lịch sử hội thoại vào database. Frontend chỉ giữ ngữ cảnh gần nhất trong phiên, tối đa khoảng 10 câu trả lời gần nhất.
- Home có 3 nút icon-only: thông báo, giỏ hàng, yêu thích.
- Bỏ voice-to-text, nút nói, RECORD_AUDIO và faster-whisper.

## Lệnh chạy

```bash
npm install --legacy-peer-deps
npm run dev:full
```

Hoặc chạy riêng:

```bash
npm run start-server
npx expo start -c
```

## Biến môi trường cần có trong `.env.server`

```env
FOTOR_API_KEY=your_fotor_key_here
FOTOR_PROVIDER=gemini-3-pro-image-preview
FOTOR_TRYON_WIDTH=896
FOTOR_TRYON_HEIGHT=1152
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
CLOUDINARY_ROOT_FOLDER=japano
GEMINI_API_KEY=your_gemini_key_here
GEMINI_TEXT_MODEL=gemini-2.0-flash
```
