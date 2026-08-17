# Ngân hàng câu hỏi bảo vệ

40 câu hỏi hội đồng nhiều khả năng sẽ hỏi. Mỗi câu gồm: **vì sao hỏi**,
**trả lời ở đâu trong báo cáo**, **bằng chứng**, **khung trả lời**, **mức rủi ro**.

Mức rủi ro: 🔴 cao (dễ mất điểm nếu trả lời sai) · 🟡 trung bình · 🟢 thấp

---

## A. Nghiệp vụ và phạm vi

**1. Đề tài giải quyết vấn đề gì mà các sàn hiện có chưa giải quyết?** 🟡
*Vì sao hỏi:* kiểm tra động cơ đề tài có thật hay chỉ là làm lại một sàn thương mại điện tử.
*Khung trả lời:* mua thời trang trực tuyến không thử được đồ và khó chọn kích cỡ; nhóm tập trung vào ba can thiệp — thử đồ ảo, tư vấn kích cỡ, trợ lý có truy hồi sản phẩm thật.
*Rủi ro:* đừng nói "chưa ai làm" — hãy nói "nhóm làm ở quy mô đồ án với ràng buộc tự triển khai mô hình cục bộ".

**2. Vì sao chọn thị trường thời trang Nhật Bản?** 🟢
*Trả lời:* danh mục hẹp, thuộc tính sản phẩm rõ ràng (kimono, yukata, haori), thuận lợi cho việc gán nhãn và đánh giá truy hồi.

**3. Ai là người dùng mục tiêu và các em xác định bằng cách nào?** 🔴
*Vì sao hỏi:* dò xem có khảo sát thật không.
*Trả lời:* **phải nói thẳng là nhóm không thực hiện khảo sát người dùng.** Yêu cầu được rút ra từ phân tích các giải pháp hiện có và ràng buộc nghiệp vụ. Không được bịa số người tham gia khảo sát.

**4. Chức năng nào chưa hoàn thiện?** 🟡
*Trả lời:* thông báo đẩy từ xa (thiếu định danh dự án Expo), tích hợp đơn vị vận chuyển, phí vận chuyển động, triển khai môi trường thật. Xem `remaining_risks.md`.

---

## B. Kiến trúc

**5. Vì sao là khối đơn mà không phải vi dịch vụ?** 🟡
*Trả lời:* ba sinh viên, một miền nghiệp vụ, chưa có thành phần nào cần mở rộng độc lập. Tách dịch vụ sẽ thêm chi phí vận hành mà không giải quyết vấn đề đang có. Ứng viên tách đầu tiên là cụm suy luận AI, vì nó là thứ duy nhất cần GPU.

**6. Kiến trúc hiện tại chịu được bao nhiêu người dùng?** 🟡
*Bằng chứng:* `docs/project_evidence/load_tests/ramp.md`.
*Trả lời:* đo được thông lượng bão hoà ~180 yêu cầu/giây; p95 dưới 500 ms tới khoảng 50 client đồng thời; 0% lỗi tới 100 client.

**7. Vì sao cổng quản trị viết bằng JavaScript thuần?** 🟢
*Trả lời:* không cần bước biên dịch, Express phục vụ trực tiếp; đánh đổi là thiếu hệ sinh thái component.

**8. Toàn bộ state nằm trong bộ nhớ — chuyện gì xảy ra khi tiến trình chết?** 🔴
*Trả lời:* dữ liệu được đẩy xuống MongoDB theo lô với độ trễ 40 ms, nên thay đổi trong cửa sổ đó có thể mất. Đây là giới hạn R-03 đã ghi nhận.

**9. Vì sao React Native mà không phải native?** 🟢
*Trả lời:* cần cả hai nền tảng trong giới hạn nhân lực; đánh đổi là phụ thuộc lớp cầu nối.

---

## C. Cơ sở dữ liệu

**10. 35 hay 36 — rốt cuộc hệ thống có bao nhiêu bảng?** 🔴
*Vì sao hỏi:* con số không khớp là dấu hiệu báo cáo không khớp mã nguồn.
*Trả lời:* 35 collection vật lý, 36 thực thể trên mô hình logic. Chênh lệch hai chiều: `push_tokens` và `japan_spot_suggestions` là collection không có thực thể riêng; `Màu Sắc`, `Kích Thước`, `Hình Ảnh Giao Diện Sản Phẩm` là thực thể logic được nhúng vào tài liệu khác. Xem `project_facts.md` mục 3.1.

**11. MongoDB không có khoá ngoại, vậy các em bảo đảm toàn vẹn thế nào?** 🔴
*Trả lời:* hàm `relationshipErrors()` rà toàn bộ tham chiếu và được gọi trong `assertValid()` **trước mỗi lượt ghi**; phát hiện tham chiếu mồ côi thì ném lỗi 409 và huỷ lượt ghi.

**12. Vì sao đơn hàng lưu lặp lại tên và giá sản phẩm?** 🟡
*Trả lời:* đây là ảnh chụp tại thời điểm mua, có chủ đích. Sản phẩm đổi giá hay bị ẩn thì đơn cũ vẫn giữ đúng dữ liệu lúc mua.

**13. Các em có chỉ mục gì?** 🟡
*Trả lời:* 6 chỉ mục trong `ensureMongoIndexes()`. Nói rõ vì sao **không** thêm nữa: luồng nghiệp vụ đọc từ bộ nhớ nên chỉ mục không rút ngắn thời gian phản hồi, thêm vào chỉ làm chậm ghi.

**14. `db.json` là gì?** 🔴
*Trả lời:* bản dự phòng cục bộ khi MongoDB không truy cập được, **không phải** cơ chế sẵn sàng cao. Có sao lưu trước khi ghi đè. Rủi ro còn lại: không tự trộn ngược khi MongoDB trở lại (R-04).

---

## D. Giao dịch và đồng thời

**15. Hai khách cùng mua sản phẩm cuối cùng thì sao?** 🔴
*Bằng chứng:* `backend/test/checkout-concurrency.test.js`.
*Trả lời:* 50 lượt mua đồng thời trên tồn kho 5 → đúng 5 lượt thành công, tồn kho về 0, không âm.

**16. Các em có dùng transaction không?** 🔴
*Xem câu trả lời đầy đủ ở `defense_cheatsheet.md`.*

**17. Nếu chạy hai máy chủ thì sao?** 🔴
*Trả lời:* cơ chế hiện tại **mất hiệu lực**. Phải chuyển sang `findOneAndUpdate` có điều kiện hoặc transaction thật. R-01.

**18. Vì sao không dùng transaction luôn cho chắc?** 🟡
*Trả lời:* tầng lưu trữ hiện ghi cả khối theo lô, không tương thích với transaction theo phiên. Đổi sẽ phải viết lại toàn bộ tầng lưu trữ — rủi ro cao trong khi chưa có lỗi thực tế. Xem QĐ-03.

---

## E. Thanh toán

**19. Cổng thanh toán gọi lại hai lần thì sao?** 🔴
*Trả lời:* cờ `wasPaid` chặn gửi biên nhận trùng, `paidAt ||= now` giữ mốc đầu tiên, lịch sử trạng thái khử trùng theo mã giao dịch. VNPay trả mã `02 — Order already confirmed`.

**20. Khách đóng ứng dụng giữa lúc thanh toán thì sao?** 🟡
*Trả lời:* có điểm cuối đối soát hỏi ngược cổng thanh toán về trạng thái thật.

**21. Làm sao biết thông báo từ cổng thanh toán là thật?** 🔴
*Trả lời:* Stripe dùng `constructEvent` xác thực chữ ký; VNPay kiểm tra chữ ký HMAC SHA-512, sai thì trả mã `97`. Có đối chiếu số tiền, sai thì trả mã `04`.

**22. Khách sửa giá ở phía ứng dụng được không?** 🔴
*Trả lời:* không. `normalizedOrderItems()` bỏ qua giá client gửi và gọi `unitPrice()` tính lại theo đúng biến thể.

**23. Hoàn tiền một phần tính thế nào?** 🟡
*Trả lời:* theo từng sản phẩm được chấp thuận trả, `backend/lib/refundMath.js`, có kiểm thử `refund-per-item.test.js`.

**24. Đã chạy thanh toán thật chưa?** 🔴
*Trả lời:* **chưa** — Stripe ở chế độ thử nghiệm, VNPay ở môi trường Sandbox.

---

## F. Bảo mật

**25. Các em có kiểm tra bảo mật không?** 🔴
*Bằng chứng:* `docs/project_evidence/security/`.
*Trả lời:* rà toàn bộ 115 điểm cuối, tìm ra 9 chỗ thiếu kiểm soát truy cập, chứng minh bằng lời gọi thật, vá, viết 10 kiểm thử khoá lại. Bộ kiểm thử đi từ 3/10 lên 10/10.

**26. Lỗ hổng nghiêm trọng nhất là gì?** 🔴
*Trả lời:* `GET /api/payments/:id` — mã giao dịch đếm tăng dần nên đoán được, mà điểm cuối trả về cả họ tên, số điện thoại, địa chỉ khách. Đã chứng minh và đã vá.

**27. Vì sao trả 404 mà không phải 403?** 🟡
*Trả lời:* 403 xác nhận mã đó có thật, đủ để dò ra dải mã đang dùng. 404 không tiết lộ gì.

**28. Mật khẩu lưu thế nào?** 🟢
*Trả lời:* băm bcrypt kèm chuỗi ngẫu nhiên. Tối thiểu 8 ký tự, chặn mật khẩu phổ biến.

**29. Chống dò mật khẩu thế nào?** 🟡
*Trả lời:* giới hạn 20 lần/15 phút trên nhóm `/auth`; mã đặt lại tối đa 5 lần sai, gửi lại cách nhau 60 giây.

**30. Nhân viên có xem được đơn hàng của khách không?** 🟡
*Trả lời:* có — vai trò `staff` trở lên. Khách chỉ xem được đơn của chính mình; đã có kiểm thử.

**31. Hệ thống của các em có an toàn không?** 🔴
*Trả lời:* **không được nói "tuyệt đối".* Nêu các biện pháp đã có, rồi nêu thẳng ba thứ chưa làm: kiểm thử xâm nhập, rà soát chèn toán tử MongoDB, rà soát chèn mã kịch bản ở trang quản trị.

**32. Ảnh thử đồ của người dùng lưu ở đâu?** 🟡
*Trả lời:* Cloudinary, tham chiếu trong `tryon_history`. Nêu thẳng: chưa có chính sách thời hạn lưu trữ và chưa có chức năng người dùng tự xoá — đây là hạn chế.

---

## G. Trí tuệ nhân tạo

**33. Mô hình nào chạy ở đâu?** 🔴
*Trả lời:* toàn bộ chạy **cục bộ**. Ollama cho hội thoại, MiniLM đa ngôn ngữ cho vector, CatVTON và FASHN cho thử đồ, One-to-All cho video. Không dùng AI đám mây. Nếu hội đồng hỏi về Gemini: biến môi trường có tồn tại nhưng **không mã nào đọc**, và báo cáo đã sửa.

**34. Trợ lý có phải RAG không?** 🟡
*Trả lời:* có bước truy hồi sản phẩm thật rồi mới đưa vào ngữ cảnh, nên đúng là truy hồi có căn cứ. Nhưng nên nói khiêm tốn: đây là truy hồi từ kho hàng nội bộ, chưa phải hệ RAG đầy đủ với chỉ mục vector chuyên dụng.

**35. Tìm kiếm ngữ nghĩa tốt hơn bao nhiêu?** 🔴
*Xem câu trả lời đầy đủ ở `defense_cheatsheet.md`. Trả lời trung thực là **chưa** tốt hơn.*

**36. Vì sao chọn mô hình MiniLM?** 🟡
*Trả lời:* hỗ trợ đa ngôn ngữ gồm tiếng Việt, kích thước nhỏ (~470 MB) nên chạy được trên GPU máy phát triển cùng lúc với các dịch vụ khác. Nói rõ: lựa chọn dựa trên ràng buộc phần cứng và hỗ trợ tiếng Việt, **không** dựa trên một thí nghiệm so sánh nhiều mô hình.

**37. Chất lượng ảnh thử đồ đánh giá thế nào?** 🔴
*Trả lời:* mới **kiểm chứng chức năng** (mô hình trả về ảnh), **chưa đánh giá chất lượng** bằng phương pháp có đối chứng. Phân biệt rõ hai khái niệm này.

**38. AI hỏng thì hệ thống có sập không?** 🟡
*Trả lời:* không. Đã kiểm chứng: tắt dịch vụ vector, điểm cuối sản phẩm liên quan vẫn trả về 8 kết quả bằng tín hiệu khác.

---

## H. Kiểm thử và phương pháp

**39. Các em kiểm thử thế nào?** 🟡
*Trả lời:* 156 kiểm thử tự động, 156 đạt. Trong đó có kiểm thử đồng thời, kiểm soát truy cập, tính giá, hoàn tiền theo sản phẩm, hàng đợi GPU. Kèm ba kịch bản đo lặp lại được.

**40. Có con số nào trong báo cáo mà các em không đo được không?** 🔴
*Vì sao hỏi:* đây là câu kiểm tra tính trung thực.
*Trả lời:* có, và nhóm đã gỡ chúng — cụ thể là "60 FPS" và "uptime 99,9%" vì môi trường hiện tại không dựng được phép đo đáng tin cậy. Những con số còn lại trong báo cáo đều có tệp bằng chứng trong `docs/project_evidence/`.
