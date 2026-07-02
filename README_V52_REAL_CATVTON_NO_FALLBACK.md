# JAPANO V52 Real CatVTON Connector - No Fallback Preview

V51 chỉ set cứng thông số `steps=60`, `cfg=3.5`, `seed=70`.
V52 sửa đúng lỗi app vẫn hiện `JAPANO AI TRY-ON PREVIEW`:

- Chèn route mới vào `server/index.mjs` trước V50.
- Route mới gọi CatVTON thật tại `http://127.0.0.1:7861/tryon`.
- Nếu CatVTON chưa chạy hoặc lỗi, backend trả lỗi rõ ràng.
- Không dùng Pillow preview giả nữa.
- Thông số cố định: `steps=60`, `cfg=3.5`, `seed=70`.

Lưu ý quan trọng: CatVTON là model virtual try-on cho quần áo. Phụ kiện như kính, túi, dây chuyền, đồng hồ cần bước inpainting riêng để gắn thật lên ảnh. V52 không overlay phụ kiện giả nữa; phụ kiện được giữ trong payload/debug/tips để nối V53.

## Cài

Copy zip vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
unzip -o JAPANO_V52_REAL_CATVTON_NO_FALLBACK.zip
chmod +x RUN_APPLY_V52_REAL_CATVTON_NO_FALLBACK_LINUX.sh
./RUN_APPLY_V52_REAL_CATVTON_NO_FALLBACK_LINUX.sh
```

## Chạy

Terminal 1:

```bash
cd /home/rd/jp/ai/CatVTON
source .venv/bin/activate
GRADIO_ANALYTICS_ENABLED=False CUDA_VISIBLE_DEVICES=0 python japano_catvton_simple_web.py
```

Terminal 2:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_CATVTON_URL="http://127.0.0.1:7861"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Terminal 3 Android:

```bash
cd /home/rd/Downloads/v37
export EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npx expo start -c --dev-client
```

Nếu app còn hiện chữ `JAPANO AI TRY-ON PREVIEW`, backend chưa ăn V52 hoặc chưa restart đúng terminal.
