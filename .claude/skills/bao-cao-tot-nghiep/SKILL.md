---
name: bao-cao-tot-nghiep
description: Quy trình chỉnh sửa và hoàn thiện báo cáo tốt nghiệp ngành CNTT (DOCX) theo chuẩn trình bày Việt Nam — đối chiếu nội dung với mã nguồn thật, sinh sơ đồ (ERD/Use Case/Activity/Sitemap), chụp ảnh giao diện thật, chèn hình kèm caption vào Word, render PDF và kiểm tra bố cục từng trang. Dùng khi được yêu cầu sửa/hoàn thiện/kiểm tra một file báo cáo tốt nghiệp .docx.
---

# Hoàn thiện báo cáo tốt nghiệp (DOCX)

Quy trình bắt buộc, thực hiện tuần tự. Không được bỏ bước, không được bàn giao
khi chưa render và xem từng trang.

## Nguyên tắc bất di bất dịch

1. **Không ghi đè bản gốc.** Luôn sao lưu `<tên>.docx` sang thư mục làm việc
   trước khi đụng vào bất cứ thứ gì. Sản phẩm xuất ra tên khác.
2. **Không bịa.** Mọi API, collection, route, tính năng nêu trong báo cáo phải
   `grep` được trong mã nguồn. Chức năng chưa có → ghi rõ “định hướng phát triển”.
3. **Không placeholder.** Không `[Chèn hình tại đây]`, không caption mồ côi
   (caption không có hình), không khung rỗng.
4. **Không lộ bí mật.** Không đưa mật khẩu, token, khóa API, nội dung `.env`,
   email cá nhân thật vào báo cáo. Che bằng `••••••` hoặc mô tả cơ chế.
5. **Tiếng Việt chuẩn.** Ngôn ngữ tài liệu `vi-VN`. Thuật ngữ Anh lần đầu viết
   “Quản trị viên (Administrator)”, sau đó chỉ dùng tiếng Việt. Ngày `dd/MM/yyyy`,
   tiền tệ VNĐ.

## Bước 1 — Sao lưu và bóc tách

```bash
cp bao-cao.docx <work>/bao-cao.goc.docx
mkdir -p <work>/docx && cd <work>/docx && unzip -q ../../bao-cao.docx
```

Đọc `word/document.xml`, `word/styles.xml`, `word/media/`. Ghi lại: số section,
khổ giấy, lề, số ảnh, số bảng.

## Bước 2 — Lập bản đồ tài liệu

Duyệt tuần tự `body` (dùng `python-docx`, đi qua cả `w:p` lẫn `w:tbl` theo đúng
thứ tự) và xuất một `outline.txt` gồm: chỉ số đoạn, style, có ảnh hay không,
120 ký tự đầu. Từ đó lập danh sách:

- Chương / mục / tiểu mục (kèm style thật, phát hiện tiêu đề giả in đậm).
- Bảng + caption bảng; hình + caption hình.
- Lỗi đánh số (trùng số mục, số nhảy cóc, mục con nằm sai chương).
- Caption không có hình, hình không có caption, bảng 1×1 dùng làm “khung ảnh rỗng”.
- Đoạn trùng lặp (so khớp chuỗi con lặp trong cùng một đoạn).

## Bước 3 — Đối chiếu mã nguồn (vòng kiểm tra 1)

Trích **bằng chứng thật** từ workspace, không từ trí nhớ:

```bash
# endpoint thật
grep -rhoE "\b(api|router|app)\.(get|post|put|patch|delete)\(\s*'[^']+'" <backend>/
# route/màn hình frontend
find <app> -name "*.tsx" -o -name "*.vue" -o -name "*.jsx"
# collection / model
grep -n "COLLECTIONS\|mongoose.model\|createCollection" -r <backend>/lib
```

Lập bảng đối chiếu “điều báo cáo nói ⟷ bằng chứng trong mã nguồn ⟷ kết luận
(đúng / sai / chưa triển khai)”. Mọi phát biểu sai phải sửa hoặc gỡ.

## Bước 4 — Sinh sơ đồ

- **ERD**: ưu tiên file `.drawio` sẵn có trong workspace. Kiểm tra số bảng, số
  quan hệ, FK nối đúng hàng PK, không chồng bảng. Xuất PNG nền trắng:
  ```bash
  drawio -x -f png --scale 2 --border 20 -o out.png erd.drawio
  ```
  Nếu `drawio` headless lỗi, thêm `--no-sandbox` và `xvfb-run`; nếu vẫn lỗi thì
  tự render SVG→PNG từ XML và **ghi lại cách đã dùng trong BAO_CAO_QA.md**.
  ERD tổng thể đặt trên **section A4 ngang**; kèm các hình phóng to theo nhóm bảng.
- **Use Case / Activity / Sitemap**: sinh bằng SVG có kiểm soát tọa độ (không để
  đường nối cắt qua hộp), chữ tiếng Việt, nền trắng, rồi rasterize sang PNG ở
  ~2× kích thước in.

Mọi sơ đồ phải đọc được ở 100% khi đã chèn vào Word.

## Bước 5 — Chụp giao diện thật

Chỉ chụp những màn hình **thực sự tồn tại** trong mã nguồn.

1. Khởi động backend/web ở cổng riêng, không đụng cổng người dùng đang dùng.
2. Nếu cần đăng nhập: tạo tài khoản **tạm thời** bằng script, dùng xong **xoá**.
3. Dùng Playwright/Chrome headless, `deviceScaleFactor: 2`, chờ mạng rảnh.
4. Cắt khoảng trắng thừa, kiểm tra ảnh không lộ token/mật khẩu/email thật.
5. Màn hình chưa triển khai: **không dựng ảnh giả**. Ghi “Giao diện đề xuất”
   hoặc chuyển sang phần hướng phát triển.

⚠️ Không khởi động máy ảo Android có tăng tốc GPU song song với việc nạp mô hình
AI nặng — sẽ làm sập phiên làm việc từ xa.

## Bước 6 — Dựng lại DOCX

Thao tác trực tiếp trên OOXML (`python-docx` + `lxml`) chứ không xuất lại từ
Markdown (sẽ mất hết ảnh và style sẵn có).

- Chuẩn hoá section: A4 (11906×16838 twip), lề trái 3 cm, phải 2 cm, trên/dưới 2,5 cm.
- Chuẩn hoá body text: Times New Roman 13 pt, giãn dòng 1,5, canh đều.
- Tiêu đề dùng **Style thật** (`Heading 1/2/3`), không in đậm thủ công.
- Chèn ảnh: căn giữa, giữ đúng tỷ lệ, không vượt vùng nội dung, kèm alt text.
- Caption hình đặt **ngay dưới** ảnh, dùng style `Caption`, đánh số bằng
  trường `SEQ` để Word tự cập nhật; caption và ảnh phải `keepNext` để không tách trang.
- Mục lục / danh mục hình / danh mục bảng dựng bằng field `TOC`, đặt
  `w:updateFields` để Word cập nhật khi mở.

## Bước 7 — Render và kiểm tra bố cục (vòng 5)

```bash
soffice --headless --convert-to pdf --outdir <work> ket-qua.docx
pdftoppm -r 100 -png <work>/ket-qua.pdf <work>/page
```

Xem **từng trang**. Bắt lỗi: chữ bị cắt, ảnh méo/quá nhỏ, bảng vượt lề, trang
trắng, heading nằm cuối trang, caption tách khỏi hình, font không đồng nhất.
Có lỗi → sửa DOCX → **render lại từ đầu**.

Kiểm tra tự động tối thiểu:

```bash
pdftotext ket-qua.pdf - | grep -n "Error! Reference source not found"
pdfinfo ket-qua.pdf | grep -E "Pages|Page size"   # phải là A4 595×842 pt
```

## Bước 8 — Sáu vòng kiểm tra bắt buộc

| Vòng | Nội dung | Đạt khi |
|---|---|---|
| 1 | Đúng theo mã nguồn | Mọi API/collection/route nêu trong báo cáo đều grep được |
| 2 | Nội dung học thuật | Không lặp ý; phân tích – thiết kế – thực hiện tách bạch |
| 3 | Tiếng Việt | Không lỗi chính tả/thuật ngữ; không văn phong máy dịch |
| 4 | Đánh số & tham chiếu | Heading, hình, bảng, mục lục liên tục và khớp nhau |
| 5 | Bố cục trực quan | Duyệt hết trang PDF, không còn lỗi trình bày |
| 6 | Sản phẩm cuối | DOCX mở được, đủ ảnh, PDF khớp DOCX, không còn bí mật |

Chỉ báo hoàn thành khi cả 6 vòng đều đạt.

## Bước 9 — Bàn giao

Xuất đủ: `<tên>_hoan_thien.docx`, `<tên>_hoan_thien.pdf`, `BAO_CAO_QA.md`
(ghi rõ đã sửa gì, kiểm tra gì, kết quả từng vòng, sự cố kỹ thuật và cách xử lý).
Dọn sạch tài khoản/tệp tạm đã tạo trong lúc làm.
