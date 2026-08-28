# Khảo sát dataset cho bài toán ẢNH → SỐ ĐO CƠ THỂ (JAPANO)

Cập nhật: 2026-08-28. Người khảo sát: phiên làm việc sửa lỗi ước lượng 206cm/119kg.

Mục tiêu: tìm dữ liệu hợp pháp để (a) huấn luyện/hiệu chuẩn bước đo cơ thể từ một
ảnh, và (b) **đo được sai số thật** của nó. Trước khảo sát này, dự án chỉ có ANSUR
II — một bảng số đo KHÔNG có ảnh — nên mọi con số MAE từng công bố đều là sai số
của riêng bước hồi quy, không phải sai số từ ảnh.

## Bảng đánh giá

| Dataset | Ảnh người? | Chiều cao thật | Cân nặng thật | Vòng ngực/eo/hông | SMPL/3D | Có identity để chia tập | Đa dạng vóc dáng | Ảnh mặc đồ rộng | License | Dùng thương mại | Kết luận |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **ANSUR II** (US Army 2012) | ❌ chỉ CSV | ✅ | ✅ | ✅ (93 số đo) | ❌ | ✅ 1 hàng = 1 người | Quân nhân Mỹ, BMI 15–43.5 | ❌ | CC0-1.0 | ✅ được | **ĐANG DÙNG** — prior nhân trắc + hồi quy số-đo→cân-nặng/vòng. KHÔNG đo được sai số từ ảnh. |
| **BodyM** (Amazon, arXiv 2210.05667) | ✅ silhouette nhị phân (chính diện + nghiêng) | ✅ | ✅ | ✅ 14 số đo | ❌ | ✅ `subject_id`, 3 tập người rời nhau | 2.505 người, có testB "ngoài phòng lab" | ❌ mặc đồ bó sát | CC-BY-NC-4.0 | ❌ **phi thương mại** | **ĐANG DÙNG** — bộ DUY NHẤT đo được sai số end-to-end. Xem `bodym.manifest.json`. |
| **VITON-HD** (Zalando) | ✅ RGB 768×1024 | ❌ | ❌ | ❌ | ❌ (có DensePose dạng ảnh màu, không giải mã được nhãn) | ⚠️ chỉ có split train/test của tác giả | Người mẫu thời trang, gần như toàn dáng thon | ✅ nhiều kiểu áo | CC-BY-NC-SA-4.0 | ❌ phi thương mại + ShareAlike | **ĐANG DÙNG** — nhãn `image-parse-v3` tách tay/thân/mặt, dùng hiệu chuẩn hình học. Không có số đo. |
| **SURREAL** (INRIA/MPI) | ✅ render tổng hợp, 6M frame | ⚠️ suy từ mesh | ❌ | ⚠️ phải tự đo trên mesh | ✅ SMPL | ✅ theo chuỗi MoCap | Shape lấy từ CAESAR, đa dạng | ⚠️ texture quần áo dán phẳng, không có vải rủ thật | Yêu cầu ký thoả thuận, **research-only** | ❌ | **KHÔNG DÙNG lần này** — chi phí dựng pipeline render lớn; giữ làm hướng nếu cần synthetic. |
| **AGORA** (MPI) | ✅ render từ scan có quần áo, 173K crop | ⚠️ từ SMPL-X | ❌ | ⚠️ tự đo trên mesh | ✅ SMPL-X | ✅ | 4.240 scan, có cả trẻ em | ✅ quần áo thật | Phải đăng ký + ký license, **phi thương mại** | ❌ | **KHÔNG DÙNG lần này** — cần đăng ký thủ công, không tự động hoá được trong phiên. |
| **UniqueData/body-measurements-dataset** (HF) | ✅ 315 ảnh | ❌ | ❌ | ❌ (chỉ có `label` ClassLabel) | ❌ | ❌ | không rõ | không rõ | CC-BY-**ND**-NC-4.0 | ❌ | **LOẠI** — ND cấm tạo tác phẩm phái sinh (kể cả checkpoint), và không hề có số đo. |
| **ud-biometrics/body-measurements-image-dataset** (HF) | ✅ <1K ảnh | ❌ | ❌ | ❌ | ❌ | ❌ | không rõ | không rõ | CC-BY-NC-ND-4.0 | ❌ | **LOẠI** — tag thực chất là nhận dạng bàn tay/lòng bàn tay, không phải số đo cơ thể. |
| **CAESAR** | ⚠️ scan 3D | ✅ | ✅ | ✅ | ✅ | ✅ | Tốt | ❌ | Thương mại, trả phí | ✅ nếu mua | **LOẠI** — phải mua license, ngoài phạm vi đồ án. |

## Quyết định và lý do

1. **ANSUR II giữ vai trò prior, không phải nguồn ảnh→số đo.** Đúng như yêu cầu:
   nó chỉ dùng cho ánh xạ *số đo vật lý → cân nặng/vòng đo* và cho phân bố nhân
   trắc. Mọi MAE của nó phải ghi rõ là sai số bước hồi quy.

2. **BodyM là bộ cho phép nói câu "sai số từ ảnh là bao nhiêu".** Có
   `subject_id`, và ba tập `train`/`testA`/`testB` là ba nhóm người rời nhau nên
   chia theo danh tính là sẵn có, không phải tự chế. `testB` được tác giả cố ý
   chụp trong điều kiện ít kiểm soát — dùng làm tập báo cáo chính.

3. **VITON-HD dùng cho phần hình học, không cho phần số đo.** Nhãn parsing của
   nó tách được tay khỏi thân, đúng thứ cần để sửa lỗi gốc.

## Ràng buộc license phải nhớ khi phát hành

- BodyM (CC-BY-NC-4.0) và VITON-HD (CC-BY-NC-SA-4.0) đều **phi thương mại**.
- Mọi hằng số hiệu chuẩn và checkpoint fit trên hai bộ này **thừa hưởng ràng buộc
  đó**. Bản thương mại của JAPANO không được dùng chúng nếu chưa thay bằng dữ
  liệu có license phù hợp.
- ANSUR II là CC0-1.0 nên phần prior/hồi quy suy từ nó **không** bị ràng buộc.
- Cụ thể: `body_geometry.calibration.json` (VITON-HD) và
  `bodym_population_calibration.json` (BodyM) là hai file phi thương mại.
  `body_weight_estimator.joblib`, `body_girth_estimators.joblib`,
  `body_bmi_estimator.joblib` và `anthropometry.json` chỉ từ ANSUR II.

## Hạn chế còn lại (chưa giải quyết được)

- **Không tìm được bộ ảnh RGB người MẶC QUẦN ÁO RỘNG kèm số đo thật.** BodyM chụp
  đồ bó sát; VITON-HD có quần áo nhưng không có số đo. Vì vậy sai số ở chế độ
  "áo phom rộng" — đúng chế độ mà khách JAPANO hay chụp — **vẫn chưa đo được**.
- BodyM chỉ có silhouette nhị phân, nên sai số của bước tách nền (rembg) không
  nằm trong bất kỳ con số nào ở đây.
- Không bộ nào có dân số Việt Nam. Prior chiều cao đang để rộng (sd 9–10cm) để
  không kéo sai một nhóm nào, và đó là lựa chọn có ý thức, không phải hiệu chuẩn.
