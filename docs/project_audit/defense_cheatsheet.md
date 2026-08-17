# Phiếu tóm tắt bảo vệ đồ án

Mọi con số dưới đây đều lấy từ hệ thống thật, có tệp bằng chứng kèm theo.
**Học thuộc phần in đậm.**

---

## Mười con số phải nhớ

| Con số | Ý nghĩa |
|---|---|
| **115** | điểm cuối REST, trong 17 tệp định tuyến |
| **35 / 36** | 35 collection vật lý · 36 thực thể trên mô hình logic |
| **50** | quan hệ khoá ngoại trên ERD |
| **4** | vai trò xếp thứ bậc: `customer < staff < admin < super_admin` |
| **156 / 156** | kiểm thử tự động đạt, 0 hỏng |
| **9** | lỗ hổng kiểm soát truy cập đã tìm ra và vá trong đợt kiểm toán |
| **~180** | yêu cầu/giây — thông lượng bão hoà đo được |
| **~50** | số người dùng đồng thời mà p95 vẫn dưới 500 ms |
| **24** | truy vấn trong bộ đánh giá tìm kiếm |
| **0** | lời gọi `startSession`/`withTransaction` trong toàn bộ mã máy chủ |

---

## Mười đóng góp kỹ thuật của nhóm

1. **Tính nguyên tử của luồng đặt hàng** — kiểm tra tồn kho và trừ kho trong một
   lượt sửa đổi đồng bộ; chứng minh bằng kiểm thử 50 lượt mua đồng thời trên tồn kho 5.
2. **Chống xử lý trùng ở ba tầng** — `clientRequestId` khi tạo đơn, cờ `wasPaid`
   khi xác nhận thanh toán, cờ `stockRestoredAt` khi hoàn kho.
3. **Giá luôn tính lại ở máy chủ** — `unitPrice()` theo đúng biến thể; số tiền
   client gửi lên bị bỏ qua hoàn toàn.
4. **Kiểm soát truy cập theo vai trò và quyền sở hữu** — kèm mẹo trả 404 thay 403
   để không xác nhận mã tồn tại.
5. **Kiểm tra toàn vẹn tham chiếu ở tầng ứng dụng** — `relationshipErrors()` chặn
   mọi lượt ghi có tham chiếu mồ côi, thay cho ràng buộc khoá ngoại mà MongoDB không có.
6. **Bộ điều phối tài nguyên GPU** — xếp hàng theo mức ưu tiên của màn hình người
   dùng đang mở, giữ yêu cầu đang chạy tới khi xong.
7. **Truy hồi có căn cứ cho trợ lý ảo** — tìm sản phẩm thật rồi mới đưa vào ngữ
   cảnh, thay vì để mô hình tự bịa.
8. **Lớp trừu tượng chung cho hai cổng thanh toán** — cùng một máy trạng thái cho
   Stripe và VNPay, kèm đối soát chủ động.
9. **Suy giảm mềm khi dịch vụ AI hỏng** — đã kiểm chứng: tắt dịch vụ vector,
   điểm cuối sản phẩm liên quan vẫn trả về 8 kết quả.
10. **Hạ tầng đo lường lặp lại được** — ba kịch bản đo (API, tải, tìm kiếm ngữ
    nghĩa) và 156 kiểm thử tự động.

---

## Năm quyết định kiến trúc và lý do

| Quyết định | Lý do ngắn gọn |
|---|---|
| Khối đơn có phân mô-đun, không tách vi dịch vụ | Ba sinh viên, một miền nghiệp vụ. Tách dịch vụ sẽ thêm chi phí vận hành mà không giải quyết vấn đề nào đang có |
| React Native | Cần cả Android và iOS trong giới hạn nhân lực; đổi lại phụ thuộc lớp cầu nối cho một số chức năng đặc thù |
| MongoDB | Dữ liệu sản phẩm có cấu trúc biến động (biến thể, thẻ, phương tiện); đổi lại phải tự thực thi toàn vẹn tham chiếu ở tầng ứng dụng |
| AI chạy cục bộ | Kiểm soát chi phí và dữ liệu; đổi lại phụ thuộc GPU của máy và không sẵn sàng liên tục |
| Cổng quản trị bằng JavaScript thuần | Không cần bước biên dịch, Express phục vụ trực tiếp; đổi lại thiếu hệ sinh thái component |

---

## Câu trả lời cho ba câu hỏi khó nhất

**"Các em có dùng transaction không?"**
> Không dùng transaction của MongoDB — em đã kiểm tra bằng cách tìm toàn bộ mã
> nguồn, không có lời gọi `startSession` hay `withTransaction` nào. Tính nguyên tử
> đến từ chỗ khác: toàn bộ state nằm trong một object trong bộ nhớ và hàm sửa đổi
> chạy đồng bộ trên một luồng, nên không yêu cầu nào chen vào giữa được. Em có
> bốn kiểm thử chứng minh: 50 lượt mua đồng thời trên tồn kho 5 cho đúng 5 lượt
> thành công. Nhưng em xin nói rõ giới hạn: tính chất này chỉ đúng trong một tiến
> trình. Nếu chạy nhiều bản sao máy chủ thì phải chuyển sang `findOneAndUpdate`
> có điều kiện hoặc transaction thật.

**"AI của các em có thật sự tốt hơn không?"**
> Với tìm kiếm ngữ nghĩa thì em đã đo và câu trả lời trung thực là **chưa**. Trên
> bộ 24 truy vấn gán nhãn, hai phương pháp hoà nhau ở HitRate@5, còn tìm kiếm từ
> khoá nhỉnh hơn ở MRR (0,846 so với 0,793). Nguyên nhân là bộ thẻ sản phẩm của
> em được biên tập rất kỹ nên baseline từ khoá vốn đã mạnh. Em giữ nguyên kết quả
> này trong báo cáo thay vì chỉnh mô-đun cho chỉ số đẹp hơn, vì bộ đánh giá chỉ có
> 24 truy vấn do chính nhóm gán nhãn — chỉnh rồi đo lại trên chính bộ đó là tối ưu
> theo bộ đánh giá, không phải cải thiện thật.

**"Hệ thống của các em có bảo mật không?"**
> Em không dám nói là bảo mật tuyệt đối. Em đã rà soát toàn bộ 115 điểm cuối và
> tìm ra 9 chỗ thiếu kiểm soát truy cập, trong đó nghiêm trọng nhất là điểm cuối
> tra cứu giao dịch: mã có dạng đếm tăng dần nên đoán được, mà nó trả về cả họ
> tên, số điện thoại và địa chỉ của khách. Em đã chứng minh lỗ hổng bằng một lời
> gọi thật, vá lại, rồi viết 10 kiểm thử tự động khoá kết quả. Nhưng em chưa kiểm
> thử xâm nhập chuyên sâu, chưa rà soát kỹ việc chèn toán tử MongoDB và chèn mã
> kịch bản ở trang quản trị — đó là giới hạn em ghi trong báo cáo.

---

## Mô hình và cổng dịch vụ

| Mô-đun | Mô hình | Cổng |
|---|---|---:|
| Trợ lý hội thoại, kiểm duyệt | Ollama (mô hình ngôn ngữ cục bộ) | 11434 |
| Vector ngữ nghĩa | `paraphrase-multilingual-MiniLM-L12-v2` | 7865 |
| Thử đồ ảo | CatVTON · FASHN | 7861 · 7862 |
| Video chuyển động | One-to-All 1.3B v1 | 7864 |

**Tất cả chạy cục bộ. Không dùng AI đám mây.**

---

## Điểm cuối cần thuộc

```
POST /api/auth/login          POST /api/orders
POST /api/auth/register       GET  /api/orders/:id
GET  /api/products            POST /api/stripe/checkout-session
POST /api/carts/sync          POST /api/vnpay/payment-url
POST /api/stylist/chat        POST /api/orders/:id/returns
POST /api/tryon               PATCH /api/admin/users/:id
```

---

## Mười giới hạn phải tự nêu trước khi hội đồng hỏi

1. Không mở rộng ngang được sang nhiều bản sao máy chủ.
2. Không dùng transaction MongoDB.
3. Stripe ở chế độ thử nghiệm, VNPay ở môi trường Sandbox — chưa phải sản xuất.
4. Chưa triển khai lên máy chủ công khai.
5. AI chạy cục bộ, phụ thuộc GPU, không sẵn sàng liên tục.
6. Bộ đánh giá tìm kiếm chỉ có 24 truy vấn, do chính nhóm gán nhãn.
7. Chưa đánh giá chất lượng ảnh thử đồ, chỉ kiểm chứng chức năng.
8. Chưa đo được tốc độ khung hình của ứng dụng.
9. Chưa kiểm thử xâm nhập chuyên sâu.
10. Chưa tích hợp đơn vị vận chuyển; trạng thái giao hàng cập nhật thủ công.
