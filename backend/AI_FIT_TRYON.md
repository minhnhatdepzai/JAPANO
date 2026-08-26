# JAPANO — Thử đồ AI theo độ vừa vặn (Fit-Aware Virtual Try-On)

> **Tuyên bố giới hạn (đọc trước):** chiều cao và cân nặng suy ra từ một ảnh 2D
> là **giá trị ước lượng**, không phải phép đo y tế hay phép đo nhân trắc chính
> xác. Hệ thống luôn trả về một **khoảng** kèm **độ tin cậy**, và từ chối trả lời
> khi dữ liệu không đủ.

---

## 1. Kiến trúc cũ

```
Ảnh người
   ↓
accessory_pipeline.py  →  pose (YOLOv8n-pose) + đánh giá tư thế
   ↓
[nếu tư thế xấu]  FLUX.2 Klein 4B  →  đưa về dáng đứng chuẩn
   ↓
FASHN VTON 1.5  →  mặc trang phục lên người
   ↓
quality gate (tryon_quality)  →  chặn ảnh hỏng
   ↓
[nếu có phụ kiện]  ghép pose-anchored + FLUX.2 làm đẹp
   ↓
Ảnh trả về mobile
```

Song song đó có một nhánh **tư vấn size** hoàn toàn tách rời:
`lib/outfit.js → adviseSize()` đọc số đo khách nhập rồi trả về một chữ cái size,
và `routes/tryon.js → computeSizeFit()` so nó với size khách chọn để in một dòng
chữ dưới ảnh.

## 2. Vấn đề của Try-On cũ

1. **Độ vừa vặn chỉ là chữ, không phải ảnh.** Người 100kg mặc áo S và người 45kg
   mặc áo XXL nhận về hai bức ảnh vừa vặn y hệt nhau; chỉ có dòng cảnh báo bên
   dưới là khác. Đó là lời khuyên, không phải mô phỏng.
2. **`adjustGarmentForFit()` viết rồi nhưng chưa từng được gọi.** Hàm này nằm
   trong `routes/tryon.js` với hẳn một dòng `// eslint-disable-next-line
   no-unused-vars` — bằng chứng rằng nó là mã chết. Mọi thứ liên quan tới fit
   đều dừng ở mức tính toán, không chạm được vào bức ảnh.
3. **Thang đánh giá quá thô.** Chỉ có ba mức `good / tight / loose`. Lệch 1 bậc
   size và lệch 4 bậc size cho ra cùng một chữ "tight".
4. **Chỉ nhìn bậc size.** Hai người cùng được khuyên size L có thể lệch nhau
   10cm vòng ngực; hệ thống không phân biệt được.
5. **Không biết gì về cơ thể trong ảnh.** Khách phải tự nhập chiều cao, cân nặng.
   Bỏ trống thì mọi tư vấn rơi về mặc định size M.
6. **Nếu chỉnh khổ ảnh vải trước khi vào VTON** (cách làm "rẻ" mà hàm chết ở
   trên định làm) thì sẽ phá hoa văn và phom sản phẩm — đúng nguyên nhân từng
   khiến engine cũ trả về một tấm vải hình chữ nhật.

## 3. Kiến trúc mới

```
Ảnh người
   ↓
pose analysis (YOLOv8n-pose)                    ── accessory_pipeline.py
   ↓
BODY ANALYSIS  (vóc dáng, chiều cao, cân nặng)  ── body_analysis.py        [MỚI]
   ↓
hợp nhất nguồn số liệu (thật > ước lượng)       ── lib/bodyAnalysis.js     [MỚI]
   ↓
FIT ANALYSIS   (7 mức + severity + hiệu ứng)    ── lib/fitAnalysis.js      [MỚI]
   ↓
[tuỳ chọn] chỉnh khổ ảnh vải rất nhẹ            ── adjust_garment_fit()    [ĐÃ NỐI]
   ↓
FASHN VTON 1.5  →  mặc ĐÚNG trang phục
   ↓
quality gate (biết trước hiệu ứng fit dự kiến)
   ↓
FIT EFFECT REFINEMENT  (FLUX.2 /fit-refine)     ── fashn_service.py        [MỚI]
   ↓
FIT QUALITY GATE  (cấm sửa cơ thể / hở da)      ── fit_effect_quality()    [MỚI]
   ↓
[nếu có phụ kiện]  ghép + FLUX.2 làm đẹp
   ↓
Ảnh + sizeFit + bodyAnalysis + fitEffect  →  mobile
```

Nguyên tắc phân vai:
* **FASHN chịu trách nhiệm mặc ĐÚNG trang phục** (màu, hoạ tiết, logo, phom).
* **FLUX.2 chịu trách nhiệm làm trang phục đó ôm/rủ đúng trên cơ thể đó.**

Làm ngược lại — bóp méo ảnh vải trước khi vào VTON — sẽ phá chính thiết kế sản
phẩm mà cửa hàng đang bán.

## 4. Body analysis — `backend/body_analysis.py`

Dùng lại pose đã tính (không chạy YOLO lần hai) và mặt nạ nền `rembg` vốn đã cài
sẵn cho pipeline phụ kiện. **Không nạp thêm model nặng nào lên GPU.**

Đo được:

| Đại lượng | Cách lấy |
|---|---|
| Khung người chính | box của YOLO pose |
| Đỉnh đầu (vertex) | hàng pixel cao nhất của silhouette trong dải ngang quanh đầu |
| Chiều dài đầu | `(mắt − đỉnh đầu) / 0.55` (0.55 = tỉ lệ đỉnh tóc→mắt đo trên ảnh thật) |
| Chiều cao pixel | mốc thấp nhất còn thấy (mắt cá / gối / hông) quy về toàn thân theo bảng tỉ lệ Drillis & Contini |
| Bề ngang vai, ngực, eo, hông | đo trên silhouette tại các hàng giải phẫu |
| Chiều dài thân, chiều dài chân | khoảng cách vai→hông, hông→mắt cá |
| Tỉ lệ vai/hông, tỉ lệ bề ngang thân | các số trên chia cho chiều cao pixel |
| Độ nghiêng người | góc của đường nối hai vai |
| Độ rộng của quần áo (`clothingSlack`) | bề ngang silhouette / khoảng cách khớp vai |

Hai chi tiết quan trọng, cả hai đều là lỗi thật đã phát hiện khi chạy trên ảnh thật:

* **Bỏ qua khớp do pipeline "bù" ra.** `analyze()` tự điền các khớp bị khuất theo
  tỉ lệ box để pipeline phụ kiện luôn có điểm neo. Nếu tin những điểm đó, một tấm
  ảnh cắt ngang đùi vẫn có "mắt cá chân" và hệ thống tưởng nhìn thấy cả người.
* **Số đo vòng đo từ silhouette là vòng NGOÀI QUẦN ÁO**, không phải vòng cơ thể —
  một chiếc áo phom rộng làm "vòng ngực" phồng thêm 20–30cm. Vì vậy các số này
  được trả về kèm cờ `girthsMeasureClothing: true` và **không bao giờ** được dùng
  để chốt size.

## 5. Ước lượng chiều cao / cân nặng

### Chiều cao — hai chế độ

**Mode B (có mốc chuẩn).** Khách đã nhập chiều cao thật, hoặc ảnh có vật chuẩn
(`scaleReference: {pixelLength, realLengthCm}`). Quy đổi pixel→cm trực tiếp, độ
tin cậy cao.

**Mode A (chỉ có ảnh).** Neo vào chiều dài đầu — hằng số nhân trắc ổn định nhất
có thể đo trên ảnh (~24cm tính cả tóc, độ lệch chuẩn ~1cm):

```
số đầu   = chiều cao pixel / chiều dài đầu pixel
chiều cao ≈ số đầu × 24.0 cm
khoảng    = ± (4.5% + 6% × (1 − độ tin cậy))
```

Hệ thống **từ chối trả lời** khi:
* tỉ lệ đầu/thân đo được nằm ngoài dải 6.0–9.0 (ảnh chụp quá gần bị phối cảnh
  phóng to đầu, hoặc ảnh bị cắt thân);
* không thấy khớp mặt để đo đầu;
* độ tin cậy tổng < `JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE` (mặc định 0.35).

Khi từ chối, `valueCm/minCm/maxCm` đều là `null` và giao diện hiển thị
"Không đủ dữ liệu để ước lượng chiều cao đáng tin cậy."

### Cân nặng — mô hình thể tích

```
px_per_cm  = chiều cao pixel / chiều cao (cm)
mỗi hàng pixel của mặt nạ → tách thành các đoạn liên tục (thân, tay trái, tay phải…)
mỗi đoạn   → một lát cắt hình elip:  diện tích = π/4 × rộng × (rộng × tỉ lệ sâu)
             tỉ lệ sâu: đầu 1.12 · thân 0.74 · tay/chân 1.00
thể tích   = Σ (diện tích × chiều cao một hàng)
cân nặng   = thể tích × 1.01 kg/L × 0.78
```

Hệ số 0.78 là **hằng số hiệu chuẩn**, không phải hằng số vật lý: tiết diện thật
của cơ thể nhỏ hơn hình elip bao quanh nó (eo thóp vào, khe giữa hai chân), và
đường viền còn cộng thêm độ dày quần áo. Khi có tập ảnh kèm cân nặng thật, hãy
fit lại bằng `ai_training/train_body_estimator.py` và dùng model đó.

Hệ thống **từ chối ước lượng cân nặng** khi:
* ảnh không thấy bàn chân (`coverage != 'full'`) — không thể cân một cơ thể chỉ
  nhìn thấy một phần: phần bị cắt không có trong mặt nạ, phần còn lại bị ống kính
  gần phóng to. Thử trên ảnh thật cho sai lệch tới 60kg;
* không tách được nền, hoặc độ tin cậy dưới ngưỡng.

Khi mặc đồ rộng (`clothingSlack > 1.15`), độ tin cậy bị hạ và **biên dưới của
khoảng được nới rộng bất đối xứng** — vì vải chỉ có thể làm đường viền rộng ra,
không bao giờ hẹp lại, nên giá trị thật nằm ở phía thấp hơn.

### Kết quả đo thật (3 ảnh tham chiếu trong repo)

| Ảnh | Kết quả | Nhận xét |
|---|---|---|
| `front-neutral-reference.jpg` (toàn thân) | 170.4cm (160.7–180.2), 59kg (46–67) | hợp lý cho người mẫu trong ảnh |
| `front-neutral-reference-2.jpg` (cắt ngang gối) | 175.4cm (164.1–186.6), cân nặng **từ chối** | đúng như thiết kế |
| `front-neutral-reference-3.jpg` (cắt ngang hông) | 164.9cm (153.4–176.3), cân nặng **từ chối** | đúng như thiết kế |

## 6. Thứ tự ưu tiên dữ liệu — `lib/bodyAnalysis.js`

```
1. Số đo vòng THẬT do khách nhập          (bust / waist / hip)
2. Chiều cao / cân nặng THẬT do khách nhập
3. Chiều cao / cân nặng AI ước lượng      (chỉ khi đạt ngưỡng tin cậy)
4. Tỉ lệ cơ thể đo từ ảnh                 (chỉ hiệu chỉnh severity, không thay số đo)
5. Mặc định size M
```

Ước lượng của AI **không bao giờ** ghi đè dữ liệu thật của khách. Mọi trường đều
kèm `sources[field] = 'user' | 'image-estimation'` để giao diện không bao giờ
trình bày số ước lượng như số đo thật.

## 7. Fit engine — `lib/fitAnalysis.js`

Bảy mức, tính từ một điểm `severity` liên tục (0 → 1):

| severity | hướng chật | hướng rộng |
|---|---|---|
| ≤ 0.12 | `good` | `good` |
| ≤ 0.42 | `slightly_tight` | `slightly_loose` |
| ≤ 0.72 | `tight` | `loose` |
| > 0.72 | `very_tight` | `very_loose` |

`severity` được ghép từ hai nguồn:

* **Bậc size** (luôn có): lệch 1 bậc → 0.34, 2 bậc → 0.66, ≥3 bậc → 0.88+.
* **Ease theo cm** (khi khách có nhập số đo vòng): `ease = vòng của size đã chọn
  − vòng cơ thể`. Ease âm là bó, 0–9cm là vừa, trên 9cm là rộng dần.
  Ease là tín hiệu **mạnh nhất** vì nó so trực tiếp cơ thể với chính chiếc áo đó;
  bậc size chỉ được phép đẩy mức độ lên, không được kéo xuống.
* Khi không có số đo vòng: BMI và tỉ lệ bề ngang thân đo từ ảnh dùng để hiệu
  chỉnh nhẹ (người BMI cao mặc size nhỏ thì căng hơn người BMI thấp cùng bậc).

Đầu ra:

```json
{
  "chosenSize": "S", "recommendedSize": "XXL", "delta": -4,
  "verdict": "very_tight", "severity": 1, "label": "RẤT CHẬT", "title": "⚠ Quá chật",
  "bodyProfile": { "heightCm": 170, "weightKg": 85, "bmiProxy": 29.4, "bodyWidthRatio": 0.199 },
  "visualEffect": { "tension": 1, "looseness": 0, "seamStress": 1, "tearAllowed": true },
  "allowedEffects": ["fabric_tension","seam_stress","button_strain","seam_separation","small_seam_split"],
  "signals": ["size_delta","bmi_proxy","image_body_ratio"],
  "message": "Bạn chọn S nhưng hệ thống khuyến nghị XXL. Vải được mô phỏng căng mạnh và có thể bục một đoạn đường may."
}
```

**Chạy fit-refine hay không** (tiết kiệm GPU):

| Mức | Hành động |
|---|---|
| `good` / `unknown` | không chạy |
| `slightly_*` | chỉ chạy khi `severity ≥ JAPANO_FIT_REFINE_MIN_SEVERITY` (0.35) |
| `tight` / `loose` | chạy |
| `very_tight` / `very_loose` | bắt buộc chạy, được thử lại tối đa 2 lượt |

## 8. Try-On effect — cách tạo căng, bó, bục, rộng, rủ

Endpoint mới `POST /fit-refine` trong `fashn_service.py` nhận **ảnh đã mặc đồ
xong** + ảnh sản phẩm + mức vừa vặn, rồi dựng prompt theo từng loại trang phục.

Vùng trọng tâm theo loại (`FIT_ZONE_FOCUS`):

| Loại | Chật | Rộng |
|---|---|---|
| `tops` | ngực, vai, bắp tay, bụng, hàng nút | vai trễ, tay áo rộng và dài, thể tích thân, gấu áo |
| `bottoms` | cạp, hông, đùi (tự nhiên, không phản cảm) | cạp rộng, hông rộng, ống rộng, nếp gấp chồng |
| `one-pieces` | vai, ngực, eo, hông, chiều dài | như trên + gấu rộng |

Kimono / Haori / áo khoác được thêm một đoạn prompt riêng: giữ cổ áo chồng mép,
kết cấu tay áo hình chữ nhật, vị trí đai obi và đường gấu gốc.

Theo từng mức:

* `slightly_tight` — ôm sát, ít nếp, vải hơi căng, **không** hư hại.
* `tight` — vải căng, nếp tension hình chữ X/Y, đường may bị kéo thẳng, tay áo bó,
  nút căng và hé khe nhỏ, gấu áo bị kéo lên.
* `very_tight` — căng như mặt trống, đường may bị kéo mạnh và tách một phần ở vai
  hoặc sườn, khuyết nút bị kéo giãn, tay và gấu ngắn hụt so với cơ thể.
  Nếu `tearAllowed` — **một** vết bục nhỏ dọc theo đường may, thấy sợi vải sờn,
  và nếu phía sau lộ ra thì phải là **lớp áo trong trung tính**.
* `slightly_loose` — đường vai qua khỏi điểm vai một chút, thừa vải nhẹ ở eo.
* `loose` — vai trễ hẳn, tay áo rộng và dài trùm bàn tay, thân hộp, thấy rõ
  khoảng hở giữa vải và cơ thể, nhiều nếp rủ.
* `very_loose` — rủ như áo choàng, vai tụt xuống bắp tay, tay áo nuốt bàn tay,
  nếp rủ tầng, gấu rất rộng, nhìn phát biết thừa vài size.

Ba khoá cứng luôn được nối vào cuối mọi prompt:

* **IDENTITY_LOCK** — giữ nguyên mặt, tóc, màu da, **kích thước cơ thể**, tỉ lệ,
  tay, chân, tư thế, nền, người phụ. *"Do NOT make the person thinner, fatter,
  taller or shorter."*
* **GARMENT_LOCK** — giữ nguyên màu, hoạ tiết, logo, kết cấu, cổ áo, số nút, kiểu
  tay, thiết kế. Chỉ được đổi **cách vải nằm trên cơ thể**.
* **SAFETY_LOCK** — không thương tích, không máu, không rách da, không khỏa thân.
  Hư hại chỉ ở vải. Nếu vết bục có nguy cơ lộ vùng nhạy cảm thì phải giữ một lớp
  áo trong trung tính. Không hiệu ứng hoạt hình.

Ngoài ra, **quần và chân váy không bao giờ được phép có hiệu ứng bục/rách** —
chặn ngay từ `lib/fitAnalysis.js`, không phụ thuộc vào prompt.

## 9. Quality gate hiểu hiệu ứng fit

Hai cổng, hai câu hỏi khác nhau:

**`tryon_quality` (cổng cũ, đã nâng cấp)** — "có mặc được đồ lên người không?".
Nay nhận thêm `fitEffect`: vải kéo căng thì bề mặt phẳng và mịn đi, nếu không
biết trước cổng sẽ đánh nhầm một chiếc áo chật thành `flat_or_blurred_garment`.
Ngưỡng kết cấu được nới **theo tỉ lệ với độ căng dự kiến**, không phải tắt kiểm tra.

**`fit_effect_quality` (cổng mới)** — "hiệu ứng có hợp lệ không?":

| Lý do từ chối | Ý nghĩa |
|---|---|
| `body_changed_not_garment` | tỉ lệ DỌC của cơ thể bị đổi > 22% ⇒ AI đã sửa chính cơ thể |
| `excessive_skin_exposure` | tỉ lệ pixel màu da trong vùng trang phục tăng quá ngưỡng |
| `garment_color_changed` | màu trung bình vùng trang phục lệch > 34 ⇒ vẽ lại thành món khác |
| `main_subject_lost` | mất nhân vật chính |
| `fit_effect_not_visible` | mức rất chật/rất rộng nhưng ảnh gần như không đổi |

Bị từ chối thì **giữ nguyên ảnh VTON sạch** — thà mất hiệu ứng còn hơn trả về một
ảnh đã sửa cơ thể hoặc hở da. Lý do được ghi vào `attempts` và vào bảng chẩn đoán
của trang quản trị.

## 10. CatVTON fallback

Không thay đổi. Vẫn là fallback tuỳ chọn, mặc định tắt
(`JAPANO_CATVTON_FALLBACK=0`), chỉ dùng cho ảnh vốn đã có tư thế tốt.

## 11. Fine-tuning — hiện trạng thật

| Thành phần | Trạng thái |
|---|---|
| Fit-aware inference pipeline | **ĐANG CHẠY THẬT** |
| Body analysis + ước lượng chiều cao/cân nặng | **ĐANG CHẠY THẬT** |
| Bộ hồi quy cân nặng (sklearn) | **MODEL_NOT_TRAINED** — có script train đầy đủ, chưa có nhãn thật |
| LoRA fit-refinement cho FLUX.2 | Đọc `ai_training/models/fit_lora.status.json` — dataset và trainer img2img chính thức đã được dựng; orchestrator train/đánh giá checkpoint thật |
| Fine-tune chính FASHN VTON 1.5 | **KHÔNG KHẢ THI** |

Lý do dòng cuối: bản FASHN VTON 1.5 trong máy (`~/jp/ai/fashn-vton-1.5`) chỉ có
mã suy luận — `src/fashn_vton/pipeline.py`, `tryon_mmdit.py`, `scripts/download_weights.py`
— **không có vòng huấn luyện, không optimizer, không loss**. Vì vậy:

> Trong báo cáo phải gọi phần đã làm là **"fit-aware inference enhancement"**,
> KHÔNG được viết "đã fine-tune FASHN VTON".

Chỉ được dùng chữ "fine-tuned" khi `ai_training/models/fit_lora/` hoặc
`ai_training/models/body_weight_estimator.joblib` thật sự tồn tại do một lượt
train đã ghi log/checkpoint/validation đầy đủ. Riêng FLUX.2 phải chạy trainer
image-to-image chính thức của diffusers; `train_fit_lora.py` gọi trực tiếp
trainer đó, ghi log/checkpoint và chỉ chuyển trạng thái sau khi kiểm tra file
`.safetensors`. Nguồn sự thật vẫn là `models/fit_lora.status.json`; có checkpoint
nhưng chưa vượt benchmark thì không được gọi là đã chấp nhận để chạy production.

## 12. Dataset

Xem `backend/ai_training/README.md` để biết cấu trúc đầy đủ.

```
ai_training/
  fit_dataset/     metadata.jsonl + images/{person,garment,target}/   → LoRA fit
  body_dataset/    labels.csv + images/                               → hồi quy cân nặng
  models/          nơi checkpoint được ghi ra
```

Chia tập **theo danh tính người mẫu** 70/15/15 (`prepare_fit_dataset.py`) để một
khuôn mặt không xuất hiện ở cả train lẫn test. Script cảnh báo khi tập lệch lớp.

Bảy lớp bắt buộc: `good`, `slightly_tight`, `tight`, `very_tight`,
`slightly_loose`, `loose`, `very_loose`; trải đều nam/nữ, nhiều vóc dáng, nhiều
tư thế, đủ tops / bottoms / one-pieces / kimono-haori.

## 13. Metrics

### Bộ phân loại độ vừa vặn — có số thật

```bash
node backend/ai_training/evaluate_fit_classifier.js
```

Trên 22 ca kiểm thử viết tay theo đặc tả nghiệp vụ:

```
Accuracy : 100.0%
Macro F1 : 1.000
```

**Cách đọc đúng:** nhãn do người viết theo bảng quy tắc nghiệp vụ, nên con số này
đo **mức tuân thủ đặc tả** của bộ phân loại, KHÔNG phải mức trùng khớp với cảm
nhận của người mặc thật.

### Ước lượng chiều cao / cân nặng

Chưa có tập ảnh kèm số đo thật ⇒ **chưa có MAE/RMSE**. Có sẵn quy trình để đo:
`train_body_estimator.py` tính MAE và RMSE trên tập test tách theo danh tính.
Hiện script in `MODEL_NOT_TRAINED`.

Kiểm chứng hiện có là **12 bài test tự động** (`backend/test/python/`) trên một
người mẫu tổng hợp có tỉ lệ biết trước, cộng ba ảnh thật ở mục 5.

### Chất lượng ảnh thử đồ

Không có ground-truth cho "một chiếc áo chật trông thế nào" ⇒ phải chấm tay:

```bash
python3 backend/ai_training/evaluate_tryon_manual.py --init
python3 backend/ai_training/evaluate_tryon_manual.py
```

Đo: identity preservation, garment fidelity, fit-effect correctness, artifact
rate, failure rate. Chưa chấm thì script in `MANUAL_EVALUATION_EMPTY` thay vì bịa
số. Mọi con số ra từ đây phải ghi rõ nguồn là **manual evaluation**.

## 13b. Trang phục hở da và chính sách 18+

Từ bản này, hệ thống hỗ trợ thử bikini, áo tắm, crop top, áo sát nách, áo trễ
vai, quần short và chân váy ngắn cho **người trưởng thành**. Đây là tính năng
thử thời trang thông thường; hệ thống **không** tạo ảnh khỏa thân, **không** cởi
bỏ trang phục và **không** có bất kỳ chức năng "try-off" nào.

### Hồ sơ độ che phủ — `backend/lib/garmentCoverage.js`

20 loại trang phục, mỗi loại khai báo tường minh 8 vùng cơ thể là `covered` hay
`exposed`. Nhờ vậy pipeline phân biệt được hai câu hỏi vốn hay bị trộn lẫn:

| | Câu hỏi | Ví dụ |
|---|---|---|
| Vùng hở **có chủ đích** | da lộ ra ở đây có đúng thiết kế không? | bụng của áo crop, vai của áo trễ vai |
| Vùng **bắt buộc kín** | vùng này có bị hở không? | ngực, vùng chậu, mông |

`ALWAYS_COVERED_ZONES = ['chest','pelvis','buttocks']` là **hằng số**. Sản phẩm
có khai `coverageProfile` kiểu gì thì ba vùng này vẫn bị ép về `covered`, và
`tearAllowed` chỉ được siết chặt chứ không được nới lỏng.

### Ba tầng an toàn độc lập

1. **Xác nhận 18+** (`lib/adultTryonPolicy.js`) — thiếu `adultConsent === true`
   là từ chối ngay, ảnh chưa hề rời máy người dùng (client chặn) và chưa hề chạm
   GPU (server chặn trong ~40ms).
2. **Kiểm tra ảnh** (`lib/adultImageCheck.js`) — hỏi model thị giác đúng MỘT câu
   nhị phân: "đây có rõ ràng là người trưởng thành không?". Ba kết quả:
   `yes` cho qua, `no` → `MINOR_SUSPECTED`, `unsure` → `AGE_UNVERIFIED`.
   Không hỏi được (service chết/quá hạn) → `AGE_VERIFICATION_UNAVAILABLE`.
   **Fail-closed**: mọi trường hợp không chắc chắn đều là từ chối.
3. **Cổng độ che phủ** (`accessory_pipeline.coverage_quality()`) — chạy trên ảnh
   kết quả. Hở vùng bắt buộc kín ⇒ **huỷ ảnh**, trả HTTP 422 `COVERAGE_UNSAFE`.
   Thà không có ảnh còn hơn trả một ảnh hở vùng nhạy cảm.

### Hiệu ứng fit cho trang phục hở

* **Đồ bơi**: `tearAllowed = false` tuyệt đối, và cả `seam_separation` cũng bị
  loại — với bikini, một đường may tách rời đồng nghĩa với hở da. Quá chật chỉ
  thể hiện bằng dây và vải hơi căng.
* **Crop top**: prompt khoá cứng chiều dài vạt áo — không được kéo dài để che
  bụng, cũng không được cắt ngắn thêm.
* **Short / váy ngắn**: giữ nguyên chiều dài, giữ kín vùng chậu và mông.
* **Kimono / haori / hakama**: khoá kết cấu (mép cổ áo chồng, tay áo chữ nhật,
  vị trí đai obi, đường gấu).

### Vì sao không tái dùng `analyzePortrait`

Đã thử. Prompt đó phục vụ tư vấn phong cách, được dặn "không bình luận về ngoại
hình" và cho phép để trống độ tuổi — đo thực tế trên ảnh người lớn rõ mặt, nó
trả `ageRange: ""` sau **67 giây**. Dùng nó làm cổng an toàn thì mọi lượt hợp lệ
đều bị từ chối. Bộ kiểm tra riêng hỏi một câu ngắn trả lời trong **~4 giây**.

## 14. Giới hạn

1. Một ảnh RGB đơn không có vật chuẩn **không** cho phép suy ra chiều cao tuyệt
   đối chính xác. Kết quả luôn là khoảng.
2. Silhouette của người mặc quần áo là silhouette của **quần áo**. Đồ rộng làm
   ước lượng cân nặng cao hơn thực tế; hệ thống phát hiện và cảnh báo nhưng không
   sửa được triệt để.
3. Ảnh không thấy bàn chân thì không ước lượng được cân nặng.
4. Ảnh chụp gần bị phối cảnh phóng to phần thân trên.
5. Hiệu ứng fit do model sinh ảnh dựng, nên **không phải mô phỏng vải vật lý**.
   Nó là ước lượng thị giác, đủ để nhìn ra chật/vừa/rộng, không phải phần mềm CAD
   ngành may.
6. Mỗi lượt có hiệu ứng fit tốn thêm một lần nạp FLUX (~15GB). Trên GPU 16GB dùng
   chung với emulator, đây là bước đắt nhất — vì vậy nó chạy có điều kiện.

## 15. Cách chạy

```bash
# Toàn bộ kiểm thử
npm run check                      # backend tests + mobile typecheck + python tests
npm --workspace backend test       # 171 test Node
npm run test:python                # 12 test Python cho bộ ước lượng vóc dáng
npm run fit:eval                   # accuracy / macro F1 / confusion matrix

# Chạy hệ thống
npm run backend                    # API + trang quản trị
# service AI (mỗi cái một terminal, xem start-all.sh):
#   fashn_service.py  (FASHN VTON 1.5 + FLUX.2 + /fit-refine)
#   accessory_pipeline.py chạy theo tiến trình con, không cần bật riêng

# Thử API phân tích vóc dáng
curl -X POST http://localhost:4100/api/stylist/body-analysis \
  -H 'content-type: application/json' \
  -d '{"personImageBase64":"data:image/jpeg;base64,..."}'
```

Bật / tắt từng phần bằng biến môi trường (xem `.env.example`):

```env
JAPANO_FIT_EFFECT_ENABLED=1          # 0 -> thử đồ chạy y như trước, chỉ mất hiệu ứng
JAPANO_BODY_ANALYSIS_ENABLED=1
JAPANO_FIT_REFINE_MIN_SEVERITY=0.35
JAPANO_FIT_TEAR_MIN_SEVERITY=0.85
JAPANO_BODY_ESTIMATE_MIN_CONFIDENCE=0.35
```

## 16. Cách demo cho giáo viên

Vào màn **Thử đồ thông minh** trong app, chọn cùng một ảnh và cùng một sản phẩm,
chỉ đổi số đo + size. Mỗi lượt xem badge góc phải ảnh và banner bên dưới.

| # | Nhập | Chọn size | Kết quả mong đợi |
|---|---|---|---|
| 1 | 170cm / 65kg | M | `VỪA` — không chạy hiệu ứng, ảnh form chuẩn |
| 2 | 170cm / 85kg | S | `RẤT CHẬT` — vải căng, đường may bị kéo, có thể bục một đoạn |
| 3 | 165cm / 95kg | S | `RẤT CHẬT` — mức căng cao nhất |
| 4 | 150cm / 42kg | XL | `RẤT RỘNG` — vai trễ, tay dài, thân thùng thình |
| 5 | 160cm / 50kg | XXL | `RẤT RỘNG` — rủ như áo choàng |

Điểm nhấn khi trình bày: **cơ thể trong cả năm ảnh là một, chỉ có quần áo đổi**.
Đó là yêu cầu cốt lõi — hệ thống không bao giờ làm người gầy đi để áo nhỏ vừa.

Ba màn phụ đáng mở kèm:

* Card **PHÂN TÍCH VÓC DÁNG** ngay dưới ảnh — chiều cao/cân nặng dạng khoảng, độ
  tin cậy, và nút "Dùng số liệu AI" / "Nhập số đo thật".
* Thử một ảnh **cắt ngang đùi** để cho thấy hệ thống **từ chối** đoán cân nặng
  thay vì bịa số.
* Trang quản trị → **Thử đồ AI**: bảng chẩn đoán từng lượt (size chọn/khuyến
  nghị, mức vừa vặn, severity, hiệu ứng có dựng được không, cổng chất lượng,
  thời gian xử lý).
