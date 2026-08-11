# CHƯƠNG 6: KIỂM THỬ

## 6.1. Kiểm thử tự động

### 6.1.1. Công cụ và cách tổ chức

Hệ thống sử dụng **trình chạy kiểm thử tích hợp sẵn của Node.js** (`node:test`), khai báo trong `backend/package.json` bằng script `"test": "node --test"`. Đây là lựa chọn có chủ đích: dự án không cài đặt bất kỳ framework kiểm thử bên thứ ba nào (Jest, Mocha, Vitest đều không có trong danh sách phụ thuộc), giúp giảm số lượng phụ thuộc phải quản lý cho một dự án ở quy mô tốt nghiệp.

Toàn bộ tệp kiểm thử nằm trong `backend/test/`, gồm 6 tệp với tổng cộng **50 trường hợp kiểm thử**. Bảng 6.1 trình bày phân bố các trường hợp kiểm thử theo module được kiểm tra.

**Bảng 6.1: Phân bố kiểm thử tự động theo module**

| Tệp kiểm thử | Module được kiểm thử | Số trường hợp |
|---|---|---|
| `backend/test/analytics-recommend.test.js` | Phân tích dữ liệu, hệ gợi ý, kiểm duyệt nội dung, mục tiêu mua sắm, Flagcard, mô tả sản phẩm bằng AI, dữ liệu hành chính | 21 |
| `backend/test/tryon.test.js` | Các hàm thuần của luồng thử đồ AI (`stripDataUri`, `normalizeImageResult`, `clothTypeFor`, `fashnCategoryFor`, `computeSizeFit`) | 8 |
| `backend/test/orders.test.js` | Tạo đơn hàng, trừ tồn kho, chống trùng đơn, chuẩn hoá sản phẩm trong đơn | 7 |
| `backend/test/vip.test.js` | Logic khách hàng VIP: tích luỹ chi tiêu, hiệu lực 30 ngày, ưu đãi 10% | 7 |
| `backend/test/embeddings.test.js` | Toán học vector embedding (`cosineSimilarity`, `productText`) | 4 |
| `backend/test/gpu-queue.test.js` | Hàng đợi và ưu tiên tác vụ GPU, huỷ tác vụ khi đổi tính năng đang mở | 3 |
| **Tổng cộng** | | **50** |

*Nguồn: đếm trực tiếp bằng `node --test` trên từng tệp kiểm thử.*

> **Ghi chú về số liệu:** bộ bằng chứng lập trước đó (`thesis/evidence/testing-evidence.md`) ghi 46 trường hợp trên 5 tệp. Con số đúng hiện tại là **50 trường hợp trên 6 tệp** — chênh lệch do bổ sung `test/gpu-queue.test.js` (3 trường hợp) và thêm 1 trường hợp trong `analytics-recommend.test.js` sau khi bộ bằng chứng được lập. Chi tiết ở Phụ lục C mục C.1.

### 6.1.2. Kết quả chạy thực tế

Kết quả dưới đây được sao chép nguyên văn từ đầu ra thật của lệnh `npm --workspace backend test` chạy tại thư mục gốc dự án, không phải số liệu ước lượng:

```text
1..50
# tests 50
# suites 0
# pass 50
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 156.224943
```

**Toàn bộ 50/50 trường hợp kiểm thử đều đạt, không có trường hợp nào thất bại hay bị bỏ qua.** Lệnh được chạy lặp lại hai lần để xác nhận tính ổn định, cho kết quả pass/fail giống hệt nhau (thời gian thực thi 156,2 ms và 152,5 ms — dao động bình thường giữa các lần chạy).

Trong quá trình chạy có xuất hiện một cảnh báo (không phải lỗi) khi hệ thống không kết nối được dịch vụ embedding cục bộ tại cổng 7865:

```text
WARN: Không gọi được embedding service — bỏ qua semantic matching,
      các tín hiệu khác vẫn hoạt động bình thường.
```

Cảnh báo này thực chất là một bằng chứng tích cực cho thiết kế: bộ kiểm thử vẫn chạy đúng và đạt đủ 50/50 ngay cả khi dịch vụ AI ngoại vi không khả dụng, xác nhận cơ chế suy giảm mượt (graceful degradation) đã mô tả ở các chương trước hoạt động đúng như thiết kế.

### 6.1.3. Nhận xét về cách tổ chức mã nguồn phục vụ kiểm thử

Một đặc điểm thiết kế đáng chú ý: nhiều tệp route xuất khẩu (export) các hàm thuần nội bộ ra ngoài chỉ nhằm mục đích cho phép kiểm thử đơn vị mà không cần khởi động máy chủ HTTP. Ví dụ, `backend/routes/orders.js` xuất khẩu `makeCreateOrderInState`, `normalizedOrderItems`, `findVariant` ở cuối tệp; `backend/routes/tryon.js` xuất khẩu 5 hàm thuần tương tự. Nhờ đó, các trường hợp kiểm thử về tồn kho, chống trùng đơn hay phân loại loại trang phục có thể chạy trực tiếp trên logic nghiệp vụ, tốc độ cao (toàn bộ 50 trường hợp hoàn tất trong khoảng 150 ms) và không phụ thuộc trạng thái mạng.

Tuy nhiên cũng cần ghi nhận trung thực: mẫu thiết kế này được áp dụng rộng hơn phạm vi kiểm thử hiện có. Cụ thể, `backend/routes/paymentsStripe.js` và `backend/routes/paymentsVnpay.js` cũng xuất khẩu hàm theo đúng mẫu này (`makeStripeHelpers`, `makeVnpayHelpers`) nhưng **chưa có tệp kiểm thử nào sử dụng chúng** — tức hạ tầng để kiểm thử thanh toán đã sẵn sàng nhưng chưa được khai thác.

## 6.2. Kịch bản kiểm thử thủ công — Người dùng

Vì kiểm thử tự động hiện chỉ bao phủ tầng logic phía backend (không có kiểm thử giao diện tự động cho ứng dụng di động), các luồng trải nghiệm người dùng cần được kiểm thử thủ công theo bộ kịch bản ở Bảng 6.2.

**Bảng 6.2: Kịch bản kiểm thử thủ công — người dùng**

| Mã | Chức năng | Kịch bản kiểm thử | Kết quả mong đợi |
|---|---|---|---|
| TC-U01 | Đăng ký | Nhập họ tên, email, SĐT, mật khẩu mạnh hợp lệ | Tạo tài khoản thành công, tự đăng nhập vào ứng dụng |
| TC-U02 | Chặn mật khẩu yếu | Đăng ký với mật khẩu `12345678` | Bị từ chối ngay trên giao diện, thanh đo hiển thị "yếu"; nếu bỏ qua client, server cũng trả lỗi `400` |
| TC-U03 | Đăng nhập sai | Nhập đúng email, sai mật khẩu | Thông báo lỗi chung chung, không tiết lộ email có tồn tại hay không |
| TC-U04 | Quên mật khẩu | Nhập email đã đăng ký, nhận mã 6 số, đặt mật khẩu mới | Đổi mật khẩu thành công, đăng nhập được bằng mật khẩu mới; mã cũ không dùng lại được |
| TC-U05 | Xem sản phẩm không đăng nhập | Mở ứng dụng, chọn "chỉ xem sản phẩm" | Duyệt được danh mục/chi tiết sản phẩm, không bị yêu cầu đăng nhập |
| TC-U06 | Chặn hành động cần đăng nhập | Ở trạng thái khách, bấm "Thêm vào giỏ" | Điều hướng sang màn hình đăng nhập, sau khi đăng nhập quay lại đúng sản phẩm đang xem |
| TC-U07 | Tìm kiếm gần đúng | Nhập từ khoá sai chính tả nhẹ (ví dụ "kimonoo") | Vẫn trả về sản phẩm phù hợp nhờ so khớp mờ |
| TC-U08 | Đặt hàng COD | Có sản phẩm trong giỏ, chọn COD, xác nhận | Đơn được tạo với trạng thái `pending`, giỏ hàng được xoá |
| TC-U09 | Thanh toán Stripe | Chọn thẻ, nhập thẻ thử nghiệm `4242 4242 4242 4242` | Thanh toán thành công, đơn chuyển trạng thái đã thanh toán |
| TC-U10 | Thanh toán VNPay | Chọn VNPay, hoàn tất trên trang Sandbox | Ứng dụng bắt được URL trả về, xác minh chữ ký, cập nhật trạng thái đơn |
| TC-U11 | Huỷ đơn trước giao | Với đơn `pending`, bấm "Huỷ đơn", nhập lý do | Tạo yêu cầu huỷ chờ duyệt; đơn **chưa** bị huỷ ngay |
| TC-U12 | Chặn huỷ đơn đã giao | Với đơn `completed`, tìm nút huỷ đơn | Không hiển thị lựa chọn huỷ, chỉ còn lựa chọn trả hàng |
| TC-U13 | Trả hàng thiếu ảnh | Yêu cầu trả hàng nhưng không đính kèm ảnh | Bị từ chối, yêu cầu bắt buộc tối thiểu 1 ảnh |
| TC-U14 | Trả hàng hợp lệ | Trả hàng kèm ảnh, trong vòng 30 ngày | Tạo yêu cầu thành công, chờ quản trị viên duyệt |
| TC-U15 | Chat AI | Hỏi về sản phẩm/giá/phối đồ | Trả lời dựa trên dữ liệu sản phẩm thật, có thể kèm thẻ sản phẩm |
| TC-U16 | Thử đồ AI | Chọn ảnh người và một sản phẩm, tạo ảnh thử đồ | Trả về ảnh AI ghép trang phục; nếu thất bại thì báo lỗi rõ ràng, **không** trả ảnh ghép giả |
| TC-U17 | Thông báo điều hướng | Chạm vào thông báo hoàn tiền | Mở thẳng màn hình chi tiết đơn hàng tương ứng |

*Nguồn: xây dựng từ `thesis/evidence/feature-inventory.md` và `thesis/evidence/api-inventory.md`.*

**Lưu ý khi hoàn thiện báo cáo:** bảng trên hiện chỉ có cột "Kết quả mong đợi" — được suy ra từ logic thật trong mã nguồn. Cột "Kết quả thực tế" phải do nhóm tự thực hiện kiểm thử tay trên thiết bị thật và điền vào, **không được suy đoán hay điền sẵn**.

## 6.3. Kịch bản kiểm thử thủ công — Quản trị viên

Bộ kịch bản cho khối quản trị ưu tiên các trường hợp kiểm thử ranh giới phân quyền (negative test case), vì đây là phần có giá trị chứng minh cao nhất đối với thiết kế bảo mật đã trình bày ở Chương 5.

**Bảng 6.3: Kịch bản kiểm thử thủ công — quản trị viên**

| Mã | Chức năng | Kịch bản kiểm thử | Kết quả mong đợi |
|---|---|---|---|
| TC-A01 | Chặn truy cập chưa đăng nhập | Mở `/admin` khi chưa đăng nhập | Hiển thị màn hình đăng nhập, không lộ dữ liệu |
| TC-A02 | Chặn tài khoản khách | Đăng nhập tài khoản `customer`, mở `/admin` | Bị từ chối, không vào được giao diện quản trị |
| TC-A03 | Phạm vi dữ liệu của nhân viên | Đăng nhập `staff`, mở danh sách sản phẩm | Chỉ thấy sản phẩm do chính tài khoản đó tạo |
| TC-A04 | Chặn sửa sản phẩm người khác | `staff` gọi API sửa sản phẩm không thuộc sở hữu | Trả lỗi `403`, không ghi dữ liệu |
| TC-A05 | Chặn xoá sản phẩm | `staff` thử xoá sản phẩm | Trả lỗi `403` (chỉ `admin` trở lên mới được xoá) |
| TC-A06 | Yêu cầu tối thiểu 2 ảnh | Xuất bản sản phẩm chỉ có 1 ảnh | Bị từ chối kèm thông báo yêu cầu bổ sung ảnh |
| TC-A07 | Duyệt huỷ đơn COD | Duyệt yêu cầu huỷ của đơn COD chưa thanh toán | Đơn chuyển `cancelled`, **không** phát sinh giao dịch hoàn tiền |
| TC-A08 | Duyệt huỷ đơn đã thanh toán | Duyệt yêu cầu huỷ của đơn đã thanh toán Stripe | Đơn `cancelled` **và** tự động hoàn tiền qua Stripe trong cùng thao tác |
| TC-A09 | Sai trình tự hoàn tiền | Gọi hoàn tiền khi chưa xác nhận đã nhận hàng trả về | Bị từ chối kèm thông báo trạng thái hiện tại |
| TC-A10 | Chặn phân quyền sai cấp | Tài khoản `admin` (không phải `super_admin`) thử đổi vai trò người khác | Trả lỗi `403` |
| TC-A11 | Chặn tự hạ quyền | `super_admin` thử hạ vai trò của chính mình | Trả lỗi `400`, không thay đổi vai trò |
| TC-A12 | Cấp voucher đền bù | Cấp voucher giảm giá riêng cho một khách hàng kèm lý do | Voucher được tạo, chỉ khách đó dùng được, khách nhận thông báo |

*Nguồn: `thesis/evidence/security-analysis.md` mục 1–2; `thesis/evidence/feature-inventory.md` mục 6.*

## 6.4. Đánh giá độ bao phủ kiểm thử và hạn chế

Mục này trình bày trung thực phạm vi đã và chưa được kiểm thử tự động, thay vì khẳng định hệ thống "đã kiểm thử đầy đủ".

**Bảng 6.4: Phạm vi kiểm thử tự động**

| Đã có kiểm thử tự động | Chưa có kiểm thử tự động |
|---|---|
| Logic VIP (tích luỹ chi tiêu, hiệu lực, ưu đãi) | Xác thực và phân quyền (`backend/lib/auth.js`) |
| Tạo đơn hàng, trừ tồn kho, chống trùng đơn | Luồng huỷ đơn/trả hàng (`backend/routes/returns.js`) |
| Toán học embedding cho gợi ý sản phẩm | Hai cổng thanh toán Stripe/VNPay (dù đã có sẵn hàm export phục vụ kiểm thử) |
| Hàm thuần của luồng thử đồ AI | Toàn bộ giao diện ứng dụng di động |
| Hệ gợi ý, phân tích dữ liệu, kiểm duyệt nội dung, Flagcard | Toàn bộ giao diện trang quản trị |

*Nguồn: `thesis/evidence/testing-evidence.md` (mục 1, 5, 6 và phần tổng kết).*

Ngoài ra, hai hạn chế về hạ tầng kiểm thử cần được ghi nhận:

1. **Chưa có quy trình tích hợp liên tục (CI/CD).** Repository không chứa `.github/workflows/` hay bất kỳ tệp cấu hình CI nào; bộ kiểm thử phải được chạy thủ công bằng lệnh. Điều này có nghĩa không có cơ chế tự động ngăn một thay đổi làm hỏng kiểm thử được đưa vào mã nguồn.
2. **Chưa có framework kiểm thử giao diện tự động (E2E)** cho ứng dụng di động — không có Detox, Maestro hay Playwright trong danh sách phụ thuộc. Kiểm tra tự động duy nhất áp dụng cho phía mobile là kiểm tra kiểu dữ liệu TypeScript (`tsc --noEmit`), được gộp chung vào lệnh `npm run check` cùng với bộ kiểm thử backend.

Hai hạn chế này, cùng với các khoảng trống ở Bảng 6.4, được đưa vào phần hướng phát triển ở Chương 8 như các hạng mục ưu tiên cải thiện.
