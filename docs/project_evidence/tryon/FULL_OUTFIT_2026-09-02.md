# Thử nguyên bộ + ghép cảnh Nhật — 2026-09-02

Thực hiện theo skill `japano-full-outfit-tryon` và prompt
`PROMPT_CLAUDE_FULL_OUTFIT_TRYON.md`. Mọi kết luận dưới đây đến từ **lượt chạy
thật trên GPU**, không suy từ mã nguồn.

- Ảnh: `test-results/tryon/2026-09-02/{diagnosis,scenes,storefront}/`
- Nhánh `main`, 179 tệp dirty có sẵn từ phiên khác được giữ nguyên; không
  commit/push.
- Môi trường: `japano-backend` :4100, `japano-fashn` :7862, `japano-body-analysis`
  :7863, storefront dev :4200 trỏ `JAPANO_API_ORIGIN=http://127.0.0.1:4100`.

---

## 1. Chẩn đoán: lỗi bạn báo KHÔNG phải lỗi nguy hiểm nhất

Ảnh đầu vào: người mẫu mặc **áo dài tay đỏ kín cổ + quần đen** rõ ràng
(`test-assets/people/average/00858_00.jpg`). Thử `haori-dang-dai` (áo khoác ngoài).

Kết quả (`result-haori-dang-dai.png`, 60,1s):

- **Quần đen vẫn còn.** Lỗi "thử áo xong mất quần" không xảy ra ở một lượt đơn.
- **Áo đỏ bên trong bị xoá sạch.** Ảnh trả về là người mặc haori trên **da trần**,
  hở ngực tới rốn.
- Cổng an toàn báo **`coverageCheck.ok = true`**, thông điệp cho khách là "kết quả
  đã qua kiểm tra chất lượng".

Đo trực tiếp bằng `coverage_quality` trên đúng cặp ảnh đó:

| Vùng | Trước | Sau | Tăng |
|---|---:|---:|---:|
| **chest** (bắt buộc kín) | 0.0014 | **0.1422** | **+0.1408** |
| pelvis (bắt buộc kín) | 0.0063 | 0.0497 | +0.0434 |
| buttocks (bắt buộc kín) | 0.0313 | 0.1041 | +0.0728 |

Điều kiện chặn của cổng là `after > 0.34 **và** gain > 0.10`. Ngực tăng **gấp
~100 lần** nhưng 0.1422 không vượt 0.34 nên **lọt**. Lý do: ngưỡng chấm **trung
bình cả ô ngực**, mà áo khoác mở trước chỉ hở một dải giữa — vải hai bên kéo
trung bình xuống.

Đây là **lỗi âm tính giả của cổng an toàn**, nghiêm trọng hơn lỗi thẩm mỹ được báo.

---

## 2. Đã sửa, có bằng chứng

### 2a. Cổng độ che phủ — lỗ hổng "đang mặc thành không mặc"

`backend/accessory_pipeline.py :: coverage_quality`. Thêm nhánh thứ hai bên cạnh
ngưỡng tuyệt đối cũ, đo trên **lõi bảo vệ** thay vì cả ô:

```python
undressed = before_core < 0.06 and after_core > 0.12 and core_gain > 0.08
required_exposed = absolute_exposed or undressed
```

Phải dùng lõi vì các ô cạnh nhau chồng lấn: bản đầu tiên chấm cả ô đã làm
**quần short hở chân (hợp lệ) bị chặn oan** — chính test
`test_quan_short_ho_chan_la_hop_le` bắt được. Lõi mông/chậu là 58% phía trên nên
da từ đùi không lọt vào.

| Kiểm chứng | Kết quả |
|---|---|
| Ảnh thật đã lọt trước đó | **`ok: False`, `required_zone_exposed:chest`** |
| Quần/mông trong cùng ảnh đó | không bị bắn nhầm |
| `test_coverage_quality.py` | 23/23 pass (thêm 2 ca mới) |

Hai ca mới: một ca hở dải giữa **dưới ngưỡng 0.34 cũ** phải bị chặn, và một ca
đối chứng cổ áo hở rất ít phải **không** bị chặn.

### 2b. Giày dép — đã ghép được, trước đó bị bỏ im lặng

Trước: `skippedAccessories: ["Dép quai Nhật"]`. Đôi dép **đã được đặt đúng chỗ**
(`feetDiff 33.1`) nhưng lượt "làm đẹp" FLUX vẽ lại **cả khung ảnh**, làm trôi mặt
và trang phục, nên cổng chất lượng loại toàn bộ.

Sửa: thêm mode `confine_accessory_region` — vùng phụ kiện suy ra từ chính chỗ
`rough` khác `clean` (không cần mỗi hàm `add_*` trả thêm toạ độ), giữ nét FLUX
trong vùng đó, phần còn lại lấy nguyên từ ảnh quần áo sạch.

| Chỉ số | Trước | Sau |
|---|---:|---:|
| `faceDiff` | 74.747 | **0** |
| `garmentDiff` | 73.502 | **0** |
| `feetDiff` | 33.062 | 17.166 |
| `score` | 383.448 | **0** |
| Kết quả | bị loại | **`appliedAccessories: [{kind: "shoe"}]`** |

Ảnh: `result-kimono-hong__acc-giay-dep.png` — giày hiện rõ trên chân, mặt và
kimono không đổi một pixel.

### 2c. Slot cơ thể + gợi ý món còn thiếu

Trước khi sửa, `giay-dep`, `guoc-geta`, `vo-tat` đều rơi vào profile mặc định và
bị phân loại **`zone=upper, layer=upper-base`** — hệ thống tưởng đôi dép là cái áo.
Và `outfit.js` suy vai trò theo **danh mục**, không hề có "quần" hay "giày", nên
không chỗ nào trả lời được câu "bộ này thiếu gì".

Thêm `backend/lib/outfitSlots.js` (cầu nối giữa `garmentCoverage.js` và
`outfit.js`) + `suggestForMissingSlots()` dùng lại đúng công thức chấm điểm cũ
(hoà sắc HSL 0.4 + tương đồng tag 0.35 + thịnh hành 0.25), mở qua
`GET /api/outfits/completeness`.

Chạy thật:

```
?productIds=haori-dang-dai
  complete: false | filled: ["upper-outer"]
  [REQUIRED] upper-base — Bạn đang chọn áo khoác ngoài mà chưa có áo lớp trong.
        → ao-len-co-lo (0.4695), so-mi-trang (0.442)
  [REQUIRED] lower  → hakama-nu (0.5046), hakama-nu-tim (0.4986)
  [OPTIONAL] feet   → guoc-geta (0.6261), tabi-chia-ngon (0.5211)

?productIds=kimono-hong                → complete: true, chỉ còn gợi ý giày
?productIds=kimono-hong,haori-dang-dai → CONFLICT: bộ liền thân không mặc chồng
```

Mức `required` cho "áo khoác mà thiếu áo lớp trong" **chính là đầu vào đã sinh ra
ảnh hở ngực ở mục 1** — nói trước rẻ hơn nhiều so với để khách chờ 60-80 giây GPU
rồi bị cổng an toàn chặn.

Test: `backend/test/outfit-slots.test.js`, 8/8 pass.

### 2d. Storefront bắt kịp app

App đã gửi `productIds` + `accessoryIds` từ lâu; storefront mới gửi một
`productId`. Đã thêm: chọn nhiều món, chọn giày/phụ kiện, và khối gợi ý theo chỗ
còn thiếu (gọi `/api/outfits/completeness` **trước** khi tạo ảnh).

Chụp thật ở 1440×900 và 390×844 (`storefront-tryon-*.png`): 0 tràn ngang, hiện
đủ 2 khối chọn + 3 khối gợi ý với sản phẩm thật.

Một lỗi UX tự gây ra rồi tự sửa: đổ hết 70 sản phẩm thành chip làm trang thử đồ
dài **10.478px** trên điện thoại; giới hạn vùng chọn thành khu cuộn 148px → còn
7.518px.

### 2e. Thêm 2 địa điểm Nhật Bản

35 → **37 địa điểm**, 38/38 scene đạt validator.

| Địa điểm | Ảnh | Giấy phép | Vì sao dùng được |
|---|---|---|---|
| Đền Meiji Jingu (Tokyo) | 4592×3448 | CC BY-SA 4.0, Zairon | Lối sỏi ngang tầm mắt, người đứng giữa hai cột torii |
| Cầu Kintai-kyō (Yamaguchi) | 5274×3162 | CC BY 3.0, Sailko | Bãi sỏi rộng suốt tiền cảnh, có người thật làm mốc tỉ lệ |

**Bị loại dù giấy phép và độ phân giải đều tốt:** ảnh Kiyomizu-dera 5852×3601
CC BY-SA 4.0 — chụp từ trên cao qua thung lũng, tiền cảnh là ngọn cây, không ai
đứng vào được. Đúng kiểu lỗi Naoshima mà dự án đã ghi lại.

Đã cập nhật đồng bộ cả ba nơi: `japanScenes.js` (hình học),
`japanSceneBackgrounds.js` (URL ảnh), `mobile/lib/japanSpots.ts` (spot), cộng
`Yamaguchi` vào bản đồ vùng miền.

### 2f. Ghép cảnh — chỉnh theo số đo, không theo cảm tính

Lượt ghép đầu vào Meiji Jingu đặt **đúng chỗ đứng** nhưng nhân vật cao gấp ~3,5
lần nhóm khách đứng cùng lối sỏi → đọc ra như người khổng lồ. Hạ
`personHeightRatio.preferred` 0.54 → **0.38** và nâng `shadowOpacity` 0.16 →
**0.30**; ảnh sau khớp phối cảnh.

Thời gian ghép: **531–639 ms** (không GPU, không model sinh ảnh).

---

## 3. CHƯA sửa được — nói thẳng

### Mặc chồng nhiều món vẫn rơi món thứ hai

Chạy `so-mi-trang + hakama-nu` (áo lớp trong + quần), 3 lần:

```
garments:        [hakama-nu]
skippedGarments: ["Sơ mi trắng tay ngắn"]
attempts: Mặc chồng lượt 1 bị chặn: face_changed_or_covered, body_changed_not_garment
          Mặc chồng lượt 2 bị chặn: face_changed_or_covered, body_changed_not_garment
```

**Đây mới đúng là lỗi "mất món" bạn báo** — chỉ là mất áo chứ không mất quần.

Tôi đã thử vá bằng cách khôi phục khuôn mặt từ ảnh lượt trước (thêm mode
`restore_face` dò pose trên chính ảnh đó, vì ô mặt tính từ pose ảnh gốc rơi trật
chỗ khi FASHN đặt lại vị trí nhân vật). Mode chạy đúng (`applied: True`, box hợp
lệ) nhưng **kết quả không đổi**: vẫn `face_changed_or_covered` +
`body_changed_not_garment`.

Kết luận: lượt FASHN thứ hai **dựng lại tư thế và tỉ lệ người**, nên hình học trôi
(`eyeSpan/eyeToNose/noseY/torso`) chứ không chỉ pixel mặt. Khôi phục pixel không
cứu được. Đây là vấn đề ở mức sinh ảnh khi nối chuỗi nhiều lượt, không phải ở
khâu ghép.

**Đã gỡ bỏ bản vá không hiệu quả** thay vì để lại một bước tốn thêm một tiến trình
Python mỗi lượt mà không đo được lợi ích.

Cái đã tốt lên: khách **được báo** món nào không lên ảnh (`skippedGarments` + khối
`outfit` mới trong phản hồi), thay vì lặng lẽ nhận một ảnh thiếu món.

### Ảnh ghép cảnh chưa đạt mức "như ảnh du lịch thật"

Còn **quầng sáng viền quanh chân** — nền studio của ảnh try-on lọt qua mask U2Net.
Đây là chất lượng phân đoạn, không phải hình học, và tôi chưa sửa. Bóng đổ trên
sỏi/nền tối vẫn khó thấy.

### Chưa xác minh trên thiết bị

`adb devices` trống suốt phiên. **Không có bằng chứng nào cho app Expo.** Không
dựng emulator vì bộ nhớ dự án ghi rõ việc đó từng làm sập phiên remote desktop.
Phần app chỉ được bảo đảm ở mức typecheck sạch và API dùng chung.

---

## 4. Độ trễ đo được

| Luồng | Thời gian |
|---|---|
| 1 món (haori) | 60,1 s / 81,5 s |
| 1 món + 1 phụ kiện (kimono + dép) | 65,9 s |
| 2 món (áo + quần, món 2 bị loại) | 66,2–72,4 s |
| Ghép cảnh Nhật | 0,53–0,64 s |
| `/api/outfits/completeness` | ~245 ms |

Bước khu trú vùng phụ kiện thêm một tiến trình Python nhưng **không làm lượt
kimono+dép chậm hơn** (63,5 s trước → 65,9 s sau, nằm trong dao động giữa các lượt).

---

## 5. Kiểm thử

| Lệnh | Trước | Sau |
|---|---|---|
| `npm --workspace backend test` | 359 pass | **367 pass** (+8) |
| `npm run test:python` | 104 pass | **106 pass** (+2) |
| `npm --workspace mobile run typecheck` | sạch | sạch |
| `cd web && npx tsc --noEmit` | sạch | sạch |
| `cd web && npm run lint` | 0 cảnh báo | 0 cảnh báo |
| `cd web && npm run build` | OK | OK |
| `node scripts/validate_japan_scenes.js` | 36/36 | **38/38** |

`PIPELINE_VERSION` đã tăng `v1-2026-08-29` → `v2-2026-09-02` vì cách sinh ảnh
phụ kiện đã đổi.

GitNexus: `impact` trên `coverage_quality` = LOW (1 caller trực tiếp, epistemic
exact). `detect_changes` báo `critical` / 380 symbol, nhưng đó là mức của **toàn
bộ 179 tệp dirty có sẵn trong repo**, không phải của lần sửa này; các module mới
(`outfitSlots.js`, `confine_to_accessory_region`, `suggestForMissingSlots`) chưa
có trong chỉ mục nên không xuất hiện trong kết quả.

---

## 6. Không thay đổi

Không đụng: quy tắc nghiệp vụ, hợp đồng API cũ (chỉ **thêm** trường `outfit` và
endpoint mới), giá, tồn kho, thanh toán, RBAC, `ALWAYS_COVERED_ZONES`, cổng 18+,
kiểm SHA-256 ảnh preset. Không thêm dependency nào. Không gọi bất kỳ thay đổi nào
ở đây là "fine-tune" — không có dataset, optimizer, checkpoint hay eval held-out
nào được tạo ra; đây là sửa pipeline và ngưỡng cổng.

## 7. Tệp đã sửa

```
backend/accessory_pipeline.py        cổng che phủ + confine_to_accessory_region
backend/routes/tryon.js              khu trú vùng phụ kiện, trường outfit
backend/routes/stylist.js            GET /api/outfits/completeness
backend/lib/outfitSlots.js           MỚI — slot cơ thể, đọc bộ đồ thiếu gì
backend/lib/outfit.js                suggestForMissingSlots()
backend/lib/tryonCache.js            PIPELINE_VERSION v2
backend/lib/japanScenes.js           +2 scene (hình học đo trên ảnh nguồn)
backend/lib/japanSceneBackgrounds.js +2 địa điểm
backend/test/outfit-slots.test.js    MỚI — 8 ca
backend/test/python/test_coverage_quality.py  +2 ca
backend/test/japan-travel-tryon.test.js       35 → 37 địa điểm
mobile/lib/japanSpots.ts             +2 spot, +Yamaguchi
mobile/assets/japan-scenes/          +4 tệp ảnh (2 jpg + 2 webp)
web/components/tryon-studio.tsx      productIds + accessoryIds + gợi ý slot
web/lib/types.ts                     kiểu OutfitCompleteness
web/app/globals.css                  chip, khối gợi ý, vùng chọn cuộn
```

## 8. Việc còn lại

1. Mặc chồng nhiều món: cần cách giữ tư thế qua các lượt FASHN nối tiếp (hoặc bỏ
   nối chuỗi, ghép theo vùng cơ thể từ các lượt độc lập cùng ảnh gốc).
2. Chất lượng mask U2Net quanh chân để hết quầng sáng khi ghép cảnh.
3. Xác minh toàn bộ trên OPPO A78 thật.
4. Gợi ý slot `feet` hiện xếp vớ/tất ngang hàng giày; nên cho giày điểm cao hơn.
