# DANH MỤC HÌNH

> **Ghi chú:** cột số trang để `...`, tự sinh lại khi xuất Word (Insert Caption → Insert Table of Figures). Danh mục dưới đây liệt kê **các hình đã được đánh số và có chú thích thật trong nội dung 8 chương**, không liệt kê hình chưa tồn tại.

| Số hiệu | Tên hình | Chương | Trang |
|---|---|---|---|
| Hình 3.1 | Sơ đồ kiến trúc triển khai hệ thống JAPANO Store | 3 | ... |
| Hình 3.2 | Sơ đồ Use Case của người dùng (khách hàng) JAPANO Store | 3 | ... |
| Hình 3.3 | Sơ đồ Use Case của quản trị viên JAPANO Store, phân theo cấp vai trò | 3 | ... |

**Hiện tại chỉ có 3 hình được đánh số, toàn bộ nằm ở Chương 3.**

---

## Ghi chú bắt buộc về tính nhất quán đánh số hình

Ba hình trên hiện được trình bày dưới dạng **sơ đồ Mermaid** trong tệp Markdown. Khi xuất sang Word, chúng phải được kết xuất thành ảnh hoặc vẽ lại bằng công cụ UML chuẩn (draw.io, PlantUML, StarUML) — riêng Hình 3.2 và 3.3 là sơ đồ Use Case nên cần đúng ký hiệu UML (actor, use case, association, `<<include>>`/`<<extend>>` nếu dùng).

Các chương còn lại **chưa có hình nào được đánh số**. Bảng dưới đây liệt kê những vị trí cần bổ sung hình, kèm việc phải làm. Nhóm chỉ thêm dòng vào danh mục phía trên **sau khi** hình thật đã được chèn vào chương tương ứng.

| Vị trí | Hiện trạng | Việc cần làm |
|---|---|---|
| Chương 3, mục 3.1.2 | Chuỗi middleware trình bày dạng khối văn bản | Chuyển thành sơ đồ luồng và đánh số `Hình 3.4` nếu muốn tính là hình |
| Chương 3, mục 3.1.3 | Cơ chế tiêm phụ thuộc `ctx` mô tả bằng chữ | Nên vẽ sơ đồ `route → ctx → store/Cloudinary/Stripe/VNPay`, đánh số `Hình 3.5` |
| Chương 4, mục 4.2.1 | Kho dữ liệu JSON mô tả bằng bảng | Cần sơ đồ cấu trúc document JSON lồng nhau (không phải ERD quan hệ) |
| Chương 4, mục 4.2.2 | Lược đồ quan hệ chuẩn hoá mô tả bằng chữ | Cần ERD cho `japano_schema_v2.sql`; **ghi rõ trên hình: "thiết kế, chưa triển khai runtime"** |
| Chương 4, mục 4.3.1 | Sitemap ứng dụng di động mô tả bằng chữ | Cần vẽ sitemap và đánh số `Hình 4.x` |
| Chương 4, mục 4.3.2 | Sitemap trang quản trị Web mô tả bằng chữ | Cần vẽ sitemap và đánh số `Hình 4.x` |
| Chương 4, mục 4.4 | Bảng 4.3 liệt kê 10 màn hình cần minh hoạ | **Chưa có ảnh chụp màn hình thật nào** — bắt buộc chụp từ ứng dụng đang chạy, đánh số và chú thích từng ảnh |
| Chương 5, mục 5.1 | Cây thư mục mã nguồn dạng khối văn bản | Đánh số nếu trình bày dưới dạng hình |
| Chương 5, mục 5.2.6 | Luồng thử đồ AI mô tả bằng chữ | Nên vẽ sơ đồ luồng: ảnh → chuẩn hoá dáng → FASHN → cổng kiểm chất lượng → dự phòng CatVTON |
| Chương 5, mục 5.3 | Luồng duyệt trả hàng mô tả bằng chữ | Nên vẽ sơ đồ trạng thái: `requested → approved/rejected → received → refunded` |
| Chương 6, mục 6.1.2 | Kết quả `node --test` dạng khối văn bản (50 pass / 0 fail) | Nên bổ sung ảnh chụp màn hình terminal và đánh số `Hình 6.x` để có bằng chứng trực quan |

### Nguyên tắc

- **Không đánh số cho hình chưa tồn tại.** Danh mục hình phải khớp tuyệt đối với hình thật trong thân bài; hội đồng sẽ đối chiếu.
- **Ảnh chụp màn hình phải chụp từ ứng dụng đang chạy thật**, không dựng lại bằng công cụ thiết kế giao diện.
- Khi chú thích ảnh màn hình ở mục 4.4, phải **ghi rõ tính năng nào chưa hoạt động đầy đủ** (ví dụ: form chỉnh sửa hồ sơ hiện chưa lưu được dữ liệu), tránh để ảnh ngầm khẳng định tính năng đã hoàn chỉnh.
