# Ước lượng vóc dáng từ ảnh — trạng thái và bằng chứng

Cập nhật 2026-08-28. Đây là tài liệu của bước **ảnh → chiều cao / cân nặng /
vòng 1 / vòng 2 / vòng 3 / size**. Phần fine-tune LoRA thử đồ nằm ở
`AI_FIT_TRYON.md`.

## Lỗi gốc (đã tái hiện được)

Ảnh người mẫu nữ gầy, áo đỏ dài tay, quần jean, cắt ngang đùi
(`/tmp/red-person-from-device.jpg`, 976×1320) — đầu ra TRƯỚC khi sửa:

| Đại lượng | Trước | Nhìn bằng mắt thì hợp lý là |
|---|---|---|
| Chiều cao | **200–210 cm** | 160–180 |
| Cân nặng | **110–120 kg** | 50–70 |
| Vòng ngực | **130–140 cm** | 70–100 |
| Vòng eo | **150–160 cm** | 60–90 |

Bốn nguyên nhân độc lập, tất cả đều đo được:

1. **Segmentation gộp hai cánh tay vào thân.** Từ y=460 đến y=1100 silhouette chỉ
   có MỘT đoạn liên tục rộng 460–503px, trong khi khoảng cách hai khớp hông chỉ
   214px. "Vòng eo" 497px thực chất là tay + thân + tay.
2. **Khớp đầu gối giả được dùng làm mốc đo.** Ảnh cắt ở y=1320; YOLO vẫn xuất đầu
   gối ở y=1303 và y=1319 với độ tin cậy 0.25/0.32. Hệ thống tưởng nhìn thấy đầu
   gối và ngoại suy chiều cao từ đó.
3. **Chiều dài đầu suy từ một hệ số cố định.** `(mắt − đỉnh đầu)/0.55` cho 208px
   trong khi đầu thật khoảng 233–278px. Hệ số đúng đo trên 6.479 khuôn mặt có
   nhãn là **0.511 ± 0.048**.
4. **Kẹp biên rồi nhân hằng số.** 8.61 đầu/thân bị kẹp còn 8.6 rồi nhân 24.0cm ⇒
   206.4cm. Kẹp về biên rồi trả một con số trông hợp lý là bịa, không phải đo.

Hệ quả dây chuyền: chiều cao sai 40cm làm mọi bề ngang quy ra cm sai theo, đặc
trưng lệch miền huấn luyện tới 8 độ lệch chuẩn, cổng out-of-distribution veto
model học máy, và nhánh dự phòng BMI tuyến tính trả 119.8 kg.

## Đã sửa những gì

| Bước | Trước | Sau |
|---|---|---|
| Bề ngang thân | đo thẳng trên silhouette | `body_geometry.torso_profile` — cắt tay bằng khung xương, hợp nhất với dự đoán từ khoảng cách khớp theo trọng số chọn bằng MAE |
| Mốc đo | mọi khớp YOLO xuất ra | loại khớp conf < 0.5 và khớp nằm trong 1.5% mép ảnh |
| Chiều dài đầu | một hệ số 0.55 | ba đường đo hợp nhất theo nghịch đảo phương sai, hệ số fit trên 6.479 mặt có nhãn |
| Chiều cao | head_count × 24cm, kẹp biên | hậu nghiệm của prior dân số cập nhật bằng cue ảnh; sai số tối thiểu 7–18% theo độ phủ ảnh |
| Cân nặng | ANSUR (bị veto) → BMI tuyến tính | BMI ← TỈ LỆ bề ngang (không cần thang cm) + ANSUR breadth, cả hai train lại trên đặc trưng làm nhiễu giống ảnh |
| Độ rộng quần áo | so viền thô với chính viền thô | bề ngang đã cắt tay so với khung xương, và là ĐẶC TRƯNG THỨ SÁU của model |
| Chốt chặn | chỉ kiểm tra đầu vào | thêm chốt giải phẫu trên ĐẦU RA (vòng đo, tỉ lệ giữa các vòng, BMI) |
| Sai lệch dân số | không xử lý | hiệu chuẩn tuyến tính fit trên BodyM train |

## Bằng chứng

### 1. Bề ngang thân — VITON-HD test (1.203 ảnh, split gốc của tác giả)

Ground truth: nhãn `image-parse-v3`, thân = silhouette − nhãn 14/15, chỉ tính
hàng có nhãn CẢ HAI cánh tay.

| Mốc | Baseline MAE | Mới MAE | Baseline MAPE | Mới MAPE | Mới trong 10% |
|---|---:|---:|---:|---:|---:|
| Ngực | 45.02 px | **23.00 px** | 16.64% | **7.95%** | 0.774 |
| Eo | 79.34 px | **17.44 px** | 34.77% | **10.32%** | 0.847 |
| Hông | 79.23 px | **20.50 px** | 31.22% | **9.96%** | 0.809 |

Riêng tập con "tay dính vào thân": eo 109.18 → 20.38 px, hông 97.02 → 23.14 px.

Chạy lại: `python3 backend/ai_training/evaluate_torso_extraction.py --split test`

### 2. Hồi quy — ANSUR II test (1.214 người, chia theo hàng = theo người)

| Mục tiêu | Điều kiện | Baseline | Mới |
|---|---|---:|---:|
| Cân nặng | số đo bằng thước | 3.13 kg | 6.93 kg |
| Cân nặng | **đặc trưng giống ảnh** | **24.96 kg** | **6.37 kg** |
| Vòng ngực | giống ảnh | 18.18 cm | **4.41 cm** |
| Vòng eo | giống ảnh | 19.02 cm | **5.51 cm** |
| Vòng hông | giống ảnh | 19.99 cm | **4.13 cm** |

Model mới KÉM HƠN ở điều kiện phòng thí nghiệm và TỐT HƠN 4 lần ở điều kiện chạy
thật. Đó là đánh đổi có chủ đích, và nó giải thích vì sao bản cũ phải veto model
bằng cổng out-of-distribution.

Chạy lại: `python3 backend/ai_training/compare_body_estimators.py --baseline-weight <cũ> --baseline-girth <cũ>`

### 3. Ảnh → số đo, end-to-end — BodyM testB (400 người, tách danh tính)

Đây là con số dự án CHƯA TỪNG có: sai số thật từ ảnh, không phải sai số bước hồi quy.

| Đại lượng | Baseline MAE | Mới MAE | Baseline bias | Mới bias | Bin 10 chứa sự thật |
|---|---:|---:|---:|---:|---:|
| Chiều cao | 20.01 cm | **6.44 cm** | **+16.57** | **−1.94** | 0.446 |
| Cân nặng | 15.99 kg | **9.00 kg** | +0.74 | −2.1 | 0.384 |
| Vòng ngực | 12.91 cm | **6.11 cm** | −2.17 | −1.0 | 0.480 |
| Vòng eo | 9.96 cm | **6.50 cm** | +5.26 | −1.5 | 0.480 |
| Vòng hông | 12.24 cm | **5.57 cm** | +6.19 | −1.3 | 0.525 |

Chạy lại: `python3 backend/ai_training/evaluate_body_pipeline.py --split testB`

### 4. Ảnh regression áo đỏ

| Đại lượng | Trước | Sau | Dải hợp lý |
|---|---|---|---|
| Chiều cao | 200–210 cm | **160–170 cm** | 160–180 ✓ |
| Cân nặng | 110–120 kg | **60–70 kg** | 50–70 ✓ |
| Vòng ngực | 130–140 cm | **90–100 cm** | 70–100 ✓ |
| Vòng eo | 150–160 cm | **80–90 cm** | 60–90 ✓ |
| Vòng hông | 150–160 cm | **100–110 cm** | — |

Đây là **cổng tỉnh táo**, không phải ground truth: không có số đo thật của người
trong ảnh, nên tuyệt đối không được báo cáo nó như accuracy.

## Tốc độ

| Giai đoạn | Trước | Sau | Ghi chú |
|---|---:|---:|---|
| Nạp YOLOv8n-pose | 0.85s / request | 0s | thường trú trong worker |
| Nạp + chạy U2Net | ~2.3s / request | ~0.15s | session dùng chung, thường trú |
| Suy luận + hồi quy | ~1.2s | ~0.2s | |
| **API `/stylist/body-analysis`** | **4.12s** | **0.35s** | P50 8 lượt; P90 0.37s |

Mục tiêu P50 ≤ 2s, P90 ≤ 4s — **đạt**. Nguyên nhân gốc: mỗi request sinh một
tiến trình Python mới và nạp lại hai model không đổi. Worker
`backend/body_analysis_service.py` giữ chúng thường trú; Node luôn có đường lùi
về `runAccessoryPipeline` nếu worker không chạy.

## Chưa đạt / hạn chế phải nói rõ

- **Chiều cao chủ yếu là prior khi ảnh không có vật chuẩn.** Với ảnh áo đỏ,
  trọng số của cue ảnh chỉ 0.168; phần còn lại là prior dân số. Kết quả được gắn
  `basis: population_prior`, `usableForSizing: false`, và KHÔNG được dùng để chốt
  size. Đây là giới hạn vật lý của ảnh đơn, không phải lỗi có thể sửa bằng model.
- **Bin 10 đơn vị chỉ chứa giá trị thật 38–52% số lần.** Yêu cầu hiển thị bin
  rộng đúng 10 là yêu cầu sản phẩm; độ phủ thật của nó là con số ở trên, và nó
  thấp. Khoảng bất định thật vẫn được giữ trong `uncertainty*`.
- **Chế độ áo phom rộng chưa đo được.** Không tìm được bộ ảnh nào có người mặc đồ
  rộng KÈM số đo thật. BodyM chụp đồ bó sát, VITON-HD không có số đo.
- **Sai số tách nền không nằm trong bất kỳ con số nào.** BodyM chỉ có silhouette
  nhị phân nên rembg không được chấm.
- **Nam kém hơn nữ** trên BodyM testB (cân nặng 16.78 vs 14.08 kg trước hiệu
  chuẩn). Chưa điều tra.
- **Hiệu chuẩn dân số kế thừa license phi thương mại của BodyM.** Tắt bằng
  `JAPANO_BODY_POPULATION_CALIBRATION=0`.

## Từ vựng

Bộ ước lượng cơ thể được gọi là **đã train lại** vì có đủ: dataset có manifest và
license (`body_dataset/provenance/`), log huấn luyện thật (optimizer chạy trên
6.068 hàng ANSUR × 5 bản augmentation), checkpoint kèm SHA-256 và metadata, tập
test tách theo danh tính, và so sánh baseline–ứng viên có quyết định promote.
