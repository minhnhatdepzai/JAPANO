# JAPANO — Dữ liệu và huấn luyện cho thử đồ theo độ vừa vặn

Thư mục này chứa phần **học máy** của tính năng: chuẩn bị dữ liệu, huấn luyện,
và đo chất lượng. Nó tách hẳn khỏi mã chạy thật (`backend/`) để việc train không
bao giờ vô tình ảnh hưởng tới dịch vụ đang phục vụ khách.

## Trạng thái thật — đọc trước khi viết báo cáo

Nguồn sự thật: `models/fit_lora.status.json`. Đừng chép trạng thái từ README này
vào báo cáo — đọc file JSON đó.

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| Fit-aware inference pipeline | **ĐANG CHẠY THẬT** | `lib/fitAnalysis.js` + `/fit-refine` của `fashn_service.py` |
| Body analysis (vóc dáng, chiều cao, cân nặng) | **ĐANG CHẠY THẬT** | `body_analysis.py` |
| Dataset fit từ VITON-HD | **ĐÃ CÓ** | xem `provenance/viton_hd.manifest.json` |
| Môi trường train FLUX.2 Klein img2img | **ĐÃ DỰNG** | `/home/nhat/jp/ai/flux2-fit-train/.venv`, trainer `--help` chạy được |
| LoRA fit-refinement | **ACCEPTED OFFLINE (checkpoint 400)** | train đủ 600 bước; mốc 500/600 bị acceptance gate loại; mặc định không nạp vào runtime |
| Bộ hồi quy cân nặng (sklearn) | **MODEL_NOT_TRAINED** | chưa có dataset ảnh kèm chiều cao/cân nặng thật có license rõ |
| Fine-tune chính FASHN VTON 1.5 | **KHÔNG KHẢ THI** | repo FASHN trong máy chỉ có mã inference |

Chỉ được viết "đã fine-tune" khi có đủ: dataset hợp lệ + log train + checkpoint
`.safetensors` + ảnh validation + benchmark baseline↔LoRA. Thiếu bất kỳ thứ nào
thì gọi là **"fit-aware inference enhancement"**.

### Kết quả thực nghiệm 26/08/2026

- Dataset: 116 mẫu/21 danh tính; train 81/15, validation 18/3, test 17/3;
  chia theo danh tính và có đủ 7 lớp fit.
- Train: FLUX.2 Klein 4B LoRA rank/alpha 8, resolution 512, BF16, batch 1,
  gradient accumulation 4, 8-bit Adam, learning rate `1e-4`, 600 bước.
- Runtime train: 80,3 phút, peak VRAM 15,2 GB; checkpoint cuối 16.731.128 byte.
- Selection: checkpoint 600 và 500 bị loại; checkpoint 400 qua 6/6 tiêu chí trên
  8 mẫu validation thuộc 2 danh tính.
- Checkpoint 400: pass 100%, failure 0%, artifact 0%, body drift 0,1145,
  structure change 19,0849 và latency P50 14,54 giây. Baseline tương ứng là
  100%, 0%, 0%, 0,1148, 16,7195 và 13,43 giây.
- Runtime mặc định: adapter **không tự bật**. Chỉ cấu hình checkpoint cho một
  phiên nghiên cứu/evaluation phi thương mại, giới hạn ở `tops`, rồi xác nhận
  `/health` báo `adapterLoaded=true` và checkpoint hash đúng trước khi đo.
- Không dùng checkpoint này làm bằng chứng rằng FASHN đã được fine-tune hoặc
  thử đồ chân thật cho bottoms, dresses, kimono/haori và ảnh ngoài studio.

Đây là proxy tự động từ quality gate, không phải manual evaluation. Báo cáo chi
tiết và đường dẫn contact sheet nằm trong `models/fit_lora.status.json`.

## 0. Quy trình đầy đủ

```bash
V=/home/nhat/jp/ai/flux2-fit-train/.venv/bin/python

# 1) Sinh dữ liệu (cần japano-fashn đang chạy)
$V backend/ai_training/import_viton_hd_fit_sources.py --identities 20 --resume
#    sinh lại các mẫu từng bị cổng chất lượng loại, bằng seed khác:
$V backend/ai_training/import_viton_hd_fit_sources.py --identities 20 --resume \
     --retry-offset 1 --only-classes loose,very_loose

# 2) Kiểm tra dataset + môi trường, dựng dataset HF, in lệnh train
$V backend/ai_training/train_fit_lora.py --preflight

# 3) Pilot rồi mới train đầy đủ (tự dừng japano-fashn để nhường VRAM)
$V backend/ai_training/train_fit_lora.py --pilot
$V backend/ai_training/train_fit_lora.py --train --max-steps 600
$V backend/ai_training/train_fit_lora.py --resume

# 4) Benchmark baseline ↔ LoRA + acceptance gate
$V backend/ai_training/evaluate_fit_lora.py --baseline-steps 6 --lora-steps 6
```

## 1. Dataset fit (`fit_dataset/`)

```
fit_dataset/
  metadata.jsonl        # mỗi dòng một mẫu
  images/person/        # ảnh người đã mặc đồ bình thường (đầu vào)
  images/garment/       # ảnh sản phẩm
  images/target/        # ảnh ĐÚNG độ vừa vặn mong muốn (nhãn)
```

Một dòng `metadata.jsonl`:

```json
{"id":"sample_0001","personId":"an","person":"person/an_01.jpg","garment":"garment/haori.jpg","target":"target/an_01_tight.jpg","category":"tops","selectedSize":"S","recommendedSize":"XL","fitVerdict":"very_tight","severity":0.95,"effects":["fabric_tension","seam_stress","small_seam_split"]}
{"id":"sample_0002","personId":"binh","person":"person/binh_02.jpg","garment":"garment/kimono.jpg","target":"target/binh_02_loose.jpg","category":"one-pieces","selectedSize":"XXL","recommendedSize":"M","fitVerdict":"very_loose","severity":0.9,"effects":["dropped_shoulders","oversized_sleeves","extra_folds","wide_drape"]}
```

Bảy lớp bắt buộc phải có mặt: `good`, `slightly_tight`, `tight`, `very_tight`,
`slightly_loose`, `loose`, `very_loose`. Nên trải đều nam/nữ, nhiều vóc dáng,
nhiều tư thế, và đủ bốn nhóm trang phục (tops, bottoms, one-pieces, kimono/haori).

Chia tập:

```bash
python3 backend/ai_training/prepare_fit_dataset.py
```

Chia **theo danh tính người mẫu** (70/15/15) để một khuôn mặt không xuất hiện ở
cả train lẫn test — nếu không, điểm test chỉ phản ánh việc model học thuộc mặt.

## 2. Dataset vóc dáng (`body_dataset/`)

`body_dataset/labels.csv`:

```csv
image,height_cm,weight_kg,person_id
images/an_01.jpg,168,58,an
images/an_02.jpg,168,58,an
images/binh_01.jpg,175,72,binh
```

Chiều cao và cân nặng phải là **số thật do người trong ảnh cung cấp**. Train:

```bash
python3 backend/ai_training/train_body_estimator.py --extract   # trích đặc trưng
python3 backend/ai_training/train_body_estimator.py             # train + đo MAE/RMSE
```

So sánh RandomForest / GradientBoosting / MLP, chọn model có MAE thấp nhất trên
tập test tách theo danh tính, ghi `models/body_weight_estimator.joblib` và
`models/body_weight_estimator.metrics.json`. Bật khi chạy thật:

```bash
JAPANO_BODY_ESTIMATOR_MODEL=backend/ai_training/models/body_weight_estimator.joblib
```

Khi có model, `body_analysis.py` sẽ dùng nó **song song** với ước lượng thể tích
và lấy trung bình; không có model thì chỉ dùng thuật toán nhân trắc.

## 3. LoRA cho bước fit-refine

Môi trường train **tách hẳn** khỏi môi trường inference:

| | |
|---|---|
| venv train | `/home/nhat/jp/ai/flux2-fit-train/.venv` (`--system-site-packages`) |
| diffusers | editable từ `/home/nhat/jp/ai/diffusers-training` |
| trainer | `examples/dreambooth/train_dreambooth_lora_flux2_klein_img2img.py` |
| model gốc | `/home/nhat/jp/ai/FLUX.2-klein-4B` |

Lỗi `ImportError: cannot import name 'generate_aspect_ratio_buckets'` là do
Python nạp `diffusers` từ site-packages thay vì source clone chứa trainer. Cách
sửa **duy nhất đúng** là cài editable source đó vào venv train (đã làm), tuyệt
đối không xoá hàm khỏi trainer hay monkey patch.

Cấu hình pilot: resolution 512, batch 1, grad accum 4, rank 8, alpha 8, BF16,
gradient checkpointing, cache latents, CPU offload, 8-bit Adam, seed cố định,
checkpoint mỗi 100 steps, giữ tối đa 3.

Bật checkpoint cho service **sau khi** acceptance gate cho ACCEPTED:

```bash
JAPANO_FIT_LORA_PATH=/home/nhat/Downloads/japano/backend/ai_training/models/fit_lora
JAPANO_FIT_LORA_CATEGORIES=tops    # miền dữ liệu là upper-body
```

Adapter được nạp **đúng một lần** và cache theo (đường dẫn, hash checkpoint);
đổi checkpoint mới nạp lại. `/health` của service báo `fitLora.adapterLoaded`
và `fitLora.checkpointHash`.

## 4. Đo chất lượng

```bash
node backend/ai_training/evaluate_fit_classifier.js        # accuracy, macro F1, confusion matrix
python3 backend/ai_training/evaluate_tryon_manual.py --init  # bảng chấm tay
python3 backend/ai_training/evaluate_tryon_manual.py         # tổng hợp điểm đã chấm
```

* `evaluate_fit_classifier.js` đo mức **tuân thủ đặc tả** của bộ phân loại fit
  (nhãn do người viết theo bảng quy tắc nghiệp vụ), không phải cảm nhận người mặc.
* `evaluate_tryon_manual.py` là **manual evaluation** — mọi số ra từ đây phải
  được ghi rõ là do người chấm, không phải metric của model.

Chưa chấm thì script in `MANUAL_EVALUATION_EMPTY` thay vì bịa số.
