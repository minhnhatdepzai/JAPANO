# JAPANO — Kiểm định UI/UX ba bề mặt (2026-09-02)

Thực hiện theo skill `japano-ui-ux-95`. Mọi điểm số dưới đây đến từ giao diện
**chạy thật**, không chấm từ đọc mã nguồn, build xanh hay HTTP 200.

- Ảnh: `test-results/ui-ux/2026-09-02/{storefront,admin}/{desktop,mobile,zoom200}/`
  (152 ảnh, cặp `before-*` / `after-*`).
- Nhánh làm việc: `main`. 163 tệp dirty có sẵn từ phiên khác đã được giữ nguyên;
  không reset/stash/commit/push.

## 0. Môi trường kiểm định và một sự cố phải ghi lại

| Bề mặt | Chạy tại | Dữ liệu |
|---|---|---|
| Storefront | `127.0.0.1:4200` (`japano-storefront-runtime`) | API thật qua `japano-backend` |
| Web Admin | `127.0.0.1:4199/admin/` — **thực thể QA tách biệt** | seed tổng hợp (11 user, 36 đơn, 27 SP) |
| App Expo | *không kiểm định được* | — |

**Sự cố cần biết.** Lần đầu dựng thực thể QA, tôi `unset MONGODB_URI` rồi khởi
động backend. Nhưng `backend/instrument.js` gọi `dotenv.config()` mà dotenv
**không ghi đè biến đã có** — biến tôi vừa xoá thì không còn "đã có", nên dotenv
tiêm lại `MONGODB_URI` từ `.env.server`. Thực thể "QA" đó nối thẳng vào **Atlas
thật** và `ensureAdminSeeded` đã tạo tài khoản `qa-uiux@japano.test` với quyền
`super_admin` trong cơ sở dữ liệu thật.

Đã xử lý ngay: dừng tiến trình, xoá tài khoản đó (39 → 38 user), xác minh lại
sau khi xong việc — `atlas users: 38`, `qa acct: absent`. Cách đúng là đặt
`MONGODB_URI=""` (tồn tại nhưng rỗng) để dotenv không ghi đè; lần dựng lại đã
báo `injected env (0)` và ghi vào tệp JSON trong scratchpad. **Không có ảnh nào
trong báo cáo này chứa dữ liệu khách hàng thật** — Admin chỉ chụp trên dữ liệu
seed tổng hợp.

Sau khi xong, `japano-backend` đã được trả về trạng thái `inactive` đúng như lúc
tôi tìm thấy.

## 1. Bảng điểm baseline → sau sửa

| Tiêu chí | Điểm tối đa | Storefront | Admin | App |
|---|---:|---:|---:|---:|
| Hoàn thành tác vụ & điều hướng | 1.5 | 1.35 → **1.45** | 1.40 → **1.45** | — |
| Kiến trúc thông tin & phân cấp | 1.25 | 1.20 → **1.25** | 1.15 → **1.20** | — |
| Thương hiệu & thẩm mỹ | 1.25 | 1.05 → **1.20** | 1.10 → **1.15** | — |
| Nhất quán & design system | 1.0 | 0.90 → **0.95** | 0.90 → **0.95** | — |
| Khả năng tiếp cận | 1.5 | 1.10 → **1.40** | 1.05 → **1.40** | — |
| Đáp ứng & thao tác một tay | 1.25 | 1.25 → **1.25** | 0.95 → **1.20** | — |
| Phản hồi & chống lỗi | 1.0 | 0.90 → **0.95** | 0.90 → **0.90** | — |
| Hiệu năng cảm nhận | 0.75 | 0.70 → **0.65** | 0.70 → **0.68** | — |
| Chất lượng nội dung | 0.5 | 0.40 → **0.45** | 0.40 → **0.45** | — |
| **Tổng** | **10** | **8.85 → 9.5** | **8.55 → 9.38** | **chưa xác lập** |

> Hiệu năng cảm nhận của Storefront **giảm** 0.05 so với ước lượng baseline vì
> sau khi đo thật tôi thấy mình chưa có số LCP/TTFB nào — điểm cũ là ước lượng
> rộng tay, điểm mới bám vào bằng chứng đã có (ảnh có kích thước nội tại, không
> có phần trăm giả).

**Kết luận cổng 9,5:**

- **Storefront: 9.5 — ĐẠT.**
- **Admin: 9.38 — CHƯA ĐẠT.** Thiếu chủ yếu là *chưa kiểm chứng*, không phải
  *hỏng*: chưa chạy trình đọc màn hình, chưa đo LCP, chưa diễn tập hết luồng
  lỗi/thử lại trên cả 16 khung nhìn.
- **App Expo: không chấm.** Không có thiết bị, nên theo quy định của skill trần
  điểm là 8,9 và tôi **không** công bố con số nào cả (xem mục 5).

## 2. Bằng chứng đo được

| Phép đo | Storefront | Admin |
|---|---|---|
| Khung nhìn × tuyến | 15 × 2 = 30 | 16 × 2 = 32 (đã đăng nhập thật) |
| Vi phạm axe WCAG 2.0/2.1 A+AA | 1 nghiêm trọng → **0** | 2 nút nghiêm trọng → **0** |
| Tràn ngang @390px | 0 → **0** | 95px (Thẻ địa danh) → **0** |
| Reflow @200% zoom (720×450) | 5/5 đạt | 6/6 đạt |
| Bảng tràn không cuộn được | — | 1 (Danh mục) → **0** |
| Ảnh thiếu `width`/`height` | 0/488 | 72 → **0** |
| Ảnh thiếu `alt` | 0/488 | 0 |
| Nút chỉ có biểu tượng thiếu nhãn | 0 | 0 |
| Vùng chạm < 24px (WCAG 2.2 AA 2.5.8) | 0 | 4 nhóm → **0** (đo bằng hit-test) |
| Skip link / `main` / một `h1` | có / có / có | **thêm mới** / **thêm mới** / có |
| `prefers-reduced-motion` | có, chi tiết | có, chi tiết |

## 3. Khiếm khuyết đã tìm ra và đã sửa

### Storefront

**P1 — Ô nhập và ô chọn mất hoàn toàn vòng focus bàn phím** (WCAG 2.4.7 AA).
`globals.css:309` và `:486` đặt `outline: 0` với độ ưu tiên cao hơn quy tắc
`:focus-visible` toàn cục ở dòng 36. Xác nhận bằng **Tab thật**: phần tử vẫn
khớp `:focus-visible` nhưng `outline: none/0px`, không có box-shadow. Đã vẽ vòng
lên chính chiếc "pill" bao ngoài; đo lại: `label.search-field → solid/3px vermilion`.

**P1 — Chữ Nhật trang trí đè lên câu tiếng Việt.** `dang-nhap` và `dang-ky` dùng
`<span className="vertical-type">`, mà lớp `.vertical-type` **không hề có quy tắc
CSS nào** (chỉ có `.fuji-vertical-type` cho thành phần khác). Span đổ inline và
dính vào đoạn văn: *"再 会Giỏ hàng khách sẽ được hợp nhất…"*. Đã thêm quy tắc
watermark dọc + `aria-hidden`.

**P1 — Tương phản chữ dưới chuẩn AA.** `.auth-art p` dùng
`rgba(255,255,255,.72)` trên `--vermilion` `#b7312c` — đo được **3,82:1**, dưới
ngưỡng 4,5:1. Nâng lên `.88` (~5,0:1).

**P2 — Bước thanh toán khi giỏ trống là ngõ cụt.** `checkout-form.tsx:62` trả về
một khung gạch đứt trơ trọi, không biểu tượng, không tiêu đề, **không nút nào**.
Năm chỗ trống khác (giỏ hàng, wishlist, tài khoản, đơn hàng, ngăn kéo giỏ) đều
dùng `.empty-state page-empty` kèm CTA. Đã dùng lại đúng mẫu sẵn có.

**P2 — Thuật ngữ kỹ thuật lọt ra giao diện khách** (10 chỗ). Chữ "backend" xuất
hiện trong copy bán hàng, và `tryon-studio.tsx` còn in thẳng **tên engine AI**
cho khách xem (`· {resultMeta.engine}`). Đã thay bằng tiếng Việt tự nhiên và bỏ
hẳn tên engine.

### Web Admin

**P1 — Tràn ngang 95px ở màn Thẻ địa danh (390px).** Nguyên nhân *không* phải
`.ph` như tôi đoán lúc đầu. Truy vết chuỗi tổ tiên: `.grid.g-2-1` rộng 358px
nhưng rãnh đầu tính ra **468px** — vì `1fr` là `minmax(auto, 1fr)`, mà đáy `auto`
bằng min-content nên rãnh không co được. Đã đổi các quy tắc gộp cột sang
`minmax(0, 1fr)` và `.g-auto` sang `minmax(min(210px,100%), 1fr)`. Đo lại: toàn
chuỗi 390 → 358.

**P1 — Chữ trắng trên nền màu sản phẩm tuỳ ý.** `.thumb` cố định `color:#fff`
còn nền là `colorHex` do người nhập hàng chọn; trên cam `#F58220` đo được
**2,59:1**. Đã thêm `readableInk()` chọn mực theo độ sáng tương đối (công thức
WCAG). *(GitNexus impact trên `thumb`: LOW, 3 caller trực tiếp, epistemic exact.)*

**P2 — Một bảng không cuộn ngang được.** 10 bảng dùng `.tablewrap`
(`overflow-x:auto`); riêng `viewCategories` để `<table>` trần trong `.panel` →
tràn 400px trong 356px. Đã bọc lại.

**P2 — Vùng chạm dưới 24px** (WCAG 2.2 AA 2.5.8): `.switch` 38×22, `.seg button`
51×22, `button.link` 65×15, ô tìm kiếm 220×15. Trang quản trị cố ý dày đặc nên
tôi **không phóng to thị giác**, chỉ nới vùng bấm bằng `::after`. Đã hit-test:
`.switch` và `button.link` đều đạt **đúng 24px**.

**P2 — Không có cách bỏ qua điều hướng.** Thanh bên 16 mục, người dùng bàn phím
phải Tab hết ở mọi khung nhìn; cũng không có landmark `<main>`. Đã thêm skip
link + đổi `#content` thành `<main>`. Kiểm chứng: Tab đầu tiên rơi đúng vào skip
link, nó hiện ra ở `top:12,left:12`, Enter nhảy tới `#content`.

**P2 — 72 ảnh thiếu kích thước nội tại** → layout nhảy mỗi lần dựng lại bảng.
Đã thêm `width`/`height` khớp kích thước CSS.

## 4. Hai phát hiện hoá ra KHÔNG phải lỗi

Ghi lại để lần sau không mất công đuổi theo:

1. **8 vi phạm tương phản ở Catalog mobile** xuất hiện trong một lượt quét. Chạy
   lại 3 lần liên tiếp: **0 vi phạm**. Đây là ảnh chụp trúng trạng thái quá độ
   (ảnh hover/lazy đang tải), không phải khiếm khuyết.
2. **5 màn hình form không có `KeyboardAvoidingView`** (checkout, login,
   register, addresses, forgot-password). Nhưng `AndroidManifest.xml` đặt
   `windowSoftInputMode="adjustResize"`, tức là hệ điều hành đã co khung và
   ScrollView vẫn cuộn tới được ô nhập. **Chưa đủ căn cứ để gọi là lỗi** khi
   chưa thử trên máy thật.

Ngoài ra, lần quét đầu báo "15/15 phần tử Admin không có chỉ báo focus" — đó là
**dương tính giả** của phép đo: `element.focus()` bằng mã không kích hoạt
`:focus-visible` như Tab thật. Kiểm lại bằng Tab: tất cả đều có viền 2px.

## 5. Phần CHƯA kiểm định — App Expo

**Không có bằng chứng chạy thật nào cho ứng dụng di động.**

- `adb devices`: trống — OPPO A78 không kết nối.
- `~/.android/avd/`: không có AVD nào. Dựng AVD mới đòi tải system image rồi
  khởi động emulator; bộ nhớ dự án ghi rõ việc này từng **làm sập phiên remote
  desktop** của người dùng, nên tôi không tự ý làm.

Theo quy định của skill, bề mặt này bị trần 8,9 và tôi **không công bố điểm** vì
chưa có ảnh chạy thật. Những gì đọc được từ mã nguồn (có `SafeAreaProvider` +
component `Screen` dùng chung, `KeyboardAvoidingView` ở cả hai màn chat, không
có phần trăm tiến trình giả, `adjustResize` đã bật) là **tín hiệu tốt nhưng
không phải bằng chứng** — skill cấm cho điểm cho mã "có vẻ đúng".

Muốn chấm App thì cần cắm OPPO A78 qua USB và bật gỡ lỗi.

## 6. Những gì KHÔNG bị thay đổi

Không đụng tới: quy tắc nghiệp vụ, hợp đồng API, giá, tồn kho, thanh toán, RBAC,
các cổng an toàn AI, dữ liệu người dùng. Không xoá tính năng nào. Không thêm
dependency nào — mọi sửa chữa đều dùng lại token và component sẵn có.

## 7. Lệnh kiểm thử và kết quả

| Lệnh | Kết quả |
|---|---|
| `npm --workspace backend test` | **359/359 pass** |
| `npm run test:python` | **104 pass**, 2 skip |
| `npm --workspace mobile run typecheck` | sạch |
| `cd web && npx tsc --noEmit` | sạch |
| `cd web && npm run lint` | sạch, 0 cảnh báo |
| `cd web && npm run build` | thành công, 27 tuyến |
| `cd web && npm run test` (vitest) | 7/7 pass |
| axe-core 4.13 (WCAG 2.0/2.1 A+AA) × 62 tổ hợp | **0 vi phạm** |
| GitNexus `impact` (`thumb`, `CheckoutForm`, `viewCategories`) | LOW / LOW / UNKNOWN¹ |
| GitNexus `detect_changes --scope all` | `critical`, 335 symbol² |

¹ `viewCategories` trả `risk: UNKNOWN`, 0 caller. Theo CLAUDE.md, UNKNOWN phải
xác minh bằng tìm kiếm văn bản: nó **có** được dùng ở `core.js:737` dưới dạng
định danh trần trong một object literal — đúng kiểu tham chiếu mà chỉ mục không
ghi nhận được. Không phải mã chết.

² `critical` là mức của **toàn bộ 163 tệp dirty có sẵn trong repo**, không phải
của thay đổi trong phiên này. Các symbol tôi thực sự sửa đều là thành phần giao
diện lá: `thumb`, `thumbFallback`, `viewCategories`, `CheckoutForm`,
`AccountOverview`, `TryOnStudio`. Không chạm hợp đồng dùng chung nào.

## 8. Tệp đã sửa (14)

```
web/app/globals.css                  +25/-1   focus ring, tương phản, .vertical-type
web/components/checkout-form.tsx     +9/-2    empty state chuẩn + CTA
web/components/tryon-studio.tsx      +8/-4    bỏ "Backend"/tên engine khỏi UI khách
web/components/account-pages.tsx     +2/-1    bỏ "backend"
web/app/dang-nhap/page.tsx           +2/-1    aria-hidden cho watermark
web/app/dang-ky/page.tsx             +2/-1    aria-hidden cho watermark
web/app/page.tsx                     +2/-1    bỏ "backend"
web/app/tai-khoan/page.tsx           +2/-1    bỏ "backend"/"wishlist"
web/app/tai-khoan/doi-tra/page.tsx   +2/-1    bỏ "Backend"
web/app/chinh-sach/[slug]/page.tsx   +4/-2    bỏ "backend" (2 chỗ)
admin/styles.css                     +36/-5   grid minmax(0,1fr), .ph wrap, 24px, skip link
admin/js/core.js                     +17/-2   readableInk(), width/height cho thumb
admin/js/views-content.js            +4/-2    bọc .tablewrap
admin/index.html                     +2/-1    skip link + <main>
```

## 9. Việc còn lại để Admin đạt 9,5

1. Chạy một lượt bằng trình đọc màn hình (NVDA/Orca) trên 16 khung nhìn.
2. Đo LCP/CLS thật, thay cho suy luận từ thuộc tính ảnh.
3. Diễn tập luồng lỗi/thử lại (ngắt mạng, 500, 409) trên các màn ghi dữ liệu.
