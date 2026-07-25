# JAPANO v19 - Chatbot ảnh/video + YOLOv8 + Gemini + Ollama

## Đã chỉnh chatbot

- Sau khi người dùng gửi ảnh hoặc video trong chatbot, app tự chạy ngay luồng:
  1. Upload media lên Cloudinary.
  2. Backend chạy `server/vision_analyze.py`.
  3. YOLOv8 nhận diện người/object/trang phục/phụ kiện.
  4. DeepFace ước lượng nhóm tuổi và biểu cảm.
  5. Backend đưa kết quả vision sang Gemini để tạo brief stylist.
  6. Backend đưa brief Gemini + dữ liệu YOLOv8/DeepFace + catalog sản phẩm sang Ollama để trả lời trong chatbot.
  7. Chatbot tự hiện gợi ý outfit/sản phẩm, không bắt user phải hỏi lại.

- Input chatbot được reset/focus lại sau khi xử lý ảnh/video để user hỏi câu tiếp theo.
- Chat chỉ giữ ngữ cảnh tối đa 10 lượt hỏi/đáp gần nhất trong phiên hiện tại.
- Không lưu lịch sử chatbot vào MongoDB.
- Ảnh/file/video upload và ảnh AI tạo ra đều lưu qua Cloudinary; MongoDB chỉ lưu metadata/URL.

## Cài Vision AI

```bash
cd appne
pip install -r server/vision-requirements.txt
```

Nếu muốn tải YOLOv8 model trước:

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

## Chạy app

```bash
npm install --legacy-peer-deps
npm run dev:full
```

Hoặc chạy riêng:

```bash
npm run start-server
npx expo start -c
```

## Kiểm tra backend

```bash
node --check server/index.mjs
node --check server/index.js
```

## Lưu ý

YOLOv8 dùng để phát hiện người/object. Phần biểu cảm và tuổi được DeepFace xử lý, vì YOLOv8 mặc định không phải model age/emotion. Backend gom kết quả lại thành một pipeline Vision AI cho chatbot.
