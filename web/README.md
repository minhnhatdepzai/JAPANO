# JAPANO Storefront (web)

Website bán hàng của JAPANO. **Đây là một dự án độc lập**, không phải Expo Web và
không dùng chung dependency với ứng dụng di động.

- Ứng dụng di động ở `mobile/` chạy React 18 / React Native / Expo SDK 51.
- Website ở `web/` chạy React 19 + App Router (qua [vinext](https://www.npmjs.com/package/vinext)).
- `web/` **không** nằm trong npm workspaces của repo gốc và có `package.json`,
  `package-lock.json`, `node_modules` riêng.
- Website không import bất kỳ tệp nào trong `mobile/app`, `mobile/components`
  hay bất kỳ package React Native nào. Asset thương hiệu được **đọc qua backend**
  (`/media/assets/brand/...`), không sao chép mã của app.

## Cài đặt

```bash
npm --prefix web install
npx --prefix web playwright install chromium   # chỉ cần cho e2e
```

Không chạy `npm install` ở thư mục gốc để cài dependency của web — hai cây
dependency được giữ tách biệt có chủ đích (root ghim `@types/react@18`, web dùng
React 19).

## Chạy

| Việc | Lệnh | Địa chỉ |
|---|---|---|
| Dev server | `npm --prefix web run dev` | http://localhost:4200 |
| ESLint | `npm --prefix web run lint` | |
| Kiểm tra kiểu | `npm --prefix web run typecheck` | |
| Unit test | `npm --prefix web run test` | |
| Build production | `npm --prefix web run build` | `web/dist/` |
| E2E | `npm --prefix web run e2e` | |
| Chạy bản build bằng workerd | `npm --prefix web start` | http://localhost:4200 |

Phiên phát triển được kiểm tra ngày 2026-08-30 còn truy cập được trong cùng
tailnet tại <http://100.69.188.16:4200>. Đây là TCP forward tạm của user service
`japano-storefront-tailnet`, không phải HTTPS Tailscale Serve bền vững; nó có thể
dừng sau logout hoặc reboot. Cấu hình HTTPS lâu dài cần quyền quản trị:

```bash
sudo tailscale serve --bg --yes --https=4200 http://127.0.0.1:4200
```

## Backend dùng chung qua Tailscale

Website **không kết nối MongoDB trực tiếp**. Mọi dữ liệu sản phẩm, tài khoản, đơn
hàng, voucher và AI đều đi qua backend JAPANO — cùng backend, cùng MongoDB Atlas
database `japano` mà ứng dụng di động đang dùng. Không có catalog JSON riêng cho
website.

```
JAPANO_API_ORIGIN=https://rd-system.tail6502ce.ts.net:4101
```

Đây là mặc định trong `web/.env.example`, `web/wrangler.jsonc`,
`web/lib/server-api.ts`, `web/app/api/[...path]/route.ts` và
`web/app/media/[...path]/route.ts`. **Không đổi về `127.0.0.1:4100`.**

> **Yêu cầu thiết bị:** cổng `:4101` hiện là *tailnet-only*. Máy hoặc thiết bị
> chạy website phải nằm trong cùng tailnet Tailscale thì mới gọi được backend.
> Kiểm tra bằng `tailscale status` và
> `curl -fsS https://rd-system.tail6502ce.ts.net:4101/api/health`.

## Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `JAPANO_API_ORIGIN` | có (mặc định là URL Tailscale) | Gốc backend JAPANO mà BFF gọi tới |
| `NEXT_PUBLIC_SITE_URL` | có cho SEO | URL công khai dùng cho canonical, sitemap, JSON-LD |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | không | Bật nút Google Sign-In; để trống thì nút không hiển thị |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` | không | Chỉ dùng nếu backend nằm sau Cloudflare Access. Đặt bằng `wrangler secret put`, **không** để giá trị thật trong repo và không bao giờ lộ ra bundle client |

Bản đồ trang chủ dùng trực tiếp Google Maps Embed do chủ cửa hàng cung cấp;
trang `/cua-hang` chỉ tải iframe sau khi người dùng bấm mở. Cả hai không cần API
key hoặc biến môi trường bản đồ riêng.

## Kiến trúc BFF

Trình duyệt **chỉ gọi same-origin**:

- `/api/*` → `web/app/api/[...path]/route.ts` chuyển tiếp sang backend JAPANO.
- `/media/assets/*` → `web/app/media/[...path]/route.ts` phục vụ asset thương hiệu
  và ảnh sản phẩm cục bộ từ backend.

Ràng buộc đang được thực thi trong mã:

- Đăng nhập/đăng ký trả JWT về BFF; BFF **xoá token khỏi body** và đặt vào cookie
  `japano_session` với `HttpOnly`, `SameSite=Lax`, `Secure` khi chạy HTTPS.
  JWT không bao giờ vào `localStorage`.
- Mọi mutation kiểm tra `Origin`/`Sec-Fetch-Site`; yêu cầu chéo site bị trả 403.
- Khách chỉ có quyền đọc catalog và nội dung công khai. Mọi mutation (ngoại trừ
  đăng nhập/đăng ký/khôi phục mật khẩu) và các API cá nhân/AI đều cần cookie
  phiên; thiếu cookie được BFF trả `401` trước khi request chạm backend.
- Các prefix `admin`, `state`, `seed`, `reset`, `analytics`, `users`, `payments`
  bị chặn ở BFF (trả 404). Admin **không** được proxy qua storefront.
- Chỉ route công khai (`storefront/home`, `products`, `shop`, `categories`,
  `banners`, `japan-spots/*`, `policies/fulfillment`) mới được cache; mọi thứ
  còn lại là `no-store`.
- `lib/server-api.ts` giữ một bộ đệm TTL 30 giây trong tiến trình cho các lần đọc
  catalog công khai, để một lần render trang không gọi backend nhiều lần. Không
  có dữ liệu cá nhân nào đi qua bộ đệm này.
- Sau khi có phiên đăng nhập, Storefront nạp giỏ và wishlist của đúng tài khoản
  (`POST /api/carts/sync` và `/api/wishlist/sync`), dựng lại giao diện từ catalog
  hiện tại và tiếp tục đồng bộ mọi thay đổi về backend. Storefront không tạo giỏ
  hoặc wishlist khách; cache `localStorage` được tách theo user đã xác thực và
  các khóa guest cũ bị loại bỏ để không lộ dữ liệu giữa những người dùng chung
  trình duyệt. Mobile cũng đọc nguồn backend này khi đăng nhập.
- Mọi thẻ và trang chi tiết đều hiện `Đã bán N`, gồm cả `0`. `N` được backend
  tính từ đơn thành công thật, bỏ đơn demo/test; trang bán chạy không dùng số
  seed hoặc nhãn gắn tay.

## Async AI jobs

Try-on, motion và ghép cảnh Nhật chạy trên GPU và mất hàng chục giây, quá lâu cho
một request đồng bộ qua BFF. Backend có thêm hàng đợi bất đồng bộ
(`backend/routes/asyncAiJobs.js`):

| Tạo | Theo dõi | Huỷ |
|---|---|---|
| `POST /api/tryon/jobs` | `GET /api/tryon/jobs/:id` | `DELETE /api/tryon/jobs/:id` |
| `POST /api/tryon/motion/jobs` | `GET /api/tryon/motion/jobs/:id` | `DELETE /api/tryon/motion/jobs/:id` |
| `POST /api/japan-spots/scene-photo/jobs` | `GET /api/japan-spots/scene-photo/jobs/:id` | `DELETE /api/japan-spots/scene-photo/jobs/:id` |

- Trạng thái thật: `queued`, `running`, `completed`, `failed`, `cancelled`.
  Giao diện chỉ hiển thị đúng bước đang chạy — **không có thanh phần trăm giả**.
- Job chỉ tồn tại trong RAM với TTL (mặc định 15 phút) và giới hạn số lượng.
  **Không có collection MongoDB nào được tạo cho job.**
- Ảnh đầu vào bị xoá khỏi job ngay khi job kết thúc hoặc bị huỷ.
- `DELETE` abort request đang bay tới dịch vụ AI.
- **Các endpoint đồng bộ cũ (`POST /api/tryon`, …) giữ nguyên** cho ứng dụng di
  động. Hàng đợi mới là bổ sung tương thích ngược, không thay thế.

Phía website, `runAiJob()` trong `web/lib/client-api.ts` là nơi duy nhất chạy
vòng tạo → poll → huỷ.

## Cinematic footage, GSAP và React Bits

Storefront dùng footage cục bộ và `gsap@3.15.0`, nhưng animation không nằm trên
đường bắt buộc của mua hàng:

- Hero phát video thật cánh sakura rơi; AI split phát timelapse Fuji ghép đàn
  chim thật. Bốn derivative MP4/WebP nằm trong `public/media/cinematic/`, tổng
  khoảng 4,72 MB; bản tải gốc không nằm trong repo. Nguồn Pexels và giấy phép
  được ghi tại `../THIRD_PARTY_NOTICES.md`.
- `CinematicBackgroundVideo` chỉ phát khi phần tử ở trong viewport và tab đang
  hiện. Data Saver, `prefers-reduced-motion` hoặc lỗi phát video giữ poster WebP.
- FadeContent được áp dụng cho các section biên tập; SpotlightCard chỉ dùng cho
  ba thẻ chính sách. Đây là adaptation từ React Bits bằng Web Animations API và
  CSS, không kéo thêm runtime package. Sản phẩm, giỏ, đăng nhập và thanh toán
  không nhận hiệu ứng React Bits.
- `CinematicMotion` dùng GSAP cho ink ripple khi click, brush wipe khi đổi route,
  thumbnail sản phẩm bay về giỏ và badge phản hồi. Drawer chỉ chờ tối đa 460 ms;
  nếu animation không khả dụng thì mở ngay.
- Lớp xác nhận đơn chỉ chạy **sau** khi `POST /api/orders` tạo đơn COD thành
  công. Stripe/VNPay không hiển thị thành công giả trước callback của cổng
  thanh toán.
- Tất cả lớp trang trí có `pointer-events: none`; reduced motion tắt video,
  Fade/Spotlight, ripple, cart-flight, route-brush và order overlay.

Lighthouse desktop trên build production sau thay đổi: Performance **94**,
Accessibility **100**, Best Practices **100**, SEO **100**; FCP 0,8 s, LCP
1,5 s, TBT 10 ms, CLS 0,003. Mục giảm tiếp theo là ảnh catalog: audit ước tính
có thể tiết kiệm khoảng 1,8 MB nếu backend sinh đúng thumbnail AVIF/WebP theo
kích thước hiển thị.

## Ranh giới AI và quyền riêng tư

- Đo cơ thể và thử đồ là hai khả năng tách biệt. Thiếu bằng chứng số đo hiển thị
  rõ **"Chưa đủ bằng chứng"** và **không** chặn thử đồ nếu ảnh đủ điều kiện.
  Không bịa chiều cao, cân nặng, vòng ngực, eo hay hông.
- Kết quả thử đồ là ảnh AI thật từ backend. Không có overlay giả.
- Trang phục 18+ giữ nguyên adult gate, consent và coverage gate của backend.
  Xác nhận của người dùng không tắt safety.
- Ảnh cá nhân không được lưu vào MongoDB, không ghi vào log, không cache.
- Website không tuyên bố bất kỳ mô hình nào đã được "fine-tune".

## Kiểm thử

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run build
npm --prefix web run e2e
```

Bộ Playwright tập trung vào footage, React Bits, bản đồ và Reduce Motion đạt
**5 pass và 1 mobile skip có chủ đích**. Full dev suite hiện đạt **29 pass, 2
fail và 1 skip**; hai fail là cùng cảnh báo preload `as` của Vinext dev trên PDP.
Full workerd production còn lộ hydration React/Vinext #418 ở các trang client
sau điều hướng, nên chưa được ghi là toàn bộ pass. Suite chạy hai project
(`mobile-390`, `desktop-1440`) và phủ: catalog
thật ở trang chủ, hàng mới, bán chạy không gắn nhãn giả, search/filter/sort trên
URL, PDP màu–size–tồn kho, quick-add và số lượng giỏ, wishlist, phân quyền khách
đọc-only và đồng bộ tài khoản thật, voucher do backend quyết định, store locator QTSC9
(10.8537915, 106.6260636), 360/390 không tràn ngang, điều hướng bàn phím,
`prefers-reduced-motion`, footage Sakura/Fuji, React Bits adaptations, GSAP
cart/order/route motion và hợp đồng
job try-on bằng stub. Mọi test đều fail nếu console có error/warning, có ảnh vỡ,
hoặc có nút nhỏ hơn 44×44.

Ngày 2026-09-04, unit suite Storefront đạt 13/13, TypeScript sạch, ESLint sạch và
production build thành công. Case phân quyền khách cũng đạt trên Chromium
desktop 1440 và mobile 390; phiên đăng nhập thật vẫn mở được phòng thử đồ.

### Smoke AI thật (cần GPU)

```bash
JAPANO_E2E_REAL_AI=1 npm --prefix web run e2e
```

Chạy `e2e/real-ai.spec.ts`: gọi đúng hàng đợi bất đồng bộ và **bắt buộc nhận
được ảnh/video thật** — HTTP 200 không được tính là đạt. Kết quả được ghi ra
`web/test-results/real-ai/`. Ảnh người dùng để test lấy từ
`test-assets/people/average/00858_00.jpg` (đổi bằng `JAPANO_E2E_PERSON_IMAGE`).

### Lưu ý về rate limit

Backend dùng chung có rate limit thật: 600 request/5 phút cho API và 20 lần/15
phút cho `/api/auth/*`. Đây là lớp bảo vệ production, **không nới ra để test chạy
qua**. Bộ e2e mặc định dùng 2 worker; chạy lại liên tiếp nhiều lượt trong vài
phút có thể chạm trần auth và làm test đăng nhập fail bằng HTTP 429 — đợi cửa sổ
reset rồi chạy lại. Điều chỉnh bằng `PLAYWRIGHT_WORKERS`.

Tài khoản e2e cố định là `web-e2e@japano.test` (đổi bằng `JAPANO_E2E_EMAIL` /
`JAPANO_E2E_PASSWORD`). Nó được đăng ký một lần rồi tái sử dụng để không sinh
người dùng rác trong Atlas dùng chung.

## Cloudflare

`web/wrangler.jsonc` đã sẵn sàng và `wrangler deploy --dry-run` chạy được:

```bash
cd web
npx wrangler whoami
npm run cf:types
npm run build
npx wrangler deploy --dry-run --config dist/server/wrangler.json
```

**Giới hạn đã biết:** Worker công khai của Cloudflare **không gọi được** origin
tailnet-only `https://rd-system.tail6502ce.ts.net:4101`. Muốn đưa website ra
Internet cần một trong hai, và cả hai đều là quyết định hạ tầng chưa được thực
hiện:

1. **Tailscale Funnel** mở giới hạn cho đúng API storefront; hoặc
2. **Cloudflare Tunnel** trỏ tới backend.

Trong cả hai trường hợp: không public Admin, không public MongoDB, không public
cổng AI worker `7862/7863/7864`.

## Giới hạn chưa xác minh

- Chưa deploy Cloudflare thật: máy này chưa đăng nhập `wrangler`, và origin
  tailnet-only chưa public. Chỉ build và `--dry-run` là đã chạy được.
- Chưa đo Lighthouse trên bản production được phục vụ công khai.
- Google Sign-In: mã và luồng BFF đã sẵn sàng nhưng chưa có
  `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` cho web nên **chưa từng đăng nhập Google
  thật thành công**. Cấu hình hay build thành công không phải bằng chứng.
- Thanh toán Stripe/VNPay mới đi đến bước tạo phiên; chưa chạy hết một giao dịch
  sandbox từ website.
