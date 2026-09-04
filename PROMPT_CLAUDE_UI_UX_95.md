# Prompt cho Claude Code — đánh giá và nâng cấp UI/UX JAPANO lên 9,5

Sao chép toàn bộ phần trong khung dưới đây vào Claude Code khi đang mở thư mục
`/home/nhat/Downloads/japano`.

```text
Hãy dùng skill `japano-ui-ux-95` và toàn bộ skill mà nó yêu cầu. Làm việc trực
tiếp trong repo `/home/nhat/Downloads/japano`.

MỤC TIÊU
Đánh giá nghiêm túc, có bằng chứng rồi nâng cấp UI/UX cho cả ba bề mặt:
1. App Expo/React Native trong `mobile/`.
2. Web Storefront Next.js trong `web/`.
3. Web Admin trong `admin/`.

Đây không phải nhiệm vụ chỉ viết báo cáo. Trước tiên hãy audit và chấm điểm từng
bề mặt theo đúng rubric 10 điểm trong skill. Nếu App, Storefront hoặc Admin dưới
9,5/10, hãy tự tiếp tục sửa các điểm yếu có tác động cao nhất, chạy lại giao diện,
kiểm thử lại và chấm lại. Không dừng ở danh sách đề xuất khi vẫn còn sửa được
trong repo. Chỉ được công bố đạt 9,5 khi vượt đủ evidence gate của skill.

QUY TẮC BẮT BUỘC
- Đọc `AGENTS.md`, `docs/CODEX_PROJECT_MEMORY.md`, kiểm tra branch và dirty diff
  trước khi làm. Giữ nguyên mọi thay đổi không thuộc nhiệm vụ; không reset,
  clean, stash, đổi branch, commit hay push nếu tôi chưa yêu cầu.
- Dùng GitNexus để tìm luồng và chạy impact analysis trước khi sửa symbol. Nếu
  HIGH/CRITICAL phải nói rõ blast radius rồi mới sửa có kiểm soát. Chạy
  detect-changes sau cùng.
- Phải nhìn giao diện đang chạy và chụp ảnh trước/sau. Không chấm điểm chỉ bằng
  cách đọc code, build thành công hay HTTP 200.
- Web Storefront và Admin phải kiểm tra ít nhất desktop 1440x900 và mobile
  390x844 hoặc 412x915; kiểm tra bàn phím, focus, zoom 200%, Reduce Motion,
  loading/empty/error/success, chữ tiếng Việt dài và overflow.
- App ưu tiên kiểm tra thật trên OPPO A78 đang kết nối. Phải thử safe area,
  cuộn, nút Back, touch target, màn chat/form khi bàn phím mở, trạng thái tải và
  lỗi. Nếu không điều khiển được OPPO thì dùng emulator nếu có và ghi rõ CHƯA
  XÁC MINH TRÊN OPPO; bề mặt đó không được tự chấm quá 8,9.
- Admin phải đánh giá cả đăng nhập và các màn đã xác thực bằng quyền test hợp lệ.
  Không được bỏ qua auth hoặc làm yếu RBAC để chụp ảnh. Nếu thiếu credential,
  ghi blocker và dùng fixture/mock QA cục bộ tách biệt nếu repo đã có cơ chế đó;
  không gọi mock là xác minh auth thật.
- Không thay đổi nghiệp vụ, API contract, giá, kho, thanh toán, RBAC, AI safety
  hoặc dữ liệu người dùng chỉ để UI đẹp hơn. Không xoá tính năng để tăng điểm.
- Không biến cả ba giao diện thành một template giống nhau: App tối ưu dùng một
  tay; Storefront tối ưu khám phá/chuyển đổi; Admin tối ưu quyết định và thao tác
  dữ liệu. Tất cả vẫn phải cùng nhận diện JAPANO.
- Không thêm animation, gradient, glassmorphism, card bo tròn hoặc dependency
  một cách máy móc. Mỗi thay đổi phải giải quyết một lỗi UX hoặc củng cố ngôn
  ngữ thương hiệu. Tôn trọng `prefers-reduced-motion`.
- Dùng tiếng Việt tự nhiên cho người dùng; không lộ tên model/engine kỹ thuật ở
  UI khách hàng. Loading phải thật, không phần trăm giả.

LUỒNG PHẢI KIỂM TRA
- App: khởi động/home, catalog và filter, chi tiết sản phẩm, thử đồ, Khám phá
  Nhật Bản, giỏ/checkout, Ori chat khi mở bàn phím, tài khoản/cài đặt.
- Storefront: home, catalog/search/filter, chi tiết, thử đồ, ghép cảnh Nhật Bản,
  giỏ/checkout và account states.
- Admin: login/quên mật khẩu, dashboard, sản phẩm/tồn kho, đơn/hoàn trả, khách
  hàng, đánh giá/kiểm duyệt, analytics/AI và bảng dữ liệu responsive.

ĐẦU RA BẮT BUỘC
1. Trước khi sửa: bảng điểm baseline App/Storefront/Admin theo từng tiêu chí,
   bằng chứng ảnh và danh sách lỗi P0/P1/P2 có file hoặc màn hình liên quan.
2. Kế hoạch sửa theo tác động, nêu rõ những gì không thay đổi.
3. Triển khai trực tiếp tất cả sửa chữa hợp lý cần để tiến tới 9,5.
4. Sau khi sửa: chạy lại cùng flow/viewports, accessibility, typecheck/build/test
   phù hợp; sửa tiếp nếu còn lỗi.
5. Lưu báo cáo tại
   `docs/project_evidence/ui_ux/UI_UX_AUDIT_<YYYY-MM-DD>.md` và ảnh tại
   `test-results/ui-ux/<YYYY-MM-DD>/`, không lưu bí mật hay ảnh cá nhân.
6. Kết thúc bằng bảng baseline → final cho từng bề mặt, các file đã sửa, lệnh
   kiểm thử và kết quả, đường dẫn screenshot, phần chưa xác minh và lý do.

Không tự khen, không làm tròn điểm lên, không tuyên bố “chuẩn 9,5” nếu thiếu
ảnh chạy thật hoặc còn lỗi nghiêm trọng. Bắt đầu audit ngay, không hỏi lại những
điều có thể tìm trong repo.
```
