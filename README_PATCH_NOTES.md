# JAPANO v26 stabilized patch

Các thay đổi chính:

- Chatbot: không đứng im khi Gemini 429/403 hoặc Ollama timeout; luôn có fallback local.
- Ollama: mặc định chuyển sang `qwen2.5:7b`, timeout 10 giây, cooldown để không spam lỗi.
- Gemini: timeout 9 giây, retry nhẹ 1 lần với lỗi tạm thời, cooldown với 429/403/timeout.
- Chat UI: gom Camera/Ảnh/Dán/File/Tạo ảnh/Gửi lại vào nút `+`, input gọn hơn, không phình quá cao.
- Camera AI: ẩn traceback Python, chỉ hiện thông báo thân thiện.
- Try-on: thêm Demo Mode. Nếu Fotor/API/credit lỗi, trang không văng lỗi; tạm hiển thị ảnh nguồn và thông báo rõ.
- Vision backend: ép UTF-8 cho Python và lọc lỗi kỹ thuật trước khi trả về app.

Không tự xóa model Ollama cũ. Muốn xóa thì tự chạy `ollama rm <model>` sau khi kiểm tra `ollama list`.
