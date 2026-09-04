# Prompt cho Claude Code — thử nguyên bộ đồ + ghép cảnh Nhật chân thật

Sao chép **toàn bộ phần trong khung dưới đây** vào Claude Code khi đang mở thư
mục `/home/nhat/Downloads/japano`.

Skill đi kèm: `japano-full-outfit-tryon` (đã cài sẵn tại
`.claude/skills/japano-full-outfit-tryon/`).

```text
Hãy dùng skill `japano-full-outfit-tryon` và mọi skill mà nó yêu cầu
(`japano-project-memory`, `japano-travel-tryon`, `japano-gpu-performance`, và
`japano-fit-trainer` nếu thật sự cần huấn luyện). Làm việc trực tiếp trong repo
`/home/nhat/Downloads/japano`.

MỤC TIÊU
Nâng thử đồ ảo JAPANO từ "mặc thử một món" lên "mặc thử NGUYÊN BỘ trông như
thật", trên cả app Expo (`mobile/`) lẫn web storefront (`web/`):

1. Thử được nhiều loại món cùng lúc — áo, quần, váy, GIÀY DÉP và PHỤ KIỆN — ra
   MỘT tấm ảnh có đủ mọi món đã chọn.
2. Sửa lỗi mất món: hiện tại thử áo xong thì cái quần đang mặc biến mất.
3. Khi bộ đồ còn thiếu chỗ nào, AI phải tự nhận ra và gợi ý món ghép vào đúng
   chỗ đó (thiếu quần thì gợi ý quần, chưa có giày thì gợi ý giày).
4. Ảnh thử đồ ghép vào phong cảnh Nhật phải chân thật như ảnh du lịch chụp thật.
5. Bổ sung thêm địa điểm Nhật Bản mới.

ĐỌC TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ
- `AGENTS.md` và `docs/CODEX_PROJECT_MEMORY.md`.
- Kiểm tra branch và diff đang dirty. Repo này thường có phiên khác sửa song
  song: GIỮ NGUYÊN mọi thay đổi không thuộc nhiệm vụ. Không reset, clean, stash,
  đổi branch, commit hay push nếu tôi chưa yêu cầu.
- Skill có bảng "đọc ground truth" chỉ đúng tệp cần mở. Phần lớn hạ tầng ĐÃ CÓ
  (mảng `productIds` tối đa 3 món, `resolveOutfitGarments()`, `GARMENT_PROFILES`,
  `composeOutfit()`, pipeline phụ kiện riêng, metadata cảnh theo từng ảnh).
  Đừng viết lại thứ đã có — hãy mở rộng nó.

RÀNG BUỘC KỸ THUẬT PHẢI TÔN TRỌNG
- FASHN chỉ nhận MỘT vùng trang phục mỗi lượt. Mỗi món thêm vào là thêm một lượt
  sinh ảnh trên GPU. Mọi thiết kế kiểu "gửi hết một lần" đều sai.
- Hiện KHÔNG có slot cho giày (chỉ có upper-base / upper-outer / lower /
  overall), và phụ kiện `phu-kien` bị chặn thẳng ở đường thử đồ. Đây chính là
  phần việc phải làm.
- `garmentCoverage.js` biết slot theo từng loại đồ, còn `outfit.js` chỉ suy ra
  vai trò thô theo DANH MỤC và không hề có vai trò "quần" hay "giày". Muốn gợi ý
  theo chỗ còn thiếu thì phải nối hai hệ phân loại này lại.
- Ghép cảnh dùng U2Net, không GPU, không mô hình sinh ảnh — mặt và người giữ
  nguyên từng pixel. Ảnh trông giả gần như luôn do HÌNH HỌC và ÁNH SÁNG sai, chứ
  không phải do model kém.

TUYỆT ĐỐI KHÔNG
- Không hạ bất kỳ cổng an toàn nào để ghép cho đủ bộ: `ALWAYS_COVERED_ZONES`,
  cổng 18+, kiểm SHA-256 ảnh preset, các cổng che phủ — giữ nguyên độ chặt.
  Bộ đồ nào không ghép an toàn được thì TỪ CHỐI, không hạ chuẩn.
- Không bịa món đồ. Thiếu ảnh thử đồ dùng được thì nói thẳng. Không dán ảnh
  catalog đè lên người — dự án đã bác cách này một lần rồi.
- Không ghép cảnh trước rồi mới mặc đồ. Luôn: mặc đồ → cổng chất lượng → ghép.
- KHÔNG gọi bất kỳ thay đổi prompt/tham số/mask/scheduler nào là "fine-tune".
  AGENTS.md quy tắc 4: muốn nói fine-tune thì phải có dataset có giấy phép, có
  cập nhật optimizer, có checkpoint/adapter tải lại được kèm hash, có test tải
  lại và có đánh giá trên tập held-out. Không đủ thì gọi đúng tên: "chỉnh suy
  luận" hoặc "đổi pipeline". Nếu thấy thật sự cần LoRA thì chuyển sang skill
  `japano-fit-trainer` và làm cho đủ bộ.
- Không để app và web lệch nhau. Tính năng chỉ có ở một bên là CHƯA XONG.

QUY TRÌNH BẮT BUỘC
- Chạy GitNexus impact analysis trước khi sửa symbol; HIGH/CRITICAL thì nói rõ
  blast radius rồi mới sửa có kiểm soát. `risk: UNKNOWN` KHÔNG phải là an toàn —
  phải xác minh lại bằng tìm kiếm văn bản. Chạy `detect_changes` ở cuối.
- Trước khi sửa: chẩn đoán bằng lượt chạy THẬT, không đoán từ mã nguồn. Riêng
  lỗi "mất quần", phải xác định rõ nó thuộc trường hợp nào:
  (a) model sinh ra người không còn quần, hay
  (b) pipeline chưa bao giờ gửi quần và lượt `tops` đã thay quần trong ảnh gốc
  thành chân trần.
  Nói rõ bằng chứng dẫn tới kết luận trước khi vá.
- Mỗi khi đổi cách sinh ảnh, TĂNG `PIPELINE_VERSION` trong
  `backend/lib/tryonCache.js`, nếu không ảnh preset cache cũ sẽ che mất thay đổi.

CÁCH TEST
- Dùng web storefront để lặp nhanh (`web/`, dev server cổng 4200) — nhưng phải
  hiểu rằng hiện storefront ĐANG ĐI SAU app: `mobile/app/tryon.tsx` đã gửi
  `productIds`, còn `web/components/tryon-studio.tsx` mới gửi một `productId`.
  Kéo storefront lên ngang app rồi mới nói tới parity.
- Sau khi xong trên web, phải kiểm lại trên app Expo. Nếu không cắm được OPPO
  A78 thì ghi rõ "CHƯA XÁC MINH TRÊN THIẾT BỊ" và nói phần nào chưa được chứng
  minh. TUYỆT ĐỐI không bật emulator Android có tăng tốc GPU trên máy này — nó
  đã từng làm sập phiên remote desktop.
- Địa điểm mới: tải ảnh về repo, đo `footAnchor`, `groundPolygon`,
  `personHeightRatio`, `safeZone`, `landmarkAvoidRects` TRÊN ẢNH GỐC, thêm vào
  CẢ `backend/lib/japanScenes.js` LẪN `mobile/lib/japanSpots.ts`, rồi chạy
  `node scripts/validate_japan_scenes.js`. Giấy phép và độ phân giải KHÔNG đủ để
  một ảnh dùng được — bố cục mới quyết định; ảnh nào không đứng chân được thì
  loại. `backend/test/japan-scene.test.js` so trực tiếp hai bảng, lệch là fail.

ĐẦU RA BẮT BUỘC
1. Chẩn đoán ban đầu có bằng chứng: lỗi mất món thuộc trường hợp nào, những slot
   nào hiện không thử được, và storefront đang thiếu gì so với app.
2. Kế hoạch theo tác động, nêu rõ phần nào KHÔNG đổi (nghiệp vụ, API contract,
   giá, kho, thanh toán, RBAC, cổng an toàn AI, dữ liệu người dùng).
3. Triển khai thật, không dừng ở đề xuất.
4. Bằng chứng chạy thật cho từng năng lực, theo đúng bảng "Evidence gate" trong
   skill: ảnh full-size, số đo hình học đã dùng, độ trễ đo được từng lượt và cả
   bộ, so với baseline trước đó.
5. Chạy lại: `npm --workspace backend test`, `npm run test:python`, mobile
   typecheck, storefront typecheck/lint/build; thêm test hồi quy cho đúng lỗi
   mất món (mặc áo lên người đang mặc quần, khẳng định vùng thân dưới vẫn kín).
6. Lưu báo cáo tại
   `docs/project_evidence/tryon/FULL_OUTFIT_<YYYY-MM-DD>.md` và ảnh tại
   `test-results/tryon/<YYYY-MM-DD>/`. Không lưu ảnh cá nhân thật, không lưu bí
   mật.
7. Cập nhật `docs/CODEX_PROJECT_MEMORY.md`, và cập nhật `README.md` nếu hành vi
   người dùng thấy được, lệnh chạy, giới hạn hay benchmark đã thay đổi.
8. Kết thúc bằng: năng lực nào chạy được kèm bằng chứng, cái gì bị TỪ CHỐI theo
   thiết kế, cái gì còn hỏng, độ trễ đo được, và phần nào CHƯA xác minh cùng lý
   do.

Không tự khen, không trình bày ý định như đã làm xong, không gọi chỉnh tham số
là huấn luyện. Bắt đầu bằng bước chẩn đoán ngay, đừng hỏi lại những gì tìm được
trong repo.
```

## Ghi chú khi dùng

- Prompt này **không** yêu cầu fine-tune. Nó yêu cầu sửa đúng nguyên nhân, và
  chỉ mở đường sang `japano-fit-trainer` nếu hoá ra thật sự cần huấn luyện. Đây
  là chủ ý: phần lớn lỗi "trông giả" trong pipeline này đến từ hình học và ánh
  sáng, không phải từ chất lượng mô hình, nên huấn luyện lại thường là cách đắt
  nhất và chậm nhất để sửa sai thứ.
- Muốn ép làm LoRA thật thì thêm một dòng vào cuối prompt, nhưng phải chấp nhận
  đủ bộ bằng chứng: dataset có giấy phép, log huấn luyện, checkpoint kèm hash,
  test tải lại, đánh giá trên tập tách riêng.
- Nếu muốn chạy từng phần cho nhẹ, cắt mục tiêu trong khung xuống còn 1–2 gạch
  đầu dòng; skill và phần evidence gate vẫn áp dụng nguyên vẹn.
