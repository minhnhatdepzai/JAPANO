# JAPANO Expo Go v16 - Chatbot dùng YOLOv8/DeepFace

Bản này sửa:

- Chatbot khi gửi ảnh/video sẽ gọi backend `/api/vision/style-from-media`.
- Backend chạy Python `server/vision_analyze.py` bằng YOLOv8 + DeepFace/OpenCV để nhận dạng người, object, tuổi, cảm xúc.
- Kết quả vision được lưu và được gửi vào chatbot khi hỏi “phối đồ cho tôi”.
- Khi cập nhật sinh nhật/ngày đặc biệt ở Profile, Home/Shop/Chat sẽ dùng dữ liệu mới để gợi ý sản phẩm theo dịp.
- Bỏ cơ chế tự focus TextInput gây lỗi bàn phím Android.

## Chạy

Terminal 1:

```cmd
cd C:\Users\minhn\Downloads\japano-fashion-ai-expo-go-image-video-yolo-v16\appne
npm run start-server
```

Terminal 2:

```cmd
ollama run qwen2.5:1.5b
```

Terminal 3:

```cmd
cd C:\Users\minhn\Downloads\japano-fashion-ai-expo-go-image-video-yolo-v16\appne
npx expo start -c --host lan
```

## Test backend

```cmd
curl http://localhost:4000/api/health
curl http://localhost:4000/api/vision/health
```
