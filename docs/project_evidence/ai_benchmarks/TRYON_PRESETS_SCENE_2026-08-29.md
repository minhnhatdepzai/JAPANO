# Mẫu thử nhanh, cache thử đồ và ghép ảnh phong cảnh — 2026-08-29

Phần cứng: NVIDIA GeForce RTX 5060 Ti, 16 GB VRAM. Backend `japano-backend` :4100,
`japano-fashn` :7862, `japano-body-analysis` :7863 (CPU). Mọi số đo dưới đây lấy
bằng `curl` gọi thẳng API thật, đo tường (`date +%s%3N`) chứ không đọc lại đồng
hồ nội bộ của service. Mỗi lượt chạy TUẦN TỰ — không bao giờ có hai request GPU
cùng lúc.

Đây là **tối ưu suy luận và bộ nhớ đệm**, KHÔNG phải fine-tune. Không có dataset
huấn luyện mới, không có optimizer step, không có checkpoint nào được sinh ra.

## 1. Ma trận mẫu thử nhanh × trang phục (cache trống)

| Mẫu | Sản phẩm | Cỡ | HTTP | Giây | Engine |
|---|---|---|---|---|---|
| nu-thanh-manh | kimono-hong | M | 200 | 38.6 | fashn-vton-1.5 |
| nu-can-doi | haori-dang-dai | M | 200 | 60.1 | fashn-vton-1.5 + flux2-klein-4b-fidelity |
| nu-nang-dong | yukata-xanh | M | 200 | 37.9 | fashn-vton-1.5 |
| nu-mem-mai | ao-len-co-lo | L | 200 | 53.1 | fashn-vton-1.5 |
| nam-can-doi | blazer-kaki | M | 200 | 65.5 | fashn-vton-1.5 + fit:tight |
| nu-thanh-manh | bikini-hoa-anh-dao (hai mảnh) | M | 200 | 27.3 | flux2-klein-4b-two-piece-swimwear |
| nu-mem-mai | do-boi-mot-manh-song | L | 200 | 67.1 | fashn-vton-1.5 + fit:very_tight |

7/7 trả ảnh thật, không lượt nào bị `GPU_JOB_CANCELLED`, không lượt nào có cảnh
báo danh tính. Ảnh đã được xem bằng mắt, không chỉ đọc mã HTTP.

Lượt bikini hai mảnh đo được **83.1 giây** ở lần chạy đầu tiên trong phiên (FLUX
phải nạp vào VRAM) và **27.3 giây** khi FLUX đã thường trú. Con số 27.3 là điều
kiện "máy đã ấm"; 83.1 là điều kiện nguội. Cả hai đều là số thật, khác nhau ở
trạng thái VRAM chứ không ở tham số.

### Hành vi theo cỡ

Hai lượt cuối là bằng chứng cho quy tắc size-aware, không phải hiệu ứng trang trí:

* `nam-can-doi` (khoảng 60-70 kg) mặc blazer cỡ M → `verdict: tight`, gợi ý **XL**.
* `nu-mem-mai` (khoảng 70-80 kg) mặc áo tắm cỡ L → `verdict: very_tight`, gợi ý **XXL**.

Ảnh kết quả cho thấy nếp kéo căng và cúc bị kéo lệch đúng ở vùng chịu lực.

## 2. Cache kết quả (chỉ áp dụng cho mẫu dựng sẵn)

Cùng một `presetId + productId + size`, chạy hai lần liên tiếp:

| Lần | Thời gian tường | `cached` | Byte ảnh |
|---|---|---|---|
| 1 (cache trống) | **40 760 ms** | false | 1 190 454 |
| 2 (trúng cache) | **27 ms** | true | 1 190 454 |

Ảnh hai lần **giống hệt nhau từng byte**. Đổi cỡ sang `L` không trúng cache, đúng
như thiết kế khoá.

Cache nằm trên đĩa (`backend/data/tryon-cache/`), **không** ghi vào MongoDB, và
chỉ nhận kết quả của mẫu dựng sẵn. Ảnh do khách tải lên không bao giờ được lưu:
đó là ảnh cá nhân. Kết quả có cảnh báo chất lượng hoặc danh tính cũng không được
cache — đóng băng một ảnh hỏng sẽ trả lại đúng ảnh hỏng đó cho mọi khách sau.

## 3. Bỏ qua cổng 18+ cho ảnh đã duyệt

Với trang phục cần xác minh 18+, đường thường phải gọi model thị giác qua Ollama.
Ghi chú trong `routes/tryon.js` cho biết bước nạp lại model này từng đo được **67
giây** rồi quá hạn. Ảnh preset đã được người vận hành duyệt và được đối chiếu
SHA-256 ngay trong request, nên nhánh preset bỏ qua bước hỏi lại đó.

Đây là miễn trừ cho **đúng những byte đã duyệt**, không phải tắt cổng an toàn:

* `presetId` lạ → HTTP 404, không rơi về mẫu mặc định.
* `presetId` dạng `../../../etc/passwd` → HTTP 404.
* File trên đĩa bị đổi nội dung → SHA-256 lệch → luồng đóng lại, không trả ảnh.
* Ảnh khách tải lên vẫn đi trọn cổng 18+ như cũ.

Bảy trường hợp trên có bài kiểm tra trong `backend/test/tryon-presets.test.js`.

## 4. Ghép ảnh vào phong cảnh Nhật Bản

Đường mặc định **không dùng GPU và không dùng model sinh ảnh**. Người được tách
bằng U2Net (phiên đã ấm trong worker) rồi đặt lên ảnh thật của địa điểm, nên
khuôn mặt, cơ thể, màu da và trang phục giữ nguyên từng pixel.

| Đầu vào | Địa điểm | HTTP | Thời gian |
|---|---|---|---|
| Mẫu `nu-can-doi` | Đền Fushimi Inari (Kyoto) | 200 | **912 ms** |
| Ảnh kết quả thử đồ kimono | Rừng tre Arashiyama (Kyoto) | 200 | **1 195 ms** |

Cả hai đều dưới ngưỡng 5 giây rất xa. Chuỗi đầy đủ đã chạy thật: chọn mẫu → thử
kimono trên GPU → ghép vào rừng tre.

Kiểm soát an toàn: app chỉ gửi **tên địa điểm**; địa chỉ ảnh nền do máy chủ tự
tra trong `backend/lib/japanSceneBackgrounds.js`. Tải ảnh nền bị giới hạn ở
HTTPS + đúng một host (`upload.wikimedia.org`). `backend/test/japan-scene.test.js`
kiểm rằng `http://`, host lạ, `127.0.0.1`, `169.254.169.254`, `file://` và
`upload.wikimedia.org.evil.com` đều bị chặn.

## 5. Lỗi thật đã sửa trong lúc dựng bộ mẫu

Chạy pipeline đo cơ thể trên 5 ảnh mẫu làm lộ một lỗi có sẵn: hiệu chuẩn dân số
cập nhật `valueKg` nhưng bỏ quên `uncertaintyMinKg/MaxKg` và `displayBinKg`. Ảnh
người mẫu ngoại cỡ trả về:

```
valueKg 79.4 | minKg 70 | maxKg 80
uncertaintyMinKg 48 | uncertaintyMaxKg 65 | displayBinKg [50, 60]
```

Điểm ước lượng 79.4 nằm **ngoài** khoảng bất định 48-65 của chính nó, và bin hiển
thị nói 50-60 kg. Hệ quả không chỉ là hiển thị sai — gợi ý cỡ đọc phải con số của
một cơ thể khác. Sau khi sửa, cùng ảnh đó trả `79.4 kg`, bin `70-80`, khoảng
`71-88`. Bài kiểm tra hồi quy:
`backend/test/python/test_weight_calibration_consistency.py`.

## 6. Số đo của 5 mẫu dựng sẵn

Đây **không** phải số đo khai báo của người thật — người mẫu là ảnh dựng. Chúng
là đầu ra của chính `body_analysis.py` chạy trên đúng file JPEG trong
`mobile/assets/tryon-presets/`, làm tròn về bin 10 đơn vị như UI vẫn hiển thị.

| id | Cao (cm) | Nặng (kg) | Vòng 1 | Vòng 2 | Vòng 3 |
|---|---|---|---|---|---|
| nu-thanh-manh | 160-170 | 50-60 | 80-90 | 70-80 | 90-100 |
| nu-can-doi | 160-170 | 60-70 | 90-100 | 70-80 | 90-100 |
| nu-nang-dong | 160-170 | 50-60 | 80-90 | 70-80 | 90-100 |
| nu-mem-mai | 150-160 | 70-80 | 100-110 | 90-100 | 110-120 |
| nam-can-doi | 160-170 | 60-70 | 90-100 | 80-90 | 100-110 |

## 7. Cổng kiểm thử

```
npm run check   →  305 test Node, TypeScript mobile sạch, 102 test Python (2 skip sẵn có)
git diff --check →  sạch
```

## 8. Chưa kiểm chứng

* **Chưa có thiết bị OPPO A78 kết nối trong phiên này** (`adb devices` trống), nên
  luồng nhìn thấy trên máy thật và bước cài đè chưa được xác minh: **device-unverified**.
* Chuyển động (motion) không nằm trong phạm vi phiên này; số liệu vẫn là của
  `MOTION_INFERENCE_2026-08-29.md`.
* Đường "điện ảnh" bằng AI cho ghép cảnh chưa được dựng; hiện chỉ có đường ghép
  bằng tách nền.
