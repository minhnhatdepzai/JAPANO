# JAPANO V41 Dev Checklist — AI Fashion Studio

Mục tiêu: nâng JAPANO từ shop có chatbot thành **AI Fashion Assistant**: camera stylist, try-on nhiều sản phẩm/phụ kiện, size advisor, tạo ảnh chân thật, local-first trên NVIDIA 5060Ti 16GB và chỉ fallback API khi local lỗi.

## 1. Quy tắc sản phẩm/ảnh

- Cho phép thời trang người lớn: bikini, swimwear, crop-top, đồ tập, áo hở bụng, đồ ôm sát.
- Không tự che thêm nếu sản phẩm vốn là bikini/crop-top/swimwear.
- Không biến bikini thành áo kín, không thêm áo khoác/khăn/vải che bụng nếu user không yêu cầu.
- Không hỗ trợ khỏa thân/explicit hoặc ảnh trẻ vị thành niên trong bối cảnh nhạy cảm.
- Với swimwear/bikini, UI phải có checkbox: `Tôi xác nhận người trong ảnh là người lớn`.

## 2. Pipeline V41

```txt
Expo App / Web Admin
  ↓
Node backend :4000
  ↓
V41 AI Gateway :8001
  ├─ Ollama qwen3:8b/qwen3:14b
  ├─ Ollama llama3.2-vision:11b
  ├─ SDXL-Turbo / FLUX / Qwen-Image
  ├─ CatVTON / try-on runner
  ├─ BiRefNet / SAM2 segmentation
  ├─ YOLO + MediaPipe camera analyzer
  └─ OpenCLIP + Qdrant recommendation
```

## 3. API cần nối trong app

### Health
`GET /api/v41/ai/health`

### Camera real-time stylist
`POST /api/v41/camera/analyze`

Input nên gửi 1 frame mỗi 1–3 giây, không gửi từng frame 30fps.

Body JSON hoặc multipart:

```json
{
  "imageBase64": "...",
  "products": [],
  "userProfile": {},
  "adultConfirmed": true,
  "allowSwimwear": true,
  "preserveVisibleSkin": true,
  "noExtraCovering": true
}
```

Output:

```json
{
  "ok": true,
  "analysis": {
    "summary": "...",
    "styleTags": [],
    "bodyFitHints": [],
    "recommendedCategories": [],
    "accessoryAdvice": [],
    "sizeQuestions": [],
    "productSearchQuery": "..."
  }
}
```

### Size advisor
`POST /api/v41/size/advice`

Input:

```json
{
  "heightCm": 160,
  "weightKg": 48,
  "bustCm": 82,
  "waistCm": 64,
  "hipCm": 88,
  "wristCm": 14.5,
  "usualSize": "S",
  "category": "bikini",
  "fit": "slim fit",
  "product": { "sizes": ["S", "M", "L"] }
}
```

### Tạo ảnh realistic
`POST /api/v41/generate/realistic`

Input:

```json
{
  "prompt": "người mẫu người lớn mặc bikini xanh phong cách catalog thời trang, studio lighting",
  "adultConfirmed": true,
  "allowSwimwear": true,
  "width": 768,
  "height": 1024,
  "steps": 4
}
```

### Try-on nâng cao nhiều ảnh
`POST /api/v41/tryon/advanced`

Multipart fields:

- `person`: ảnh người
- `garment`: ảnh quần áo/bikini
- `accessory_watch`: ảnh đồng hồ
- `accessory_necklace`: ảnh dây chuyền
- `accessory_bag`: ảnh túi
- `category`: `bikini`, `crop-top`, `dress`, `shirt`, ...
- `adultConfirmed`: `true` nếu swimwear/bikini
- `preserveVisibleSkin`: `true`
- `noExtraCovering`: `true`

## 4. UI cần thêm

### Camera Stylist screen
- Nút mở camera.
- Mỗi 1–3 giây chụp frame rõ nhất gửi `/api/v41/camera/analyze`.
- Overlay gợi ý: sản phẩm, phụ kiện, size question.
- Nút “Thử ngay” → sang try-on.

### Advanced Try-on screen
- Chọn ảnh người.
- Chọn sản phẩm chính.
- Chọn nhiều phụ kiện.
- Mode: normal / realistic / swimwear / editorial.
- Checkbox adult confirmation nếu sản phẩm là bikini/swimwear.

### Admin AI Studio
- Tạo ảnh sản phẩm.
- Xóa nền.
- Tạo banner.
- Viết mô tả.
- Tạo combo.
- Tạo caption TikTok/Facebook.

## 5. Database/product schema nên bổ sung

Cho mỗi sản phẩm:

```json
{
  "category": "bikini",
  "coverage": "low|medium|full",
  "fit": "slim|regular|oversize",
  "stretch": "none|low|medium|high",
  "sizeChart": {
    "S": { "bust": [78, 84], "waist": [60, 66], "hip": [84, 90] },
    "M": { "bust": [84, 90], "waist": [66, 72], "hip": [90, 96] }
  },
  "accessorySizing": {
    "watchFaceMm": [28, 32, 36],
    "necklaceCm": [40, 45, 50]
  }
}
```

## 6. Model checklist

Recommended:

- qwen3:8b — chatbot nhanh.
- qwen3:14b — admin/tư vấn khó.
- llama3.2-vision:11b — đọc ảnh snapshot.
- SDXL-Turbo — tạo ảnh nhanh.
- CatVTON — thử đồ.
- BiRefNet — xóa nền.
- SAM2 — mask.
- YOLO + MediaPipe — realtime.
- OpenCLIP — tìm sản phẩm giống ảnh.

Full:

- FLUX.1-schnell — ảnh đẹp hơn, nặng hơn.
- Qwen-Image — banner có chữ.
- Qwen-Image-Edit — chỉnh ảnh.
- FLUX.2-klein-4B — để slot, cần repo/file model chính xác nếu dùng.

## 7. Test checklist

- `http://127.0.0.1:8001/health` trả `ok: true`.
- `http://localhost:4000/api/v41/ai/health` trả `ok: true`.
- Android emulator gọi backend bằng `http://10.0.2.2:4000`.
- Backend gọi gateway bằng `http://127.0.0.1:8001`.
- Camera gửi frame không quá 1 frame/giây khi máy yếu.
- Try-on bikini bắt buộc adultConfirmed.
- Nếu local generate lỗi, backend fallback API nếu `JAPANO_AI_ALLOW_API_FALLBACK=1`.

## 8. Việc dev cần làm tiếp

1. Nối UI vào `lib/japanoV41Api.ts`.
2. Nối runner CatVTON thật vào `/tryon/advanced` trong `gateway_v41.py`.
3. Nối BiRefNet thật vào `/remove-bg`.
4. Thêm bảng sizeChart vào admin product form.
5. Thêm collection/log cho camera analysis, try-on result, generated image.
6. Thêm cache ảnh kết quả lên Cloudinary.
7. Thêm Qdrant/OpenCLIP index sản phẩm.
8. Thêm nút fallback API trong admin setting.
