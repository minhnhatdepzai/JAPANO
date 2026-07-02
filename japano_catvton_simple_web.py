import os
import sys
import time
import traceback
from pathlib import Path

# Force CatVTON app.py args when imported as a module.
sys.argv = [
    "app.py",
    "--output_dir=resource/demo/output",
    "--mixed_precision=bf16",
    "--allow_tf32",
]

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, FileResponse, PlainTextResponse, JSONResponse
from PIL import Image
import uvicorn

print("=== Loading CatVTON model for JAPANO API, please wait... ===")
import app as catvton_app

UPLOAD_DIR = Path("resource/japano_upload")
OUTPUT_DIR = Path("resource/japano_output")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

api = FastAPI(title="JAPANO CatVTON Real Try-On API")

HTML = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>JAPANO CatVTON Real Try-On</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 860px; margin: 40px auto; background:#fff7fb; color:#111827; }
    .box { background:white; padding:24px; border-radius:20px; box-shadow:0 12px 35px #be185d22; border:1px solid #fbcfe8; }
    h1 { margin:0 0 6px; color:#be185d; }
    label { display:block; margin-top:18px; font-weight:700; }
    input, select, button { width:100%; padding:12px; margin-top:8px; font-size:16px; box-sizing:border-box; }
    button { background:#e11d48; color:white; border:0; border-radius:12px; cursor:pointer; font-weight:800; }
    .note { color:#6b7280; margin-top:14px; line-height:1.55; }
    .fixed { background:#fff1f2; border:1px solid #fecdd3; padding:12px; border-radius:12px; margin-top:14px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>JAPANO CatVTON Real Try-On</h1>
    <div class="note">Web này bỏ Gradio UI lỗi và gọi thẳng model CatVTON thật.</div>
    <div class="fixed">Thông số cố định: <b>steps=60</b>, <b>CFG=3.5</b>, <b>seed=70</b>.</div>
    <form action="/tryon" method="post" enctype="multipart/form-data">
      <label>1. Ảnh người</label>
      <input name="person" type="file" accept="image/*" required />
      <label>2. Ảnh áo/quần/sản phẩm</label>
      <input name="cloth" type="file" accept="image/*" required />
      <label>3. Loại đồ</label>
      <select name="cloth_type">
        <option value="upper">upper - áo</option>
        <option value="lower">lower - quần/váy dưới</option>
        <option value="overall">overall - váy liền/outfit</option>
      </select>
      <button type="submit">Tạo ảnh thử đồ thật</button>
    </form>
    <div class="note">Lần đầu sẽ chậm do model load/GPU warmup. Nếu endpoint này ra ảnh, app JAPANO sẽ nhận ảnh thật từ cổng 7861.</div>
  </div>
</body>
</html>
"""

@api.get("/")
def home():
    return HTMLResponse(HTML)

@api.get("/health")
def health():
    return {
        "ok": True,
        "service": "JAPANO CatVTON Real Try-On API",
        "fixed": {"steps": 60, "cfg": 3.5, "seed": 70},
    }

async def save_upload(upload: UploadFile, prefix: str) -> Path:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in [".jpg", ".jpeg", ".png", ".webp"]:
        suffix = ".png"
    path = UPLOAD_DIR / f"{prefix}_{int(time.time() * 1000)}{suffix}"
    data = await upload.read()
    if not data:
        raise ValueError(f"Upload {prefix} rỗng")
    path.write_bytes(data)
    return path

def run_catvton(person_path: Path, cloth_path: Path, cloth_type: str):
    cloth_type = cloth_type if cloth_type in ["upper", "lower", "overall"] else "upper"

    im = Image.open(person_path).convert("RGB")
    mask_path = UPLOAD_DIR / f"mask_{int(time.time() * 1000)}.png"
    # Empty mask means CatVTON app uses automasker by cloth_type.
    Image.new("L", im.size, 0).save(mask_path)

    fn = getattr(catvton_app.submit_function, "__wrapped__", catvton_app.submit_function)
    result = fn(
        {
            "background": str(person_path),
            "layers": [str(mask_path)],
        },
        str(cloth_path),
        cloth_type,
        60,
        3.5,
        70,
        "result only",
    )
    return result

@api.post("/tryon")
async def tryon(
    person: UploadFile = File(...),
    cloth: UploadFile = File(...),
    cloth_type: str = Form("upper"),
):
    try:
        person_path = await save_upload(person, "person")
        cloth_path = await save_upload(cloth, "cloth")
        result = run_catvton(person_path, cloth_path, cloth_type)
        out_path = OUTPUT_DIR / f"result_{int(time.time() * 1000)}.png"
        result.save(out_path)
        return FileResponse(str(out_path), media_type="image/png", filename="japano_catvton_result.png")
    except Exception:
        err = traceback.format_exc()
        print(err)
        return PlainTextResponse(err, status_code=500)

@api.post("/tryon-json")
async def tryon_json(
    person: UploadFile = File(...),
    cloth: UploadFile = File(...),
    cloth_type: str = Form("upper"),
):
    try:
        import base64
        from io import BytesIO
        person_path = await save_upload(person, "person")
        cloth_path = await save_upload(cloth, "cloth")
        result = run_catvton(person_path, cloth_path, cloth_type)
        buf = BytesIO()
        result.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return JSONResponse({
            "ok": True,
            "imageBase64": f"data:image/png;base64,{b64}",
            "fixed": {"steps": 60, "cfg": 3.5, "seed": 70},
            "engine": "catvton-real",
        })
    except Exception:
        err = traceback.format_exc()
        print(err)
        return JSONResponse({"ok": False, "message": err}, status_code=500)

if __name__ == "__main__":
    uvicorn.run(api, host="0.0.0.0", port=7861)
