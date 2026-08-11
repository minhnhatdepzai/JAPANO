# DANH MỤC BẢNG

> **Ghi chú:** cột số trang để `...`, tự sinh lại khi xuất Word. Tên bảng lấy **nguyên văn** từ 8 tệp chương trong `thesis/chapters/`.

| Số hiệu | Tên bảng | Chương | Trang |
|---|---|---|---|
| Bảng 1.1 | Mục tiêu dự án và trạng thái đạt được | 1 | ... |
| Bảng 1.2 | Phạm vi chức năng của JAPANO Store | 1 | ... |
| Bảng 1.3 | Danh sách thành viên thực hiện | 1 | ... |
| Bảng 2.1 | Yêu cầu nghiệp vụ và chức năng đáp ứng | 2 | ... |
| Bảng 2.2 | Tổng hợp vai trò và phạm vi quyền hạn | 2 | ... |
| Bảng 2.3 | Kế hoạch thực hiện dự án | 2 | ... |
| Bảng 3.1 | Thành phần triển khai hệ thống | 3 | ... |
| Bảng 3.2 | Danh sách Use Case được đặc tả chi tiết | 3 | ... |
| Bảng 4.1 | Công nghệ sử dụng trong dự án | 4 | ... |
| Bảng 4.2 | Các nhóm dữ liệu chính trong kho JSON | 4 | ... |
| Bảng 4.3 | Các màn hình chính cần minh hoạ | 4 | ... |
| Bảng 5.1 | Cấu trúc mã nguồn chính | 5 | ... |
| Bảng 5.2 | Chức năng quản trị đã triển khai | 5 | ... |
| Bảng 5.3 | Một số API tiêu biểu theo nhóm nghiệp vụ | 5 | ... |
| Bảng 6.1 | Phân bố kiểm thử tự động theo module | 6 | ... |
| Bảng 6.2 | Kịch bản kiểm thử thủ công — người dùng | 6 | ... |
| Bảng 6.3 | Kịch bản kiểm thử thủ công — quản trị viên | 6 | ... |
| Bảng 6.4 | Phạm vi kiểm thử tự động | 6 | ... |
| Bảng 7.1 | Yêu cầu môi trường theo ba mức triển khai | 7 | ... |
| Bảng 7.2 | Các nhóm biến môi trường | 7 | ... |
| Bảng 7.3 | Hạng mục cần hoàn thiện trước khi triển khai thật | 7 | ... |
| Bảng 8.1 | Đối chiếu mục tiêu và kết quả đạt được | 8 | ... |
| Bảng 8.2 | Ưu điểm và hạn chế của hệ thống | 8 | ... |

**Tổng: 23 bảng**, phân bố ở cả 8 chương.

---

## Nhận xét về quy ước đánh số

Quy ước đánh số bảng hiện **đã nhất quán** trên toàn bộ 8 chương: mọi bảng đều theo dạng `Bảng <số chương>.<số thứ tự>`, số thứ tự liên tục trong từng chương, không nhảy số và không trùng số. Không cần sửa.

Các bảng trong ba phụ lục (Phụ lục A, B, C) **không đánh số theo dãy này** — chúng dùng hệ đánh số riêng theo phụ lục (A.1, A.2…) và không đưa vào danh mục bảng của thân bài. Đây là cách trình bày thông dụng; nếu trường yêu cầu gộp cả bảng phụ lục vào danh mục, nhóm bổ sung sau.

## Việc nhóm bắt buộc phải làm

**Bảng 6.2 và Bảng 6.3 hiện chỉ có cột "Kết quả mong đợi", chưa có cột "Kết quả thật".** Cột kết quả mong đợi được suy ra từ mã nguồn nên có căn cứ; cột kết quả thật **bắt buộc phải do nhóm tự chạy kiểm thử tay** trên ứng dụng đang chạy rồi điền, không được suy đoán hay điền "Pass" cho toàn bộ. Một bảng kiểm thử thủ công mà mọi dòng đều Pass và không có ghi chú nào thường bị hội đồng đặt câu hỏi về tính xác thực.

**Bảng 1.3 (Danh sách thành viên thực hiện)** cần rà soát lại, đặc biệt cột phân công nhiệm vụ — bản chụp repo này không có lịch sử git dùng được nên không thể đối chiếu ai đã làm phần nào (chi tiết ở Phụ lục C, mục C.3).

**Bảng 2.3 (Kế hoạch thực hiện dự án)** cần mốc thời gian thật của từng giai đoạn. Không có git log để đối chiếu, nên nhóm phải lấy từ nhật ký làm việc thật; không bịa ngày tháng cho khớp bảng.
