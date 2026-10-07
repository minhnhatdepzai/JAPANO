<div align="center">

# JAPANO

**Nền tảng thương mại điện tử thời trang Nhật Bản, có thử đồ AI trên ảnh thật.**

Chọn một sản phẩm, đưa ảnh của bạn vào, và nhận lại bức ảnh do AI sinh ra —
không phải ảnh sản phẩm dán đè lên người. Kèm gợi ý size có bằng chứng, video
chuyển động từ chính kết quả đó, và một chuyến "đi Nhật" ngay trong khung ảnh.

[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Expo](https://img.shields.io/badge/Expo-SDK%2051-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.74-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-CUDA-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

JAPANO gồm **bốn sản phẩm chạy trên cùng một backend**: ứng dụng di động Android,
website storefront, trang quản trị, và một cụm dịch vụ AI chạy trên GPU nội bộ.
Toàn bộ tính năng thương mại — giỏ hàng, voucher, thanh toán, đổi trả, loyalty —
đều hoạt động thật, và mọi con số AI trong tài liệu này đều đến từ một lượt đo
thực tế trên máy, không phải ước lượng.

> [!TIP]
> Coding agent nên đọc [`docs/CODEX_PROJECT_MEMORY.md`](docs/CODEX_PROJECT_MEMORY.md)
> trước khi quét toàn bộ repo — file đó ghi runtime, bằng chứng và việc đang làm dở.

## Mục lục

- [Điểm mạnh](#điểm-mạnh)
- [Kiến trúc](#kiến-trúc)
- [Module](#module)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [AI trong JAPANO](#ai-trong-japano)
  - [Fine-tune: cái gì thật sự được huấn luyện](#fine-tune-cái-gì-thật-sự-được-huấn-luyện)
  - [Đo cơ thể từ ảnh](#đo-cơ-thể-từ-ảnh)
  - [Gợi ý và phân tích](#gợi-ý-và-phân-tích)
- [Hoạt động thế nào](#hoạt-động-thế-nào)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Kiểm thử](#kiểm-thử)
- [Giới hạn đã biết](#giới-hạn-đã-biết)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)

## Điểm mạnh

**Thử đồ là ảnh AI thật, không phải overlay.** Pipeline chạy FASHN VTON 1.5, có
pose transfer bằng FLUX.2 khi ảnh khó, và một quality gate chấm danh tính, cấu
trúc và độ che phủ trước khi trả ảnh. Nếu ảnh sinh ra làm sai cơ thể, backend giữ
ảnh sạch thay vì trả ảnh hỏng.

**Độ vừa vặn điều khiển bức ảnh, không chỉ là dòng chữ cảnh báo.** Chọn size nhỏ
hơn cơ thể thì vải căng, đường may bị kéo, và ở mức rất chật thì trang phục có
thể bục — kích hoạt theo độ chật **đo được**, không theo việc shop còn size hay
không. Đồ bơi, crop top, quần và chân váy **không bao giờ** bục, vì bục ở đó là
làm hở thêm cơ thể.

**Đo cơ thể có trách nhiệm.** Một ảnh không có vật chuẩn thì không thể xác định
chính xác chiều cao hay số đo. Hệ thống trả về **khoảng 10 đơn vị kèm độ tin
cậy**, nói rõ "chưa đủ bằng chứng" khi ảnh bị cắt cụt hoặc mặc đồ quá rộng, và
**số đo người dùng tự nhập luôn thắng ước lượng của AI**.

**Thiếu số đo không chặn thử đồ.** Đo cơ thể và thử đồ là hai khả năng tách biệt.
Một ảnh không đo được vẫn có thể đủ điều kiện tạo ảnh thử đồ, và ngược lại.

**"Đưa tôi đến đây".** Sau khi thử đồ, kết quả được ghép vào ảnh thật của một địa
điểm Nhật Bản. Mỗi cảnh có metadata riêng — điểm đặt chân, vùng đứng được, tỉ lệ
người, hướng sáng — nên người đứng đúng mặt đất chứ không lơ lửng giữa mặt nước.

**Một backend, ba client.** App, website và Admin dùng chung catalog, tài khoản,
đơn hàng, voucher và AI. Không có bản sao dữ liệu nào cho riêng client nào.

**Chạy được khi không có GPU.** Backend, Admin, gợi ý sản phẩm, phân tích và
fallback của chatbot đều chạy trên CPU. Không có GPU thì các nút AI báo lỗi rõ
ràng thay vì trả kết quả giả.

**Nói thật về AI.** Chỗ nào là fine-tune có checkpoint thì nói rõ; chỗ nào chỉ là
tối ưu suy luận hoặc heuristic minh bạch thì cũng nói rõ. Chỉ số nào chưa đo thì
báo `not-measured` thay vì bịa một con số đẹp.

## Kiến trúc

```mermaid
flowchart TD
    Mobile["📱 Mobile app<br/>Expo · React Native"] --> API
    Web["🌐 Website storefront<br/>React 19 · App Router"] --> BFF["BFF same-origin<br/>/api · /media"]
    BFF --> API
    Admin["🛠️ Web Admin<br/>JavaScript thuần"] --> API

    API["⚙️ Backend REST API<br/>Express · Node 20"]

    API --> Data[("MongoDB Atlas")]
    API --> Media["Cloudinary<br/>media"]
    API --> Pay["Stripe Test<br/>VNPay Sandbox"]
    API --> Reco["Gợi ý + Phân tích<br/>thuần Node, CPU"]

    API --> Body["Body analysis :7863<br/>YOLOv8n-pose + U2Net + hồi quy"]
    API -. khi bấm thử đồ .-> TryOn["Try-on :7862<br/>FASHN VTON 1.5 + FLUX.2"]
    API -. khi tạo video .-> Motion["Motion<br/>Wan2.1 + One-to-All"]
    API -. tuỳ chọn .-> LLM["Ollama<br/>Qwen2.5 · Qwen3-VL"]

    TryOn <--> Arbiter{{"GPU arbiter<br/>một model giữ VRAM tại một thời điểm"}}
    Motion <--> Arbiter
    LLM <--> Arbiter
```

Mỗi dịch vụ AI là một tiến trình riêng và **chỉ chiếm GPU khi được gọi**. Một GPU
arbiter xếp hàng theo màn hình người dùng đang mở, nạp và nhả model tuần tự, nên
16 GB VRAM đủ cho cả try-on ~15 GB lẫn motion ~13,5 GB mà không OOM.

| Dịch vụ | Cổng | Tài nguyên | Bắt buộc |
|---|---|---|---|
| `japano-backend` | 4100 | CPU | ✅ |
| `japano-body-analysis` | 7863 | CPU — cố ý không chiếm VRAM | ❌ có đường lùi |
| `japano-fashn` | 7862 | GPU ~15 GB | ❌ chỉ khi thử đồ |
| `japano-motion` | — | GPU ~13,5 GB | ❌ chỉ khi tạo video |

```bash
./scripts/japano-services.sh on      # bật cả cụm và chờ sẵn sàng
./scripts/japano-services.sh off     # tắt tạm, nhường CPU/GPU cho việc khác
./scripts/japano-services.sh status  # ai đang chạy, ai đang giữ GPU
```

## Module

### 📱 Ứng dụng di động

| Nhóm | Chức năng |
|---|---|
| **Mua sắm** | Catalog, tìm kiếm, lọc/sắp xếp, gallery ảnh–video, wishlist, giỏ đa biến thể, voucher, sổ địa chỉ |
| **Thanh toán** | COD, Stripe Card/Checkout (Test Mode), VNPay Sandbox trong WebView |
| **Hậu mãi** | Timeline đơn, yêu cầu trả từng dòng hàng, theo dõi hoàn tiền |
| **Thử đồ AI** | Tải/chụp ảnh thật, chọn màu–size theo tồn kho, virtual try-on, phụ kiện theo pose, quality gate, video "Ảnh sống" |
| **Đo cơ thể** | Chiều cao, cân nặng, vòng 1/2/3 dạng khoảng kèm độ tin cậy và cảnh báo |
| **Trợ lý Ori** | Botchat nổi + màn chat đầy đủ, grounded vào catalog thật, nhớ nhiều lượt |
| **Stylist** | Màu chủ đạo, hồ sơ phong cách, tư vấn size, gợi ý outfit |
| **Nhật Bản** | 25 địa danh, review cộng đồng, gợi ý trải nghiệm, ghép ảnh "Đưa tôi đến đây" |
| **Mục tiêu** | Quỹ tiết kiệm mua sản phẩm; lộ trình sức khoẻ tách riêng, có guardrail |
| **Loyalty** | VIP theo chi tiêu tháng, Flagcard, voucher cá nhân, thông báo |

Bản phát hành hiện tại: `1.0.19` (`versionCode 20`), package `vn.japano.app`,
targetSdk 34. Cài đè để giữ dữ liệu; **không** gỡ bản cũ trước.

`1.0.19` bỏ ảnh người mẫu thử nhanh khỏi màn TryOn: khách chỉ chụp hoặc tải ảnh
thật từ thư viện. Màn này hiện tồn kho theo từng màu–size, giữ ảnh kết quả khi
ghép tiếp phụ kiện, và tách hiệu ứng chờ thành 5 giây "Đang kiểm tra ảnh" rồi
mới đếm "Thời gian xử lý AI" từ 0. Request GPU không bị huỷ khi app vào nền;
khi quay lại, đồng hồ dùng thời gian thực và kết quả vẫn được nhận bình thường.
Catalog giữ bản server gần nhất, tự tải lại khi app trở thành active và thử lại
mỗi 12 giây khi mất kết nối, nên lỗi mạng lúc mở app không còn làm mất lựa chọn
màu–size vào dữ liệu mẫu đóng gói.

### 🌐 Website storefront

Dự án **độc lập** trong [`web/`](web) — React 19 + App Router, dependency riêng,
không nằm trong npm workspaces và không import một dòng React Native nào. Nó gọi
backend qua một lớp BFF same-origin: trình duyệt chỉ thấy `/api` và `/media`, JWT
nằm trong cookie `HttpOnly` chứ không vào `localStorage`, mutation kiểm tra
`Origin`, và các route quản trị bị chặn ngay ở tầng proxy.

Hàng đợi AI bất đồng bộ (`queued → running → completed/failed/cancelled`) cho
phép thử đồ mất một phút mà không treo request, huỷ được giữa chừng, và **không
hiển thị thanh phần trăm giả**. Hero dùng video thật, tự dừng khi ra khỏi khung
nhìn và rơi về ảnh tĩnh khi bật Data Saver hoặc `prefers-reduced-motion`. Bản đồ
cửa hàng chỉ nhúng khi người dùng bấm mở, để trang mua sắm luôn nhẹ.

Chi tiết: [`web/README.md`](web/README.md).

App và Storefront dùng cùng backend MongoDB, catalog, danh tính người dùng, đơn
hàng, giỏ và wishlist khi đăng nhập bằng cùng email. Cache AsyncStorage/localStorage
chỉ giúp mở nhanh/offline sau khi xác thực và được tách theo từng user. Storefront
không có giỏ/yêu thích khách: chưa đăng nhập chỉ xem, tìm và lọc sản phẩm; giỏ,
yêu thích, thanh toán, tài khoản, Ori và thử đồ AI đều chuyển tới đăng nhập và
BFF từ chối API bảo vệ bằng `401`. Sau đăng nhập, hai client tiếp tục đồng bộ
giỏ/wishlist của tài khoản về backend. Số “Đã bán” trên mọi
thẻ sản phẩm lấy từ đơn thành công thật (loại dữ liệu demo/admin-test), kể cả khi
giá trị là 0 — không chèn đơn giả để làm bảng bán chạy trông dày hơn.

### 🛠️ Web Admin

| Nhóm | Chức năng |
|---|---|
| **Dashboard** | KPI trực tiếp, doanh thu, đơn, tồn kho, khách hàng |
| **Analytics** | Forecast 3 tháng, DemandScore, inventory risk, K-Means, RFM churn, market basket |
| **Model observability** | Trạng thái từng expert gợi ý, graph edges, training pairs, coverage, bot telemetry |
| **Commerce** | Đơn, sản phẩm, biến thể, danh mục, người dùng, giỏ đang hoạt động |
| **Payment** | Tra cứu giao dịch Stripe/VNPay, reconcile, return, refund |
| **Content** | Duyệt review, Japan community, banner, thông báo, voucher |
| **Integrations** | Health của API, media, payment gateway và từng dịch vụ AI |

Phân quyền `customer < staff < admin < super_admin`; endpoint nhạy cảm có
middleware kiểm tra vai trò riêng. Sản phẩm chỉ **ẩn/hiện lại**, không xoá vĩnh
viễn — để đơn hàng và báo cáo cũ không mất tham chiếu.

### ⚙️ Backend

REST API chia theo domain trong [`backend/routes`](backend/routes) — auth,
catalog, orders, returns, reviews, loyalty, payments, stylist, tryon, japanSpots,
push và hàng đợi AI bất đồng bộ. Nguyên tắc xuyên suốt: **giá, voucher, tồn kho
và tổng tiền luôn được tính lại phía server**; client không bao giờ là nguồn sự
thật. Đăng nhập dùng bcrypt + JWT; rate limit chống brute-force chỉ áp cho
endpoint thật sự nhận thông tin đăng nhập, không áp cho kiểm tra phiên.

Kèm theo là dữ liệu hành chính Việt Nam sau sáp nhập: **34 tỉnh/thành và 3.321
phường/xã**, dùng chung cho sổ địa chỉ của app và website.

## Công nghệ sử dụng

<table>
<tr><th align="left">Tầng</th><th align="left">Công nghệ</th></tr>
<tr>
<td><b>Mobile</b></td>
<td>Expo SDK 51 · React Native 0.74 · React 18 · Expo Router · SecureStore · expo-notifications · Stripe React Native · Google Sign-In</td>
</tr>
<tr>
<td><b>Website</b></td>
<td>React 19 · App Router (vinext) · TypeScript strict · TanStack Query · Zod · React Hook Form · Motion for React · GSAP · View Transitions · Tailwind 4 · Vitest · Playwright · Cloudflare Workers</td>
</tr>
<tr>
<td><b>Backend</b></td>
<td>Node 20 · Express 4 · MongoDB Atlas · Cloudinary · JWT + bcrypt · Helmet · express-rate-limit · Pino · Stripe · Nodemailer · Sentry</td>
</tr>
<tr>
<td><b>AI runtime</b></td>
<td>PyTorch + CUDA · FASHN VTON 1.5 · FLUX.2 Klein 4B · Wan2.1-T2V-1.3B · One-to-All Animation · YOLOv8n-pose · U2Net · ONNX Runtime · scikit-learn · Ollama (Qwen2.5, Qwen3-VL)</td>
</tr>
<tr>
<td><b>Admin</b></td>
<td>HTML · CSS · JavaScript thuần, không build step</td>
</tr>
<tr>
<td><b>Vận hành</b></td>
<td>systemd user services · Tailscale · Playwright · Lighthouse</td>
</tr>
</table>

## AI trong JAPANO

Năm nhóm model, mỗi nhóm giải một bài toán khác hẳn nhau. Không model nào kiêm
việc của model khác.

**Nhóm 1 — Nhìn ảnh, hiểu người trong ảnh.** Luôn chạy, CPU.

| Model | Vai trò |
|---|---|
| YOLOv8n-pose | 17 khớp cơ thể, chọn chủ thể chính khi ảnh có nhiều người |
| U2Net | Tách nền, lấy silhouette |

Ảnh nhiều người: **chỉ một người được thay đồ** — người to nhất và gần ống kính
nhất, chấm bằng diện tích, chiều cao khung, vị trí và độ tin cậy.

**Nhóm 2 — Từ hình học ra số đo.** Luôn chạy, CPU, **huấn luyện trong repo này**.

| Artifact | Vai trò | Train trên |
|---|---|---|
| `body_geometry.calibration.json` | Cắt hai cánh tay khỏi thân, trần/sàn giải phẫu | VITON-HD + cực trị ANSUR II |
| `body_bmi_estimator.joblib` | Tỉ lệ bề ngang → BMI, không cần thang cm | ANSUR II |
| `body_weight_estimator.joblib` | Chiều cao + bề ngang + độ rộng quần áo → cân nặng | ANSUR II |
| `body_girth_estimators.joblib` | Bề ngang → vòng ngực/eo/hông | ANSUR II |
| `bodym_population_calibration.json` | Kéo đầu ra về dân số chung | BodyM |

**Nhóm 3 — Sinh ảnh thử đồ.** GPU, chỉ khi người dùng bấm thử.

| Model | Vai trò | Trạng thái |
|---|---|---|
| FASHN VTON 1.5 | Engine try-on chính | Inference |
| FLUX.2 Klein 4B | Pose transfer khi ảnh khó, tinh chỉnh phụ kiện, ghép bikini hai mảnh đa tham chiếu | Inference |
| **LoRA rank 8 trên FLUX.2** | Mô phỏng chật/vừa/rộng theo size | **Fine-tune trong dự án này** |

**Nhóm 4 — Sinh video chuyển động.** GPU, tuỳ chọn.

| Model | Vai trò |
|---|---|
| Wan2.1-T2V-1.3B + One-to-All `1.3b_2` | Video từ ảnh đã thử đồ, CUDA-only |
| YOLOv10m + ViTPose (ONNX) | Pose control và kiểm tra action cho motion |

**Nhóm 5 — Ngôn ngữ.** Tuỳ chọn, qua Ollama. `qwen2.5:7b` viết lại câu trả lời đã
grounded và duyệt review; `qwen3-vl:8b` đọc ảnh sản phẩm sinh mô tả. Khi Ollama
tắt hoặc GPU bận, mọi tính năng vẫn chạy bằng đường lùi cục bộ — LLM chỉ được
phép **viết lại** bản nháp đã grounded, không được bịa tồn kho, giá hay sự thật
về cơ thể.

### Fine-tune: cái gì thật sự được huấn luyện

> [!IMPORTANT]
> Trong dự án này, "fine-tune" chỉ được dùng khi có đủ: dữ liệu có license rõ,
> optimizer thật sự cập nhật trọng số, checkpoint tải lại được kèm hash, và đánh
> giá trên tập tách theo danh tính. Mọi thứ khác gọi đúng tên của nó.

**✅ Đã fine-tune — LoRA cho bước fit-refinement**

| Mục | Giá trị |
|---|---|
| Base model | FLUX.2 Klein 4B (img2img) |
| Adapter | LoRA rank 8, alpha 8 |
| Dữ liệu | VITON-HD — 116 mẫu, 21 danh tính, 7 lớp `good` → `very_loose` |
| Chia dữ liệu | **Theo danh tính**: train 81 mẫu/15 người · validation 18/3 · test 17/3 |
| Cấu hình | 512 px, BF16, batch 1, grad-accum 4, Adam 8-bit, LR `1e-4`, 600 bước, seed 17 |
| Tài nguyên đo được | 80,3 phút · peak VRAM 15,2 GB |
| Checkpoint được chấp nhận offline | `checkpoint-400`, hash `a1643dda4cdb1f3c-16731128`; runtime mặc định không nạp |

Checkpoint 500 và 600 **bị acceptance gate loại** vì artifact — mốc cuối không
mặc nhiên là mốc tốt nhất. Benchmark validation (8 mẫu / 2 danh tính):

| Chỉ số | Baseline | LoRA ckpt-400 |
|---|---:|---:|
| Pass rate | 100% | 100% |
| Failure / artifact | 0% / 0% | 0% / 0% |
| Body drift ↓ | 0,1148 | **0,1145** |
| Fit structure change ↑ | 16,7195 | **19,0849** |
| Color shift ↓ | 6,6574 | 8,4305 |
| Latency P50 | 13,43 s | 14,54 s |

Đây là **proxy từ quality gate, không phải điểm người chấm**. Adapter chỉ áp cho
`tops` — đúng miền dữ liệu upper-body — và **mặc định tắt**, bật bằng
`JAPANO_FIT_LORA_PATH`. Trạng thái luôn đọc từ
[`fit_lora.status.json`](backend/ai_training/models/fit_lora.status.json), không
chép từ tài liệu. Quy trình tái tạo dataset, train và benchmark nằm trong
[`backend/ai_training/README.md`](backend/ai_training/README.md).

QA runtime ngày 05/09/2026 với 10 bộ bổ sung × 5 ảnh full-body đã được AI
outpaint: 49/50 request trả ảnh, một ca fail-closed; tuy nhiên review nghiêm ngặt
chỉ ra 0/50 ảnh giữ đúng đồng thời loại, kết cấu và phom garment. Có 35/50 ảnh
giữ được màu/họa tiết nhưng sai dáng, 14/50 không còn nhận ra đúng garment và 1
lỗi kỹ thuật. Đây là giới hạn chất lượng hiện tại, không được diễn giải 49/50
thành tỷ lệ thành công thị giác. Chi tiết và contact sheet nằm tại
[`test-results/tryon/2026-09-05/10-more-outfits-x-5-full-body-ai-20260905-050239/`](test-results/tryon/2026-09-05/10-more-outfits-x-5-full-body-ai-20260905-050239/).

Test bổ sung lúc 06:43 ngày 05/09: Yukata xanh chàm + Haori Seigaiha × 5 mẫu
trả 10/10 ảnh 960×1280, trung bình 33,16 giây (fast, size M, không profile/số đo).
Yukata vẫn sai phom ở 5/5 ảnh; Haori có 3/5 ảnh đóng vạt thành sơ mi.
Xem [bảng ảnh và review](test-results/tryon/2026-09-05/2-outfits-x-5-people-064308/REVIEW.md); tỷ lệ API không phải tỷ lệ đạt thị giác.

Cùng ngày, test riêng `bikini-hoa-anh-dao` trên 5 ảnh đó đạt 5/5 API và 5/5
giữ đúng thiết kế hai mảnh/họa tiết, nhưng không giữ nghiêm ngặt pose ban đầu.
P50 là 36,72 giây; cold-start đầu tiên 88,19 giây, bốn lượt sau trung bình 35,99
giây. Bikini chậm vì có cổng Qwen3-VL kiểm tra ảnh người lớn trước, rồi chạy một
lượt FLUX.2 đa tham chiếu low-memory cho cả áo và quần; arbiter nhả model khi về
focus `browse`, nên lần sau phải nạp lại. Xem
[`REVIEW.md`](test-results/tryon/2026-09-05/bikini-1-outfit-x-5-full-body-ai-20260905054341/REVIEW.md).

**❌ Không fine-tune, và nói rõ vì sao**

| Thành phần | Trạng thái thật |
|---|---|
| FASHN VTON 1.5 | Repo cục bộ chỉ có mã inference — **không khả thi** để fine-tune |
| Motion (Wan2.1 / One-to-All) | **Tối ưu suy luận**, không có checkpoint mới |
| Chatbot, wellness coaching | Không có checkpoint; grounding và safety rules chạy cục bộ |
| Gợi ý, phân tích | Implementation JS chạy online, không phải checkpoint pretrained |

> [!WARNING]
> VITON-HD (`CC-BY-NC-SA-4.0`) và BodyM (`CC-BY-NC-4.0`) đều **phi thương mại**.
> Mọi checkpoint và hằng số hiệu chuẩn phái sinh thừa hưởng ràng buộc đó — phù
> hợp nghiên cứu và đồ án, không phải asset thương mại. Phần suy từ ANSUR II
> (`CC0-1.0`) thì không bị ràng buộc.

Khảo sát dữ liệu ngày 01/09/2026 được khóa trong
[`tryon_sources.manifest.json`](backend/ai_training/provenance/tryon_sources.manifest.json)
và kiểm tra bằng `python3 backend/ai_training/audit_tryon_sources.py`. Kết luận:

- VITON-HD 5,2 GB đã có đủ 11.647 cặp train / 2.032 cặp test, nhưng chỉ phù hợp
  nghiên cứu upper-body trong studio.
- StreetTryOn là ứng viên tốt nhất để đo ảnh ngoài đời, nhưng cần quyền truy cập
  DeepFashion2 chính thức và vẫn cấm thương mại.
- Dress Code đủ tops/bottoms/dresses nhưng cần biểu mẫu có chữ ký và email tổ chức.
- FIT-VTO 100K có nhãn số đo/fit tốt, nhưng giấy phép `CC-BY-NC-ND-4.0`; chưa có
  chấp thuận bằng văn bản thì không dùng nó để sinh adapter phái sinh.
- Không tải lại mirror Kaggle hoặc train thêm trên cùng 116 target tổng hợp chỉ
  để tăng số bước: việc đó không bổ sung pose, danh mục hay ground truth thật.

### Đo cơ thể từ ảnh

Bộ hồi quy được **train lại** trên ANSUR II với đặc trưng giống điều kiện ảnh
thật, thay vì đặc trưng đo bằng thước. Đánh đổi có chủ đích: kém hơn ở phòng thí
nghiệm, **tốt hơn khoảng 4 lần** ở điều kiện chạy thật.

Sai số end-to-end ảnh → số đo, đo trên **BodyM testB, 400 người**:

| Đại lượng | Trước | Sau | Bias trước → sau |
|---|---:|---:|---|
| Chiều cao | 20,01 cm | **6,44 cm** | +16,57 → **−1,94** |
| Cân nặng | 15,99 kg | **9,00 kg** | +0,74 → −2,1 |
| Vòng ngực | 12,91 cm | **6,11 cm** | −2,17 → −1,0 |
| Vòng eo | 9,96 cm | **6,50 cm** | +5,26 → −1,5 |
| Vòng hông | 12,24 cm | **5,57 cm** | +6,19 → −1,3 |

Độ trễ `/api/stylist/body-analysis` đo lại ngày 30/09/2026 trên bốn
profile thân rộng là **1,17–1,29 s/request**. Model được giữ thường trú
trong một worker thay vì nạp lại mỗi request. Con số 0,35 s cũ là
benchmark trên pipeline/dữ liệu khác và không còn được dùng làm cam kết runtime.

FASHN được giữ ấm tối đa 180 giây khi chuyển nhanh giữa Thử đồ,
Home và Duyệt sản phẩm. Đo trên stack local: lượt cold-start đầu tiên
7,515 s; chuỗi `tryon → browse → tryon` sau đó là 10 ms và 9 ms.
Chuyển sang Chat/Motion vẫn nhả FASHN ngay để dành VRAM.

Đầu ra luôn là **khoảng 10 đơn vị kèm độ tin cậy**, và pipeline có một cổng tỉnh
táo chạy trên chính đầu ra: số nào bất khả thi về giải phẫu thì bị bỏ kèm lý do,
thay vì trả một con số sai với vẻ tự tin.

### Gợi ý và phân tích

Toàn bộ chạy **thuần Node trên CPU**, không cần GPU:

| Thành phần | Implementation |
|---|---|
| Selective SSM | State 12 chiều, gate theo event, tối đa 64 hành vi/user — *Mamba-inspired* |
| Graph propagation | Hai lớp trên quan hệ user–item — *LightGCN-style* |
| Next-item | Phân phối Markov bậc một theo session, gap tối đa 72 giờ |
| Ranker cuối | Pairwise logistic SGD, đánh giá chronological leave-last-positive-out |
| Adaptive MoE | Đổi trọng số expert theo độ dài lịch sử |
| Retrieval | Matrix factorization, item-CF cosine, content tag/price/style, market basket |
| Bot memory | Ma trận outer-product tối đa 12 lượt — *mLSTM-style* |
| Dự báo doanh thu | OLS + Holt double exponential + WMA, blend theo inverse MAE |
| Phân khúc & churn | K-Means `k ≤ 3` chuẩn hoá z-score; RFM heuristic minh bạch |

> [!NOTE]
> Không có họ model nào mặc nhiên "mạnh hơn Transformer" cho mọi bài toán. Các
> khối trên là implementation nhỏ *inspired/style*, **không phải** checkpoint
> Mamba, LightGCN hay xLSTM chính thức. Offline ranking evaluation chưa triển
> khai: `NDCG@10` và `Recall@10` được báo `not-measured`, không có accuracy giả.

Feedback âm cũng được học: bỏ giỏ và bỏ yêu thích lưu thành tín hiệu âm, và
impression do chính bot hiển thị **không** được tính là sở thích dương — giảm
vòng lặp tự khen.

## Hoạt động thế nào

### Luồng thử đồ

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant API as Backend
    participant B as Body worker
    participant G as GPU arbiter
    participant V as FASHN + FLUX.2

    U->>API: ảnh + sản phẩm + size + đồng ý dùng ảnh
    API->>API: kiểm tra đồng ý và độ tuổi nếu là đồ 18+
    API->>B: phân tích bằng chứng (CPU, ~0,35 s)
    B-->>API: khoảng số đo + độ tin cậy, hoặc “chưa đủ bằng chứng”
    Note over API: thiếu số đo KHÔNG chặn thử đồ
    API->>G: xin lượt GPU
    G->>V: nạp model, chạy try-on
    V-->>API: ảnh thử đồ
    API->>API: quality gate — danh tính, cấu trúc, độ che phủ
    alt đạt
        API-->>U: ảnh thật, kèm cảnh báo nếu có
    else không đạt
        API-->>U: giữ ảnh sạch và nói rõ lý do
    end
```

App hiện dùng profile preview `fast` (16 bước, cạnh dài 1280) và khởi động làm
nóng GPU song song với bước phân tích cơ thể trên CPU. Smoke API thật cho một
món đồ, model đã sẵn sàng và không dùng cache hoàn tất trong **22,835 giây** trên
RTX 5060 Ti 16 GB. Ma trận sáu loại trang phục ở profile này đạt 6/6, trong
**22–41,6 giây**, trung bình **28,37 giây**. Trang phục nhiều lớp, dáng khó hoặc
hiệu ứng chật/rộng mạnh vẫn có thể lâu hơn. Bikini hai mảnh qua FLUX.2 đa tham
chiếu từng đo **58,1 giây** khi cache 18+ đã ấm và khoảng **73 giây** khi cache
nguội. Video chuyển động: walk khoảng **58 giây** trực tiếp / **65 giây** qua
backend, turn khoảng **71 giây**, pose khoảng **66 giây**.

Coverage gate coi cổ áo rộng/chữ V, bóng da và vải màu da là tín hiệu cần cảnh
báo thay vì tự động huỷ một ảnh bình thường. Ảnh lộ gần như toàn bộ lõi vùng
nhạy cảm vẫn bị chặn; đồng ý sử dụng ảnh và kiểm tra người trưởng thành cho đồ
18+ vẫn được giữ nguyên.

### Luồng "Đưa tôi đến đây"

Chọn địa điểm → sản phẩm phù hợp hiện ngay bên dưới → thử đồ → ghép kết quả vào
ảnh thật của địa điểm.

Storefront và app dùng cùng hợp đồng backend: mỗi scene trả 4 dáng AI, một dáng
đề xuất theo loại địa điểm và danh sách vị trí đứng đã duyệt. Client gửi
`travelPoseId` vào `/api/tryon` và `slotId` vào `/api/japan-spots/scene-photo`.
Backend kiểm tra footprint thật của chân/vạt áo sau resize; một điểm tiếp xúc
nằm ngoài `groundPolygon` là từ chối ảnh thay vì đặt người trên nước/không trung.
Hiện 36/36 scene của đủ 35/35 địa điểm hiển thị qua validator, với 38 vị trí
đứng đã duyệt. Ma trận dùng ảnh thử đồ thật đạt 38/38 lượt `groundSafe:true`;
ma trận payload cũ đi đúng đường Tailscale của OPPO đạt 35/35 HTTP 200. Scene
chưa curate vẫn bị chặn fail-closed, nhưng không còn địa điểm nào trong app rơi
vào nhánh đó. Arashiyama, Itsukushima và Ginzan là các regression 422 đã được
khóa bằng test phủ toàn bộ catalog.

Gợi ý sản phẩm chấm điểm bằng quy tắc trên metadata thật của catalog — phong
cách, mùa, màu, loại đồ, size còn hàng — **không gọi LLM**, đo được **8 ms** khi
tính mới và **25 ms** khi trúng cache. Đền chùa không bao giờ gợi ý đồ bơi; địa
điểm biển chỉ gợi ý khi lượt đó đã qua cổng 18+.

Việc ghép dùng segmentation chứ **không dùng model sinh ảnh**, nên khuôn mặt và
cơ thể sống sót nguyên vẹn từng pixel — **912 ms** cho ảnh dựng sẵn và
**1 195 ms** cho ảnh vừa thử đồ xong. Nếu bước ghép cảnh lỗi, ảnh thử đồ vẫn
được giữ để thử lại riêng bước đó.

Mỗi ảnh nền có metadata riêng và khung ảnh được cắt **bám theo điểm đặt chân**,
không cắt giữa. Một ảnh đẹp, license rõ, độ phân giải cao vẫn có thể bị loại nếu
người không thể đứng được trong đó — ảnh Naoshima cũ chụp từ ngoài biển từng làm
model đứng giữa mặt nước, và đó là lý do lớp metadata này tồn tại.

A/B cùng người, Yukata và dáng nghiêng 3/4 ngày 01/09/2026: `balanced` 20 bước
54,83 giây và `high` 25 bước 54,57 giây, cả hai qua coverage gate và không có
quality warning. Hai ảnh gần như tương đương (`SSIM 0,992`, sai khác trung bình
0,74/255); tăng step không được coi là cải thiện độ chân thật khi chưa có khác
biệt nhìn thấy. App vì vậy dùng profile `fast` đã được đo riêng; Storefront có
thể chọn profile theo ngữ cảnh hiển thị.

Sau một lượt cần FLUX để mô phỏng chật/rộng, backend trả ảnh ngay khi quality
gate hoàn tất rồi mới làm nóng lại FASHN ở nền. Việc nạp model cho lượt kế tiếp
không còn nằm trong thời gian chờ của request hiện tại; số bước, ảnh đầu ra và
các cổng chất lượng không thay đổi.

Đo trực tiếp trên Redmi Note 8 Pro ngày 03/09/2026: ca cũ lệch fit nhẹ
`severity=0,39` đã mất 65,544 giây ở backend và 117–161 giây trên UI vì chờ phân
tích cơ thể rồi chạy thêm một lượt FLUX. Chế độ `fast` hiện chờ phân tích tối đa
4,5 giây và luôn dùng một lượt VTON; chỉ chạy fit-effect khi client yêu cầu rõ
`fitEffect: true`. Lượt thật mới nhất từ ảnh thư viện đạt HTTP 200 trong 23,576
giây; FASHN và quality/safety gate vẫn chạy. Một phép đo trước đó đạt 19,918
giây. Android ghi nhận app chuyển qua Home, Cài đặt và Camera trong lúc request
chạy mà không có `GPU_JOB_CANCELLED`.

Warm-up tối 04/09/2026 chạy đúng 70 request thật (5 preset × 14 trang phục,
`fast`, size M): 67 ảnh vượt quality gate, 3 ảnh bị từ chối vì thay đổi/che mặt,
0 cache hit và 0 job bị huỷ. Thời gian trung bình 21,56 giây/request, khoảng
19,86–37,76 giây; GPU đạt đỉnh 100% ở cả 70 lượt và VRAM cao nhất 4.962 MiB.
Sau khi trả ảnh cuối, hàng đợi rỗng và GPU trở về 0%; model FASHN vẫn warm cho
lượt kế tiếp, còn arbiter sẽ nhả nó khi chuyển sang Motion. Đây là kiểm tra
runtime có ảnh trả về, chưa phải đánh giá trực quan chất lượng toàn bộ 67 ảnh.

Ma trận Khám phá Nhật Bản tối 04/09/2026 chạy 10 địa điểm × 5 preset theo đúng
mặc định app (giữ pose, sản phẩm/size gợi ý đầu tiên, scene/slot đầu tiên):
48/50 ảnh 1024×1536 ghép thành công và đều `groundSafe:true`; hai lượt Otaru bị
coverage gate chặn trước khi ghép. Có 22 inference mới (trung bình 21,76 giây)
và 28 cache hit khi nhiều địa điểm dùng cùng outfit; bước ghép cảnh trung bình
0,46 giây. Visual review xác nhận hình thể năm preset được giữ nhưng còn ba gap:
người mẫu đi chân trần/ánh sáng chưa hòa nền, áo happi `khoac-nhat` mất cấu trúc
mở vạt, và hồ sơ 155 cm/115 kg bị recommender rơi về S khi 4XL không có thay vì
chọn size khả dụng gần nhất XXL. Ba điểm này chưa được sửa trong lượt kiểm thử.

Ma trận ngày 05/09/2026 chạy 15 trang phục × 5 ảnh kiểm thử qua API thật ở
profile `fast`: 74/75 ảnh 960×1280 hợp lệ; một ca Sơ mi trắng với ảnh very-slim
bị fail-closed lặp lại ở lần retry, không trả overlay giả. P50 là 22,6 giây,
P95 40,3 giây và trung bình 28,0 giây. Bốn output pass sau đó được ghép với 10
scene: 40/40 request trả JPEG 1024×1536, `groundSafe:true`, trung bình 0,51
giây. Tuy nhiên visual review chỉ 10/40 ảnh cảnh đạt tự nhiên vì chỉ nguồn
Cardigan có toàn thân; ba nguồn còn lại đã cắt chân nên vẫn trông cụt/lơ lửng
dù validator hình học đạt. Kết quả này xác nhận scene cần thêm cổng kiểm tra độ
phủ chân, không được coi HTTP 200 hoặc `groundSafe` là đủ cho chất lượng nhìn.

Motion local cũng đã được kiểm tra trực tiếp trên Redmi: worker One-to-All sẵn
sàng, request hoàn tất trong 70,186 giây và hai khung hình cách nhau hai giây
khác nhau, xác nhận video thật sự phát. Đây vẫn là profile chất lượng, chưa phải
luồng nhanh như ảnh thử đồ.

### Luồng mua hàng

Storefront yêu cầu đăng nhập trước khi thêm giỏ hoặc yêu thích; giỏ thuộc tài
khoản và đồng bộ với app qua backend. Ở bước đặt hàng, toàn bộ giá, mã ưu đãi,
tồn kho và tổng tiền được tính lại từ dữ liệu server. Đơn COD
xác nhận ngay; Stripe và VNPay chỉ báo thành công **sau** callback thật từ cổng
thanh toán.

Mỗi đơn đã nhận hàng tạo một lượt đánh giá cho từng sản phẩm. Khách mua lại sản
phẩm trong một đơn khác đã hoàn tất sẽ được đánh giá tiếp; cùng một sản phẩm
trong cùng một đơn chỉ gửi được một đánh giá.

### Loyalty

Chi tiêu hợp lệ đạt `5.000.000₫`/tháng mở VIP 30 ngày, giảm 10% cho một đơn vị
sản phẩm tự chọn mỗi đơn. Mỗi đơn từ `5.000.000₫` nhận một Flagcard; đủ 7 thẻ đổi
được voucher cá nhân giảm 50%, dùng một lần, hiệu lực 90 ngày.

### Mục tiêu mua sắm và lộ trình sức khoẻ

**Quỹ mục tiêu là sổ theo dõi, không phải ví.** JAPANO không giữ tiền và không
xác minh số dư của bạn. Ghi nhận đủ 100% chỉ đánh dấu cột mốc tiến độ — **không
phát mã giảm giá**. Mục tiêu chỉ được coi là hoàn thành trọn vẹn khi bạn thực
sự mua được đúng sản phẩm đó bằng một đơn thành công.

Mã ưu đãi mục tiêu đã cấp trước đây vẫn dùng được, nhưng **chỉ giảm đúng sản
phẩm mục tiêu, tối đa một sản phẩm** — không giảm các món khác trong giỏ.

**Lộ trình sức khoẻ** yêu cầu 4 câu sàng lọc an toàn (mang thai/hậu sản, bệnh
nền hoặc thuốc ảnh hưởng cân nặng, tiền sử rối loạn ăn uống, đang được điều
trị). Bất kỳ câu nào là "Có" hoặc "Không muốn nói" — hoặc chưa trả lời đủ — thì
hệ thống chỉ đưa hướng dẫn chung, không tạo tốc độ giảm cân hay mốc thời gian.
Mọi số đo là **do bạn tự khai, không phải xác minh y tế**; hệ thống chỉ lưu kết
luận tổng hợp, không lưu chi tiết bệnh lý. Mục tiêu sức khoẻ không có quỹ,
không có voucher và không lưu dữ liệu thu nhập/tiết kiệm.

### Vòng đời voucher

Voucher **không bị trừ lượt ngay khi đặt hàng**. Vòng đời:

| Trạng thái | Khi nào | `voucher.used` |
|---|---|---|
| `reserved` | vừa tạo đơn | chưa tăng |
| `consumed` | tiền đã thực sự về (COD nhận hàng, hoặc callback Stripe/VNPay báo `paid`) | +1, đúng một lần |
| `released` | huỷ đơn, thanh toán thất bại/hết hạn | giữ nguyên, mã dùng lại được |

Thanh toán thất bại hay huỷ đơn **không làm bạn mất lượt dùng mã**. Trả lại
toàn bộ đơn đã thanh toán thì mã được **cấp lại** dưới dạng một mã thay thế
(hạn ít nhất 30 ngày) — nhưng chỉ sau khi tiền đã hoàn thành công. Trả một phần
thì không cấp lại, và số hoàn chỉ tính trên đúng phần bạn thực trả.

Rà soát sổ đổi mã (mặc định **chỉ đọc**, không ghi gì):

```bash
node backend/scripts/auditVoucherRedemptions.js            # dry-run
node backend/scripts/auditVoucherRedemptions.js --apply    # chỉ chạy khi đã xem báo cáo
```

## Bắt đầu nhanh

**Yêu cầu:** Node.js ≥ 20 · JDK 17 nếu build Android · Python riêng cho từng
repo model AI · GPU NVIDIA ~16 GB VRAM nếu muốn chạy thử đồ và motion.

```bash
# 1. Backend + mobile (npm workspaces)
npm ci
cp .env.example .env.server        # điền MONGODB_URI, JWT_SECRET, Cloudinary…

# 2. Backend + Web Admin
npm run backend                    # API :4100 · Admin tại /admin/

# 3. Ứng dụng di động
adb reverse tcp:4100 tcp:4100
npm --workspace mobile run android

# 4. Website (cây dependency riêng — KHÔNG cài từ thư mục gốc)
npm --prefix web install
npm --prefix web run dev           # http://localhost:4200
```

### MongoDB Compass dùng khi thuyết trình

Backend và ứng dụng **luôn dùng MongoDB Atlas** theo `MONGODB_URI` trong
`.env.server`. MongoDB cục bộ chỉ là bản trình bày đã che dữ liệu nhạy cảm, có
đúng **19 collection trùng với 19 bảng trên `JAPANO_ERD.drawio`**.

```bash
docker start japano-mongodb-compass
node scripts/sync_compass_presentation_erd19.js          # dry-run, không ghi
node scripts/sync_compass_presentation_erd19.js --apply  # chỉ tạo khi DB đích còn trống
```

Trong MongoDB Compass, kết nối `mongodb://127.0.0.1:27017` và mở database
`japano_presentation_19`. Không đổi `MONGODB_URI` của backend sang địa chỉ này.
Tập lệnh từ chối đích không phải localhost, từ chối ghi đè database đã có dữ
liệu, và che email, số điện thoại, địa chỉ, mật khẩu băm, số đo cùng mã giao dịch.

Dịch vụ AI là tuỳ chọn và bật riêng:

```bash
./scripts/japano-services.sh on
ollama pull qwen2.5:7b && ollama pull qwen3-vl:8b   # tuỳ chọn
```

Build APK release cần JDK 17 — JDK 21 trên máy phát triển thiếu `jlink` và Gradle
sẽ dừng ở `androidJdkImage`:

```bash
cd mobile/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease
```

### Public API và APK Android

Bản Android công khai hiện dùng API HTTPS qua Tailscale Funnel:

- API/Admin: <https://admin123-system-product-name.tailfeea7a.ts.net/>
- Admin UI: <https://admin123-system-product-name.tailfeea7a.ts.net/admin/>
- APK: xem GitHub Releases của repo; workflow
  `.github/workflows/android-release.yml` tự build APK đã ký khi push tag `v*`.

Máy host phải giữ `tailscaled` và user stack hoạt động. Cài unit user từ repo:

```bash
install -Dm644 deploy/systemd-user/japano-stack.service \
  ~/.config/systemd/user/japano-stack.service
systemctl --user daemon-reload
systemctl --user enable --now japano-stack.service
sudo loginctl enable-linger "$USER"   # một lần, để chạy sau reboot khi chưa đăng nhập
tailscale funnel --bg --yes 4100
```

Khóa ký production không nằm trong Git. Máy phát hành giữ bản sao ngoại tuyến;
GitHub Actions đọc bốn secret `JAPANO_ANDROID_*`. Không đổi hoặc làm mất khóa
này, nếu không Android sẽ từ chối cài bản cập nhật lên trên APK 1.0.20.

DrayTek Smart VPN Client không phải điều kiện để người dùng tải APK. Để chuyển
stack sang Proxmox/datacenter, yêu cầu quản trị viên cấp profile OpenVPN hoặc
WireGuard (server, port, route, CA/certificate), hoặc cài Tailscale trực tiếp
trên VM. Chỉ email/mật khẩu portal không xác định được giao thức và route VPN.

Toàn bộ biến môi trường tham khảo nằm trong [`.env.example`](.env.example).

## Kiểm thử

```bash
npm run check                      # backend tests + mobile typecheck + python tests
npm --workspace backend test       # 434 test (2026-09-04)
npm --workspace mobile run typecheck
python3 -m unittest discover -s backend/test/python -v

npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run e2e           # 2 project thiết bị: 390 px và 1440 px
```

Bộ e2e của website fail nếu có console error, ảnh vỡ, tràn ngang, hoặc bất kỳ
nút nào nhỏ hơn 44×44 — trên cả 360 px và 390 px. Smoke AI thật chạy riêng
(`JAPANO_E2E_REAL_AI=1`) và **bắt buộc nhận được ảnh/video mở được**; HTTP 200
không được tính là đạt.

Bằng chứng đo đạc theo ngày nằm trong
[`docs/project_evidence/`](docs/project_evidence): phần cứng, tham số, thời gian,
cổng chất lượng và cả những phương án đã bị loại.

## Giới hạn đã biết

- **Đây là demo/nghiên cứu, chưa phải sản phẩm thương mại.**
- **Một ảnh không có vật chuẩn không thể cho số đo tuyệt đối chính xác.** Sai số
  end-to-end ở trên là sai số thật — hãy đọc nó như một khoảng, đúng như cách API
  trả về.
- **Checkpoint fit-refine phi thương mại.** VITON-HD và BodyM ràng buộc
  non-commercial; phù hợp nghiên cứu và đồ án.
- **LoRA fit chỉ phủ `tops`** và mặc định tắt. Danh mục khác dùng pipeline gốc và
  quality gate.
- **Motion là CUDA-only**, không có đường lùi CPU.
- **Offline ranking evaluation chưa triển khai** — `NDCG@10`/`Recall@10` báo
  `not-measured`.
- **Thanh toán đang ở chế độ test** (Stripe Test Mode, VNPay Sandbox).
- **Website chưa deploy công khai.** Build và `wrangler deploy --dry-run` chạy
  được, nhưng backend hiện chỉ truy cập được trong mạng nội bộ Tailscale.
- **Google Sign-In trên web chưa từng đăng nhập thật** — thiếu client ID cho web;
  cấu hình chạy được không phải bằng chứng đăng nhập thành công.
- **Full E2E của website trên workerd còn cảnh báo hydration** ở một vài trang
  client sau điều hướng; đang được theo dõi.
- Repo không có một `requirements.txt` chung cho toàn bộ AI stack — FASHN,
  FLUX.2 và One-to-All phải được chuẩn bị trong environment gốc của chúng.

## Cấu trúc thư mục

```
japano/
├── mobile/              # Ứng dụng Expo · React Native
├── web/                 # Website storefront — dự án độc lập, React 19
├── backend/
│   ├── routes/          # REST API chia theo domain
│   ├── lib/             # Business rules, quality gate, GPU arbiter
│   ├── ai_training/     # Dataset, train, benchmark — tách khỏi mã chạy thật
│   └── *.py             # Worker AI: body analysis, try-on, motion, scene compose
├── admin/               # Web Admin, JavaScript thuần
├── docs/                # Kiến trúc, bằng chứng đo đạc, tài liệu kỹ thuật
└── scripts/             # Vận hành, đồng bộ dữ liệu, kiểm tra
```

---

<div align="center">

**Thiết kế tại Việt Nam · Cảm hứng Nhật Bản**

Đồ án tốt nghiệp. Dataset huấn luyện phi thương mại — xem
[Giới hạn đã biết](#giới-hạn-đã-biết) và
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) trước khi dùng lại.

</div>

### Benchmark 20 ca thử đồ trên PC — 05/09/2026

4 trang phục × 5 mẫu, fast/M, không profile/số đo: 19/20 trả ảnh 960×1280;
1 ca sơ mi bị quality gate chặn sau hai lần sinh nội bộ. Trung bình 37,61 giây/ca,
P50 37,435 giây, toàn batch 12 phút 35 giây; hai lượt đầu 65,99/81,39 giây.
Sơ mi giữ đặc điểm chính tốt hơn trong bộ mẫu này; Yukata/Haori vẫn sai phom,
cardigan có ca rút ngắn hoặc thay đổi cả quần. Đây là tỷ lệ trả ảnh, không phải
tỷ lệ đúng trang phục. Xem [review và gallery](test-results/tryon/2026-09-05/4-outfits-x-5-people-091037/REVIEW.md).

### Chạy Storefront trực tiếp trên PC

Khi backend đang chạy ở cổng 4100, dùng
`JAPANO_API_ORIGIN=http://127.0.0.1:4100 npm --prefix web run dev`
để Storefront gọi backend nội bộ. Mở <http://localhost:4200> và
Web Admin tại <http://localhost:4100/admin/>. Không cần Tailscale cho hai địa chỉ này.

### Ori: giới hạn thời gian chờ phản hồi

Ori dùng chung ngân sách chờ AI cho nhận diện ý định và diễn đạt câu trả lời:
`JAPANO_CHAT_BUDGET_MS=8000` mặc định (tối đa 12000 ms), bước nhận diện tối đa
3000 ms. Khi AI chậm/lỗi, Ori trả bản nháp đã truy hồi từ catalog; giới hạn
áp dụng cả khi đọc nội dung JSON. Lỗi xử lý trả thông báo để gửi lại, lỗi lưu
lịch sử không làm mất câu trả lời đã tạo. Web tự cuộn tới tin mới.
Kiểm chứng ngày 05/09: backend 441 test đạt; 6 câu trên web đăng nhập thật
trả trong 97–853 ms, kiểm tra phục hồi sau HTTP 503 đạt. Chưa xác nhận thao tác
chat trên Redmi trong lượt này vì thiết bị đang thử đồ.

### Ori: hỏi catalog và tồn kho trực tiếp

Các câu như `Shop có bao nhiêu sản phẩm?`, `Yukata xanh còn bao nhiêu?`,
`size M còn mấy cái?`, `còn màu Sumi không?` và `sản phẩm này hết hàng chưa?`
đi qua intent `inventory` deterministic. Ori đọc state hiện tại của backend
(MongoDB khi được cấu hình, `db.json` khi chạy fallback), chỉ tính sản phẩm đang
công khai và cộng tồn theo đúng biến thể màu–size. Sản phẩm hết hàng vẫn được
nhận diện để trả `0`; tên không có trong catalog được từ chối thay vì gợi ý một
món khác. LLM/adapter không được phép sinh tên, giá hoặc số lượng tồn kho.

Đây là **grounding/runtime retrieval**, không phải fine-tuning mới. Bộ hồi quy
backend ngày 04/10/2026 đạt 477/477 test, gồm tổng catalog, tổng tồn đã khai
báo, tồn theo size, hàng hết và sản phẩm không tồn tại.


## Chuyển toàn bộ AI đã train sang máy khác

Checkpoint, log, split, workbench và các model runtime lớn được phát hành ở
GitHub Release [`ai-runtime-2026-10-07`](https://github.com/minhnhatdepzai/JAPANO/releases/tag/ai-runtime-2026-10-07),
thay vì nhét hàng chục GB binary vào lịch sử Git. Release còn chứa nguyên trạng
ba virtualenv Python đã chạy trên Ubuntu 24.04 x86_64. Hai image đã build sẵn ở
GitHub Container Registry là `ghcr.io/minhnhatdepzai/japano-runtime:2026-10-07`
và `ghcr.io/minhnhatdepzai/japano-storefront:2026-10-07`.

Đường ngắn nhất trên máy mới là clone rồi chạy Docker:

```bash
git clone https://github.com/minhnhatdepzai/JAPANO.git
cd JAPANO
./scripts/docker-up.sh
```

Script tự tạo `.env.docker` với secret ngẫu nhiên, pull image, tải Release bằng
`curl`, kiểm toàn bộ `SHA256SUMS`, giải nén đúng vị trí rồi bật MongoDB, Ollama,
body analysis, FASHN, motion, chatbot adapter, backend và storefront. Không cần
cài Node/Python/npm/pip, không chạy train và không gọi downloader của Hugging
Face/Kaggle/Ollama. Lần đầu phải tải khoảng 66 GiB archive và cần đủ dung lượng
cho cả file nén lẫn dữ liệu đã giải nén.

Máy đích vẫn cần Linux x86_64, Docker Engine + Compose, NVIDIA driver và NVIDIA
Container Toolkit để Compose cấp GPU cho container. Secret dịch vụ thật
(Cloudinary, Stripe, email, Google...) có thể điền thêm trong `.env.docker`;
credential, signing key và dữ liệu khách hàng không được phát hành.

Nếu không dùng Docker, có thể khôi phục thủ công:

```bash
./scripts/restore-ai-release.sh
./run-all.sh --no-phone
```

Script tải tất cả part từ đúng release, kiểm `SHA256SUMS`, ghép và giải nén vào
`backend/ai_training/`, `~/jp/ai`, Hugging Face cache, Ollama và
`~/.japano-runtime/venvs`. Luồng thủ công vẫn cần dependency hệ thống phù hợp;
luồng Docker ở trên là lựa chọn để không phải cài lại dependency ứng dụng.

Release giữ nguyên trạng thái bằng chứng: LoRA/VeRA chatbot, các checkpoint ảnh
và body-regression đã train được phân phối cùng log/hash; fit LoRA FLUX chỉ có
status/evidence trong checkout hiện tại vì file checkpoint gốc không còn trên
máy này, nên không được mô tả là artifact có thể khôi phục.

## LoRA, VeRA và LangGraph — cập nhật 28/09/2026

Xem [README huấn luyện và kịch bản thuyết trình](docs/README_AI_TRAINING.md)
và [bảng bằng chứng có thể in PDF](docs/ai-evidence-20260928/presentation.html).
Đã train thật LoRA + VeRA cho phân loại ý định Qwen3-4B và ResNet18 cho ảnh
sản phẩm, có checkpoint, SHA-256, nạp lại và tập kiểm tra riêng. LangGraph
điều phối chatbot; giá/tồn kho vẫn lấy từ database live. Không gọi LangGraph
là mô hình được fine-tune, không gọi bộ phân loại ảnh là bộ sinh ảnh thử đồ.

Chạy demo trên máy đã có model: `./scripts/start-ai-demo.sh`. Website
`http://localhost:4200`, Admin `http://localhost:4100/admin/`. Phải đọc
readiness của từng model; tiến trình đang chạy không đồng nghĩa model đầy đủ.

Ảnh khách tải lên để thử bikini còn cần **Ollama + `qwen3-vl:8b`** cho cổng
kiểm tra ảnh 18+. Chạy `ollama pull qwen3-vl:8b` nếu thiếu model, rồi
`./scripts/check-ai-ready.sh` và `./scripts/demo-preflight.sh`. Kiểm tra model
có trên đĩa chưa thay thế việc chạy một ảnh thật. Preset người lớn đã duyệt
có thể thành công ngay cả khi đường tải ảnh của khách bị lỗi
`AGE_VERIFICATION_UNAVAILABLE`; cần kiểm thử riêng cả hai đường.

Kiểm chứng 28/09 trên **Redmi Note 8 Pro**: ảnh khách tải lên + bikini hoa anh
đào cỡ S đã tạo thành công và hiển thị trên điện thoại; API tạo ảnh mất 40,9 giây
sau bước kiểm tra ảnh khoảng 19 giây. Đây là một ca đã kiểm chứng, không bảo đảm
mọi ảnh đều thành công. Ảnh đó bị cắt bàn chân nên bộ số đo vẫn trả thiếu bằng
chứng; tạo được bikini không chứng minh dự đoán số đo đã chính xác.

Trong màn thử đồ, nhập số đo rồi bấm **Phân tích lại** để gửi thông tin bổ sung
lên server. Khi chọn ảnh mới, app không tự áp số đo của ảnh trước. Số người dùng
nhập được ghi nguồn riêng, không tính là AI dự đoán đúng. Luồng API đã kiểm tra;
kiểm tra giao diện mới trên Redmi đang chờ đăng nhập lại.

Sửa lỗi đầu bị thay đổi khi thử đồ với ảnh khoanh tay: giữ nguyên tư thế và đi
trực tiếp qua FASHN, không ép dựng lại toàn thân chỉ vì tay che áo. Đã chạy lại
ảnh khách với Happi Matsuri trong 32,79 giây và kiểm tra ảnh đầu ra. Ảnh cũ cần
tạo lại. Áo sơ mi, bikini và chuyển động đều đã có kết quả thật; chi tiết và
giới hạn trong README huấn luyện.

Lời thoại trình bày chi tiết: [LangGraph, LoRA/VeRA, vector và AI ảnh](docs/LOI_THOAI_THUYET_TRINH_AI.md). Cập nhật: video đã tạo được MP4 thật 49 frame/12 fps trong 57,13 giây qua API; xem giới hạn trong README huấn luyện. Phân tích ảnh đơn hiện trả thiếu bằng chứng cho số đo chưa được kiểm chứng, giữ số đo nhập tay (đã thử 160 cm/150 kg), không tự dùng mẫu vóc dáng làm số đo thật.

Theo yêu cầu khôi phục dự đoán ảnh: ảnh toàn thân đủ rõ có thể nhận khoảng ước lượng tham khảo; không coi đó là số đo thật. Xem trạng thái thiếu mô hình hiệu chuẩn và giới hạn ở [README AI](docs/README_AI_TRAINING.md).

Cập nhật tiếp: đã train lại hồi quy ANSUR II và nạp các checkpoint cân nặng/BMI/vòng đo còn thiếu. 5/6 ảnh preset trả được gợi ý theo khoảng; mẫu ngoại cỡ vẫn thiếu bằng chứng. MAE trên bảng số đo không phải độ chính xác từ ảnh; [báo cáo và giới hạn](docs/README_AI_TRAINING.md).

Cập nhật 29/09: bộ đo ảnh nhận thêm tín hiệu đùi trên để tránh ép người thân
rộng về vóc dáng trung bình. Trên 10 ảnh hồ sơ tổng hợp, các mẫu rộng `03/06/07/10`
được xếp lần lượt khoảng 100,3/79,4/111,8/84,2 kg; sáu ảnh còn lại không bị
tăng theo quy tắc này. Đây là kiểm tra thứ tự hình học trên ảnh không nhãn,
không phải benchmark độ chính xác. `mau-07` đã được phân tích lại trực tiếp trên
Redmi và hiển thị nhóm 107–117 kg. Chat LangGraph trả đúng giá bikini từ catalog
live; một lượt bikini FLUX.2 mới, không cache, đạt trong 51,34 giây và ảnh ghép
Naoshima đạt `groundSafe=true` trong 1,29 giây. Chi tiết, giới hạn và số vòng đo
ở [README AI](docs/README_AI_TRAINING.md).

Ngay trên Redmi, kết quả bikini của mẫu `mau-07` đã tạo tiếp clip đi bộ local
trong 57,33 giây: 49 frame/12 fps/384×512, quality gate đạt và video hiển thị
trong app. Đây là một ca thiết bị được quan sát trực tiếp, không phải bảo đảm
100% cho mọi ảnh.

Cập nhật 30/09: app dùng đúng cùng byte ảnh đã chọn cho preview, phân tích và
thử đồ; Phân tích lại không còn gửi profile cũ. `mau-10` trên Redmi hiển thị
156-166 cm, 79-89 kg, ngực/eo/hông 97-107/95-105/114-124 cm, kèm khoảng bất
định rộng hơn và cảnh báo đây không phải số đo thật. Sơ mi trắng size S tạo
thành công, được đánh dấu **Rất chật**, khuyên XXL và chỉ mô phỏng bục đường may
nhỏ ở vai/cánh tay ngoài. Đồ bơi/bikini không áp dụng hiệu ứng bục. Từ chính ảnh
kết quả, worker CUDA tạo và app phát MP4 H.264 384×640, 10 fps, 3,3 giây; GPU
đạt 100% khi render. Đây là kiểm chứng một ảnh tổng hợp không có ground truth,
không phải fine-tuning hoặc cam kết độ chính xác cho mọi ảnh.

Thẻ phân tích hiện xác nhận rõ khi ảnh mới đã được xử lý. Với ảnh đã có kết quả,
**Kiểm tra lại** chỉ xác nhận đúng ảnh/thời gian và không tải trùng cùng ảnh qua
ADB; đổi ảnh mới luôn chạy worker thật. Timeout kết nối của bước này là 20 giây,
không còn spinner chờ ba phút khi upload bị đứt.

Kiểm chứng ngày 01/10 với hai ảnh Messenger thật trên Redmi: ảnh đứng toàn thân
váy trắng trả các nhóm **157–167 cm, 43–53 kg, 74–84/60–70/80–90 cm** trong
giao diện. Ảnh ngồi bị cắt dưới đầu gối dùng fallback ConvNeXt crop và prior
ANSUR II, trả **156–166 cm, 52–62 kg, 82–92/71–81/90–100 cm** với confidence
thấp, khoảng bất định rộng và `usableForSizing=false`. Bước phân tích vóc dáng cũng không còn chờ model
kiểm tra 18+ của sản phẩm đang mở; cổng 18+ vẫn bắt buộc ở request tạo ảnh thử
đồ. Bằng chứng: `test-results/live-debug/real-fullbody-selected-final.png`.

Ảnh ngồi sàn có thể bị JPEG của Android nén lại làm confidence mắt cá vượt
ngưỡng và bị hiểu nhầm là ảnh đứng đủ người. Pipeline hiện kiểm tra thêm hướng
hông→gối: khi hai đùi gần nằm ngang, ảnh vẫn đi qua checkpoint ảnh ngồi/cắt
khung dù detector thấy cả hai mắt cá. Trên đúng ảnh Redmi, bản gốc và bản JPEG
quality 82 đều trả cùng nhóm **149–159 cm, 42–52 kg,
78–88/66–76/82–92 cm**, `measurementStatus=partial` và
`usableForSizing=false`. Đây là gợi ý thống kê độ tin cậy rất thấp.

Luồng tạo ảnh cũng không còn chờ vô hạn nếu `AsyncStorage` của MIUI treo khi
lưu hồ sơ: app ghi hồ sơ ở nền và gửi request GPU ngay bằng state đang hiển thị.
Trước mỗi lượt thử đồ, client dò `/api/health` với timeout 2,5 giây cho từng
địa chỉ; chỉ địa chỉ đã phản hồi mới nhận POST inference dài. Vì vậy IP Wi-Fi
cũ không còn giữ spinner 720 giây trước khi app thử ADB reverse/Tailscale.
Timeout mặc định của một lượt tạo ảnh được hạ còn 180 giây; lỗi mạng sẽ hiện để
thử lại thay vì quay quá 10 phút. Lượt
Redmi với chính ảnh ngồi và Yukata đã qua bước này, `POST /api/tryon` trả 200
sau 47,571 giây. Một lượt kiểm chứng độc lập trên đúng JPEG quality 82 trả 200
sau 55,35 giây với engine
`flux2-klein-4b-pose+fashn-vton-1.5+fast-16steps+adaptive-low-memory`; ảnh giữ
cổ chéo, obi, tay rộng và vạt Yukata dài. Artifact kiểm thử nằm tại
`test-results/live-debug/seated-current/seated-yukata-direct.jpg`. Backend
không lưu ảnh khách trong cache runtime; artifact này chỉ được ghi chủ động cho
lượt kiểm thử cục bộ.

Với bikini, tín hiệu focus trùng nhau từ AppState/điều hướng được gộp lại thay
vì xếp nối tiếp nhiều lượt nhả/nạp model. Ca kiểm chứng trực tiếp trên ảnh Redmi
ngày 01/10 qua cổng 18+ trong khoảng 10 giây, FLUX sinh bikini hai mảnh trong
khoảng 29 giây và toàn API trả 200 sau **47,564 giây**. Ảnh kết quả đã hiện trên
điện thoại; xem `test-results/live-debug/bikini-focus-fix/result-visible.png`.

Khi đổi ảnh giữa lúc đang tạo, app cấp phiên riêng cho từng lượt và gọi
`/api/tryon/cancel` theo `clientId`. Callback timeout/kết quả của ảnh cũ không
được ghi đè ảnh mới; backend cũng hủy job cùng thiết bị khi socket bị ngắt. Ảnh
từ Android dùng trực tiếp JPEG quality 82 của ImagePicker cho cả preview, phân
tích và upload, thay vì đọc lại file gốc lớn. Trong ca đo ngày 01/10, payload
giảm từ khoảng **879 KB** qua ADB Wi-Fi bị đứt sau 102 giây xuống **114 KB** qua
LAN và request hoàn tất HTTP 200 trong 43,499 giây.

Quality gate của bikini tách khỏi luật trang phục kín: thay váy dài bằng bikini
có thể hợp lệ khi bụng/chân thay đổi. Lý do `body_changed_not_garment` vì thế là
cảnh báo mềm chỉ với swimwear; đổi mặt, mất nhân vật, bikini không xuất hiện và
ảnh mờ vẫn là lỗi cứng. Ảnh cuối vẫn bắt buộc qua coverage gate cho ngực, vùng
chậu và mông. Ca ảnh thật tiếp theo trả HTTP 200 trong 45,974 giây sau thay đổi.

### Một lệnh chạy toàn bộ AI và điện thoại

```bash
cd /home/admin123/Documents/JAPANO
./run-all.sh
```

Dùng `./run-all.sh --no-phone` cho web/AI; thêm `--device SERIAL` khi có nhiều
điện thoại ADB. Lệnh kiểm tra mô hình, cảnh Nhật Bản, database và đường HTTP tới
điện thoại, tự mở scrcpy nếu đã cài và không xóa dữ liệu. Nếu cổng ADB Wi-Fi
thay đổi, launcher tự theo thiết bị đã ghép đôi duy nhất. Với ADB không dây,
launcher tự tìm IP LAN của máy tính và ghi riêng `debug_http_host` để điện thoại
tải bundle Metro trực tiếp qua Wi-Fi. API cũng dùng địa chỉ LAN đó làm đường
chính; tunnel 4100 chỉ là dự phòng. Endpoint cấu hình luôn được thử trước nên
một lần backend restart không thể ghim cả phiên vào tunnel ADB chậm. Cách này
tránh bundle hoặc ảnh base64 bị treo giữa chừng, đồng thời vẫn giữ nguyên token
và dữ liệu ứng dụng. Launcher dừng riêng tiến trình JAPANO trước khi mở lại để
trình chọn ảnh/Facebook còn sót không nằm đè lên MainActivity; thao tác này không
xóa tài khoản, dữ liệu app hay ảnh điện thoại. Khi không truyền `--device`, serial
ADB online được xác định trước khi Metro khởi động; nếu Metro cũ đang giữ API
`127.0.0.1`, launcher tự khởi động lại với API LAN thay vì chuyển ảnh lớn qua
ADB reverse. Quy tắc này cũng áp dụng khi ADB đang cắm **USB**: launcher đọc
địa chỉ `wlan0` của điện thoại và giữ USB cho gỡ lỗi/scrcpy, còn ảnh phân tích
và thử đồ đi thẳng qua LAN. Nếu điện thoại không có Wi-Fi, ADB reverse vẫn là
đường dự phòng. Dịch vụ
`japano-adb-reverse` giữ hai tunnel 4100/8081 và tự dựng lại khi chúng bị mất.
Redmi đã tạo ảnh Kimono thật sau một lần xóa chủ động toàn bộ tunnel: API trả
200 sau 28,004 giây và ảnh hoàn tất hiện trực tiếp trong app; đây là một ca đã
kiểm chứng, không phải cam kết mọi ảnh đều đạt. Scrcpy `japano-phone-mirror`
hiển thị màn hình thật trên máy tính. Xem
[hướng dẫn và giới hạn số đo](docs/README_AI_TRAINING.md).

Kiểm chứng ngày 02/10/2026 với ADB qua USB: launcher phát hiện Redmi
`192.168.100.26`, đổi Metro/API sang máy `192.168.100.10`; phân tích vóc dáng
trả HTTP 200 trong **1,301 giây** và thử bikini trả HTTP 200 trong **52,271
giây**, rồi hiển thị ảnh ở bước **Hoàn tất**. Trước bản sửa, cùng luồng qua ADB
reverse chỉ gửi 40.960/301.661 byte và treo **306–324 giây** trước khi abort.

Kiểm chứng lại ngày 01/10/2026 bằng đúng `./run-all.sh` không tham số: launcher
tự tìm Redmi ở cổng ADB Wi-Fi mới, phát hiện Metro cũ đang dùng API loopback và
khởi động lại với `EXPO_PUBLIC_API_URL=http://192.168.100.10:4100`. Ảnh đang có
trên máy đi hết luồng client → backend → GPU, trả HTTP 200 sau **39,807 giây**
và hiển thị ở bước **Hoàn tất** trên điện thoại/scrcpy.

Google Sign-In native yêu cầu OAuth client loại **Android** trên Google Cloud
khớp package `vn.japano.app` và SHA-1 của APK debug
`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Backend hiện
bật Google và Client ID trong app/backend trùng nhau, nhưng Google Play Services
trả `DEVELOPER_ERROR` nếu credential Cloud chưa đăng ký đúng cặp này. Tạo/sửa
credential rồi chạy `npm run setup:auth`, build/cài lại APK; không bỏ bước xác
minh chữ ký/audience ở backend để né lỗi cấu hình.

Nếu điện thoại rớt khỏi ADB Wi-Fi và `adb devices` chỉ còn trạng thái `offline`,
`./run-all.sh` nay thoát với `CHƯA SẴN SÀNG` thay vì vẫn in rằng toàn bộ hệ thống
đã sẵn sàng. Scrcpy cũng không restart vô hạn vào serial chết và launcher đợi
qua thời gian bắt tay trước khi xác nhận màn hình ảo. Bật lại **Gỡ lỗi không
dây** trên điện thoại hoặc cắm USB, rồi chạy lại cùng lệnh; backend/web đang chạy
không đồng nghĩa app trên điện thoại còn kết nối.

Quality policy của thử đồ ưu tiên giữ dáng gốc: FASHN nay dùng human parsing mặc
định để giới hạn thay đổi vào đúng vùng áo/quần thay vì cho model vẽ lại toàn
thân. Chế độ `segmentation_free` chỉ còn là opt-in chẩn đoán. Khi không yêu cầu
đổi pose, quality gate so sánh vị trí tương đối của khuỷu, cổ tay, gối và mắt cá;
ảnh tự đổi nhiều khớp sẽ bị chặn với `pose_changed_unexpectedly` thay vì hiện một
dáng đứng cứng hoặc dạng chân bất thường.

Kiểm chứng cục bộ sau sửa trên ảnh người thật đang ngồi/co một chân với áo sát
nách: FASHN `reposed=false` trả HTTP 200 trong 28,6 giây và giữ nguyên dáng ngồi,
tay chống bàn, chân co, góc người, mặt và nền. Pose detector so được sáu khớp,
drift trung bình 0,018, lớn nhất 0,041 và không có khớp nào vượt ngưỡng 0,16.
Artifact: `test-results/live-debug/pose-preserve-fix/top-result.png`.

Ảnh đứng hợp lệ không bị dựng lại chỉ vì phần chân nằm ngoài khung. Với áo khoác
hiện đại, catalog dùng profile `blazer`/`cardigan` thay vì áp cổng kết cấu tay áo
của Haori. Tín hiệu chuyển màn hình thụ động `home`/`browse` cũng không huỷ job
GPU đang tạo ảnh; thao tác đổi ảnh vẫn huỷ đúng job qua `/api/tryon/cancel`.
Kiểm tra thực tế ngày 01/10/2026 bằng ảnh người cầm máy và sản phẩm
`blazer-kaki`: API trả HTTP 200 trong 29,7 giây, Redmi hoàn tất bước 3 trong
30,1 giây và giữ góc đầu, hai tay cùng chiếc máy ảnh. Artifact:
`test-results/live-debug/pose-gate-failure/phone-camera-blazer-preserved.png`.

Khi ảnh thật sự cần dựng lại pose, preset `relaxed` dùng dáng fashion nữ tự
nhiên: một chân chịu lực, chân kia lùi và khép nhẹ, vai–hông nghiêng ngược rất
nhẹ, một tay hạ mềm và tay kia cong nhẹ cạnh đùi. Reposer chạy 6 bước để bám
skeleton thay vì dừng ở dáng đối xứng sau 4 bước. Hồ sơ khai báo nam dùng
`relaxed-masculine` với khoảng chân trung tính. Hệ thống không suy đoán giới tính
từ khuôn mặt; ảnh không có thông tin giới tính dùng dáng fashion tự nhiên.

Ảnh đã có dáng đứng dùng được luôn giữ nguyên pose gốc, kể cả đứng nghiêng,
lệch vai, giơ tay hoặc bắt chéo chân. Hệ thống chỉ tự dựng lại khi vai/hông bị
che hoặc mất đến mức không còn đủ hình học thân người, khi người dùng chủ động
chọn một travel pose, hoặc khi bật cờ chẩn đoán cưỡng bức.
Ảnh ngồi hoặc ảnh bán thân chỉ mất hai khớp hông vẫn được mặc trực tiếp nếu hai
vai và thân trên còn rõ; hệ thống không dựng người đứng rồi tự loại kết quả với
`pose_not_corrected`. Replay ảnh ngồi tại bàn với `vay-lien-sakura` trả HTTP 200
trong 50,4 giây và giữ nguyên đầu nghiêng, tay chống cằm cùng tay đặt trên bàn.
Cổng pose của bikini phân biệt chuyển động tay thật với sai lệch khớp chân do
trang phục nguồn che khuất. Khi thay một váy dài bằng bikini, khớp đầu gối mới
lộ ra không còn tự làm kết quả hợp lệ bị loại; tay đổi mạnh vẫn là lỗi cứng.
Kiểm tra Redmi bằng ảnh váy dài giơ bàn tay về phía máy ảnh trả HTTP 200 trong
78,4 giây, giữ nguyên bàn tay, góc người và nền cầu thang.
Cổng hậu kiểm chỉ kết luận model tự đổi pose khi sai lệch đồng thời xuất hiện ở
cả nhóm tay và nhóm chân. Sai lệch riêng khuỷu/cổ tay do tay áo mới che detector
không còn làm hai ảnh hợp lệ bị bỏ rồi trả 503.
Các cổng kết cấu trang phục Nhật đọc metadata theo từng SKU: Haori Nami tay ngắn
không bị ép che bắp tay, trong khi Haori tay dài, Kimono và Yukata vẫn phải giữ
đúng vùng tay/chân theo thiết kế.

Quality gate coi riêng `garment_construction_exposed:upperArms` là cảnh báo
chất lượng, không còn xoá ảnh đã sinh và trả 503. Bắp tay không thuộc
ba vùng an toàn bắt buộc; các lỗi đổi mặt/cơ thể, ngực, thân, hông,
chân và các vùng phải kín vẫn chặn cứng. Kiểm tra USB ngày 02/10/2026
bằng đúng ảnh Redmi đang lỗi và `yukata-xanh` trả HTTP 200, PNG
960×1280 trong 29,399 giây, giữ khuôn mặt, dáng và nền gốc kèm cảnh báo
bắp tay.

Kimono Furisode `kimono-furisode-do` dùng ảnh sản phẩm phẳng đã duyệt
`kimono-furisode-do_tryon-flat.png`, không dùng ảnh catalog có người mẫu làm
reference. Cổng kết cấu cho phép bàn chân/cổ chân tự nhiên chiếm tối đa 10% ô
chân nhưng vẫn chặn vạt ngắn hoặc lộ cả chân. Replay đúng ảnh Redmi mặc váy
vàng ngày 02/10/2026 trả HTTP 200 trong 44,66 giây; ảnh 960×1280 giữ khuôn mặt,
dáng giơ tay và nền cầu thang, đồng thời tạo đúng Furisode dài, tay rộng và obi.

FASHN giao ảnh kết quả cho backend dưới dạng JPEG chất lượng 92. Việc này giảm
response của ca Furisode trên từ 2,60 MB PNG-base64 xuống 0,61 MB JSON (ảnh
454 KB) để React Native không kẹt đọc body qua ADB reverse; model và các cổng
chất lượng vẫn chấm chính ảnh được giao. Lượt bấm thật tiếp theo từ Redmi trả
HTTP 200 trong 35,95 giây. Backend đã xác nhận thành công, nhưng lần kiểm tra
đó chưa giữ được bằng chứng màn Hoàn tất vì thiết bị đã quay về trang sản phẩm
trước lúc chụp màn hình.

Metadata tay ngắn của Nami được đồng bộ vào hai catalog và MongoDB live. Replay
đúng ảnh ngồi cạnh bóng đỏ trả HTTP 200 trong 64,470 giây; lần thử lại từ Redmi
trả HTTP 200 trong 26,786 giây. Với Yukata/Kimono dài, tay áo rộng và vạt dài có
thể che khớp tay/chân khiến detector bám theo mép vải. Quality gate chỉ bỏ tín
hiệu khớp thuộc đúng vùng bị kết cấu sản phẩm che; vẫn giữ cổng khuôn mặt, chủ
thể, thân người, độ nét, trang phục và vùng an toàn. Replay đúng ảnh váy đỏ ngồi
sofa trả HTTP 200 trong 40,237 giây, không có lượt sinh bị loại. Ba lượt Redmi
tiếp theo đều trả HTTP 200 trong 27,643 giây, 55,944 giây và 25,800 giây; lượt
ảnh đứng cuối đã hiển thị ở bước Hoàn tất. Bằng chứng:
`test-results/live-debug/pose-gate-failure/phone-standing-result-visible.png`.

Kiểm chứng cục bộ ngày 2026-10-01 trên ảnh nữ đang ngồi: luồng đầy đủ
FLUX re-pose → FASHN fast trả HTTP 200 trong khoảng 52 giây; ảnh trung gian và
ảnh đã mặc đồ đều có toàn thân đứng tự nhiên, một chân lùi/khép, không còn dạng
chân rộng cứng. Artifacts: `test-results/live-debug/pose-guides/feminine-standing-v2-reposed.png`
và `test-results/live-debug/pose-guides/feminine-standing-v2.png`.

Kimono Tomesode dùng ảnh phẳng đã duyệt
`kimono-tomesode-den_tryon-flat.png` và đi thẳng qua nhánh FLUX đa tham chiếu
`japanese-full-length`; không đưa ảnh catalog có người mẫu vào FASHN
`one-pieces`. Cổng cuối yêu cầu giữ cổ chéo, tay rộng và vạt dài che đầu gối;
ảnh váy ngắn, trễ vai hoặc sát nách sẽ bị từ chối. Ca Redmi ngày 2026-10-01 đã
hiển thị đúng Kimono dài với engine
`flux2-klein-4b-japanese-full-length+fast-16steps+adaptive-low-memory`; ảnh màn
hình và raw output nằm trong `test-results/live-debug/kimono-fix/`.

Ảnh nhiều người luôn khoá **một người có tâm bounding box gần tâm ảnh nhất** cho
cả phân tích vóc dáng và thử đồ. Những người còn lại bị tách khỏi ảnh đầu vào và
thay bằng nền studio trước khi model chạy, nên kết quả chỉ chứa người thử đồ.
Confidence YOLO và các khớp vai-hông loại cụm hoa, rèm, tượng hoặc phản chiếu bị
nhận nhầm; kích thước người chỉ dùng để phá hoà. Cache pose từ ảnh nhóm không
được dùng tắt vì phải chạy bước crop/tách chủ thể. Nút **Kiểm tra lại** chạy lại
phép phân tích trên đúng bytes ảnh đang hiển thị. Ca cổng hoa Redmi ngày
2026-10-01 chọn đúng người thật confidence 0.893 ở giữa thay vì hai box trang
trí confidence thấp. Các khoảng vóc dáng vẫn chỉ là gợi ý thống kê, không phải
số đo bằng thước và không tự chọn size.

### Photo-measurement training audit (2026-09-30)

- Downloaded/audited 7,211 Celeb-FBI files (6,196 accepted), all 8,978 BodyM
  frontal masks, and 236,717 jpersonwiki rows (15,752 usable height/weight rows).
- Fine-tuned ResNet18, DenseNet201 and ConvNeXt-Tiny with real optimizer updates
  and immutable held-out splits. Best RGB photo-only MAE is 6.486kg versus the
  same-split baseline 6.244kg; with measured/user-supplied height ConvNeXt gets
  4.804kg versus baseline 4.946kg. The person-crop ConvNeXt is used only as a
  low-confidence fallback for seated/cropped photos; it never chooses a size.
- Trained a separate ANSUR II height+BMI to chest/waist/hip prior on a locked
  3,883/971/1,214 split. Held-out table-regression MAE is
  2.954/3.612/3.090cm; photo error is additional, so runtime uncertainty is much
  wider and the checkpoint remains an experimental population prior.
- Downloaded and checksum-verified BODIES v1.0 `data16`: 12,000 CC-BY-4.0
  synthetic subjects, including 91 test subjects ≥140kg. ConvNeXt reaches
  3.076/1.249kg MAE on its synthetic test, but BODIES-initialized Celeb-FBI
  reaches 6.620/4.876kg and does not improve over ImageNet initialization.
- The BODIES TorchScript checkpoint is now used only as a guarded secondary
  prior when a full-body mask has three agreeing broad-build signals and the
  checkpoint itself predicts at least 135kg. It raised generated profiles
  `mau-03/07/10` to 137.2/137.2/128.9kg while leaving the moderately broad
  `mau-06` at 79.4kg and all six non-broad profiles unchanged. These generated
  profiles have no measured ground truth, so this proves gating behavior rather
  than customer-photo accuracy.
- A BodyM silhouette ResNet18 improved held-out testB MAE to weight7.293kg,
  chest4.084cm, waist4.667cm and hip3.958cm, but BodyM is CC-BY-NC-4.0, so this
  checkpoint is research-only and not deployed commercially.
- Real-photo extreme-weight evidence remains insufficient: Celeb-FBI test has
  one sample at or above140kg; BodyM testB has none. Synthetic coverage cannot
  validate customer photos. The app keeps uncertainty/manual measurement
  priority and does not label a photo 150kg from appearance alone.
- Full reports, hashes, commands, license review and external-model survey:
  `docs/README_AI_TRAINING.md` and
  `backend/ai_training/evaluation/body_training_20260930.json`.
