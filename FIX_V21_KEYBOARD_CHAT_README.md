# JAPANO v21 - Keyboard + Chatbot hotfix

Đã sửa:

1. Login / Register / Forgot Password
   - Không còn khai báo component `Input` bên trong màn hình.
   - Đổi sang `StableTextInput` + component `AuthInput` ổn định để tránh TextInput bị unmount/remount sau mỗi ký tự.
   - Mục tiêu: hết lỗi bàn phím Android/Expo Go tự đóng khi nhập email, mật khẩu, đăng ký, quên mật khẩu.

2. Redux Toolkit
   - Project không còn `@reduxjs/toolkit`, `react-redux`, `configureStore`, `useSelector`, `useDispatch` trong `package.json`, `package-lock.json`, `app`, `components`, `context`, `lib`, `data`.
   - App dùng `AppContext` + AsyncStorage thay cho Redux.

3. Chatbot
   - Sửa lỗi text trong ô chat bị xóa sau khi AI xử lý xong ảnh/video. Trước đó `focusNonce` tự `setText("")` nên user đang gõ câu tiếp theo có thể bị mất chữ.
   - Sửa `isImageRequest`: chữ "ảnh" thường không còn bị hiểu nhầm là yêu cầu tạo ảnh. Câu như "tôi gửi ảnh rồi, tư vấn tôi" sẽ đi qua chatbot tư vấn thay vì chạy Fotor tạo ảnh.
   - Thay ProductCard lớn trong chatbot bằng card gợi ý sản phẩm nhỏ hơn để tránh vùng trắng dài/tràn layout.
   - Sau bot reply có dòng nhắc "Bạn có thể hỏi tiếp ngay bên dưới".

Lệnh chạy sau khi giải nén:

```bat
cd /d C:\Users\minhn\Downloads\japano-fashion-ai-v21-keyboard-chat-hotfix
ollama serve
```

CMD khác:

```bat
cd /d C:\Users\minhn\Downloads\japano-fashion-ai-v21-keyboard-chat-hotfix
.venv\Scripts\activate.bat
npm run start-server
```

CMD khác:

```bat
cd /d C:\Users\minhn\Downloads\japano-fashion-ai-v21-keyboard-chat-hotfix
npx expo start -c
```

Nếu giải nén sang thư mục mới chưa có `node_modules` hoặc `.venv`, chạy lại cài đặt như v20.
