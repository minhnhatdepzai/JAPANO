# Bàn giao — thí nghiệm fine-tune LoRA fit-refinement

> Cập nhật lần cuối: xem `models/fit_lora.status.json` (`updatedAt`).
> **Không có secret nào trong file này.** Credential Kaggle nằm ở
> `kaggle.json` (đã `chmod 600`, đã ignore trong `.gitignore` và
> `.git/info/exclude`) — không đọc, không in, không commit.

## 1. Trạng thái hiện tại

Nguồn sự thật duy nhất: `backend/ai_training/models/fit_lora.status.json`.

```bash
cat backend/ai_training/models/fit_lora.status.json
```

Các trạng thái hợp lệ: `MODEL_NOT_TRAINED` → `PILOT_RUNNING` → `PILOT_PASSED`
→ `TRAINING` → `TRAINED` → (`ACCEPTED` | `REJECTED` | `EVALUATION_FAILED`).

## 2. Vị trí mọi thứ

| Thứ | Đường dẫn |
|---|---|
| Dataset gốc VITON-HD | `/home/nhat/jp/datasets/viton-hd` (ngoài Git, 5.25 GB) |
| Provenance + license | `backend/ai_training/provenance/viton_hd.manifest.json` |
| Fit dataset JAPANO | `backend/ai_training/fit_dataset/` (metadata.jsonl + images/) |
| Dataset HF (parquet) | `/home/nhat/jp/datasets/japano-fit-hf/{train,validation,test}` |
| Venv train | `/home/nhat/jp/ai/flux2-fit-train/.venv` |
| Source diffusers | `/home/nhat/jp/ai/diffusers-training` (editable, SHA trong status JSON) |
| Trainer | `.../examples/dreambooth/train_dreambooth_lora_flux2_klein_img2img.py` |
| Model gốc | `/home/nhat/jp/ai/FLUX.2-klein-4B` |
| Checkpoint LoRA | `backend/ai_training/models/fit_lora/` (Git-ignored) |
| Log train | `/home/nhat/jp/logs/fit-lora-{pilot,full}.log` |
| TensorBoard | `/home/nhat/jp/logs/fit-lora-tb` |
| Kết quả đánh giá | `backend/ai_training/evaluation/run-*/metrics.json` |

## 3. Lệnh tiếp tục

```bash
cd /home/nhat/Downloads/japano
V=/home/nhat/jp/ai/flux2-fit-train/.venv/bin/python

# Kiểm tra dataset + môi trường, dựng lại dataset HF, in lệnh train đã resolve
$V backend/ai_training/train_fit_lora.py --preflight

# Pilot (30 steps, 21 mẫu cân bằng lớp) — bắt buộc pass trước khi train đầy đủ
$V backend/ai_training/train_fit_lora.py --pilot

# Train đầy đủ
$V backend/ai_training/train_fit_lora.py --train --max-steps 600

# Tiếp tục từ checkpoint gần nhất
$V backend/ai_training/train_fit_lora.py --resume

# Benchmark baseline vs LoRA + acceptance gate (tự bật/tắt adapter ở service)
$V backend/ai_training/evaluate_fit_lora.py --baseline-steps 6 --lora-steps 6
```

Sinh thêm dữ liệu (cần `japano-fashn` đang chạy):

```bash
$V backend/ai_training/import_viton_hd_fit_sources.py --identities 40 --resume
```

## 4. Kỷ luật GPU

GPU 16 GB, dùng chung với một dự án khác đang giữ ~5 GB.

- `train_fit_lora.py --pilot/--train` **tự dừng** `japano-fashn` và
  `japano-motion` trước khi train, rồi **tự bật lại** `japano-fashn` sau đó.
  Dùng `--keep-services` để tắt hành vi này.
- Không bao giờ chạy trainer song song với inference.
- Full train mặc định không cache latent ảnh và giới hạn caption 64 token; cache
  toàn bộ 81 ảnh/caption từng làm GPU OOM. `--cache-latents` chỉ dành cho pilot nhỏ.
- Không kill process GPU lạ (`/usr/local/bin/python` pid 5888-5893 là của dự án
  khác, `gnome-remote-desktop-daemon` là phiên RDP của người dùng).

## 5. Việc còn lại / rủi ro đã biết

- Số mẫu hiện tại là mức khởi động. Muốn kết quả chắc hơn: tăng identity bằng
  `import_viton_hd_fit_sources.py --identities 40 --resume`.
- Target các lớp tight/loose là **ảnh synthetic** do chính fit-refiner sinh ra
  (self-distillation), **không phải nhãn người chấm**.
- Miền dữ liệu là **upper-body**. `JAPANO_FIT_LORA_CATEGORIES=tops` phải giữ
  nguyên cho tới khi có validation trên bottoms/kimono/one-pieces.
- License VITON-HD là **CC-BY-NC-SA-4.0**: phi thương mại + ShareAlike.
  Checkpoint sinh ra từ dữ liệu này kế thừa ràng buộc đó.

## 6. Test đã có

```bash
npm run check                                     # backend + mobile + python
node backend/ai_training/evaluate_fit_classifier.js
/home/nhat/jp/ai/fashn-vton-1.5/.venv/bin/python -m unittest discover -s backend/test/python -v
```

Bộ test bảo vệ đúng những chỗ dễ nói dối: trạng thái `TRAINED` khi trainer lỗi,
rò identity giữa train/test, adapter nạp lại mỗi request, secret lọt vào log.
