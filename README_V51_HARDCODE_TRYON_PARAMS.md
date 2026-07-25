# JAPANO V51 - Hardcode Try-On Params

Bản này set cứng thông số cho mọi lần thử đồ trong app JAPANO:

- Inference steps: `60`
- CFG / guidance scale: `3.5`
- Seed: `70`
- Áp dụng cho thử đồ chính và phụ kiện trong payload gửi AI Gateway.

## Cách chạy trên Ubuntu

Copy zip vào `/home/rd/Downloads/v37`, giải nén rồi chạy:

```bash
cd /home/rd/Downloads/v37
unzip -o JAPANO_V51_HARDCODE_TRYON_PARAMS.zip
chmod +x RUN_APPLY_V51_HARDCODE_TRYON_PARAMS_LINUX.sh
./RUN_APPLY_V51_HARDCODE_TRYON_PARAMS_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Nếu có web CatVTON riêng `/home/rd/jp/ai/CatVTON/japano_catvton_simple_web.py`, script cũng sẽ sửa cứng mặc định 60 / 3.5 / 70 ở web đó.
