# JAPANO V41 AI Fashion Gateway
# Local-first gateway for camera stylist, size advice, realistic generation, and advanced try-on.
# It allows adult swimwear/crop-top fashion try-on without adding fake covering layers, but does not support nudity/explicit sexual content or minors.

from __future__ import annotations

import base64
import io
import json
import os
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

APP_VERSION = "JAPANO_V41_AI_FASHION_STUDIO"
MODELS_DIR = Path(os.environ.get("JAPANO_MODELS_DIR", "/home/rd/jp/ai/v41/models"))
PORT = int(os.environ.get("JAPANO_AI_GATEWAY_PORT", "8001"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_TEXT_MODEL = os.environ.get("OLLAMA_TEXT_MODEL", "qwen3:8b")
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "llama3.2-vision:11b")
DEVICE = os.environ.get("JAPANO_AI_DEVICE", "cuda")

app = FastAPI(title="JAPANO V41 AI Fashion Gateway", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cached: Dict[str, Any] = {}

class ImageBase64Request(BaseModel):
    imageBase64: str = ""
    prompt: str = ""
    mode: str = "fashion"
    userProfile: Dict[str, Any] = Field(default_factory=dict)
    products: List[Dict[str, Any]] = Field(default_factory=list)
    adultConfirmed: bool = False
    allowSwimwear: bool = True
    preserveVisibleSkin: bool = True
    noExtraCovering: bool = True

class GenerateRequest(BaseModel):
    prompt: str
    negativePrompt: str = "low quality, blurry, distorted, extra limbs, wrong anatomy, watermark, text artifacts"
    width: int = 768
    height: int = 1024
    steps: int = 4
    mode: str = "realistic-fashion"
    adultConfirmed: bool = False
    allowSwimwear: bool = True
    references: List[str] = Field(default_factory=list)

class SizeAdviceRequest(BaseModel):
    heightCm: Optional[float] = None
    weightKg: Optional[float] = None
    bustCm: Optional[float] = None
    waistCm: Optional[float] = None
    hipCm: Optional[float] = None
    shoulderCm: Optional[float] = None
    wristCm: Optional[float] = None
    usualSize: str = ""
    product: Dict[str, Any] = Field(default_factory=dict)
    category: str = ""
    fit: str = ""
    material: str = ""

class TryOnRequest(BaseModel):
    personImageBase64: str = ""
    garmentImageBase64: str = ""
    accessoryImagesBase64: List[str] = Field(default_factory=list)
    category: str = "fashion"
    productName: str = ""
    adultConfirmed: bool = False
    preserveVisibleSkin: bool = True
    noExtraCovering: bool = True
    realisticRefine: bool = True
    prompt: str = ""


def _strip_data_uri(data: str) -> str:
    if not data:
        return ""
    if "," in data and data[:32].lower().startswith("data:"):
        return data.split(",", 1)[1]
    return data


def decode_image(data: str) -> Image.Image:
    raw = base64.b64decode(_strip_data_uri(data))
    return Image.open(io.BytesIO(raw)).convert("RGB")


def image_to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def image_file_to_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def safe_category_allows_swimwear(category: str, adult_confirmed: bool) -> bool:
    text = (category or "").lower()
    swim_terms = ["bikini", "swim", "swimwear", "đồ bơi", "do boi", "áo tắm", "ao tam", "crop", "bra top"]
    if any(t in text for t in swim_terms):
        return bool(adult_confirmed)
    return True


def ollama_generate(prompt: str, model: Optional[str] = None, images: Optional[List[str]] = None, timeout: int = 120) -> str:
    payload: Dict[str, Any] = {
        "model": model or OLLAMA_TEXT_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.35, "num_ctx": 8192},
    }
    if images:
        payload["images"] = images
    try:
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json().get("response", "").strip()
    except Exception as e:
        return f"[OLLAMA_OFFLINE] {e}"


def load_yolo():
    if "yolo" in _cached:
        return _cached["yolo"]
    try:
        from ultralytics import YOLO
        # small and fast; auto-downloads if missing
        model = YOLO("yolo11n.pt")
        _cached["yolo"] = model
        return model
    except Exception as e:
        _cached["yolo_error"] = str(e)
        return None


def analyze_objects_with_yolo(img: Image.Image) -> Dict[str, Any]:
    model = load_yolo()
    if model is None:
        return {"enabled": False, "error": _cached.get("yolo_error", "YOLO unavailable"), "objects": []}
    try:
        import numpy as np
        arr = np.array(img)
        results = model.predict(arr, verbose=False, imgsz=640, conf=0.25)
        objs = []
        for result in results:
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for b in boxes:
                cls = int(b.cls[0].item()) if hasattr(b.cls[0], "item") else int(b.cls[0])
                conf = float(b.conf[0].item()) if hasattr(b.conf[0], "item") else float(b.conf[0])
                xyxy = [float(x) for x in b.xyxy[0].tolist()]
                objs.append({"label": names.get(cls, str(cls)), "confidence": conf, "box": xyxy})
        return {"enabled": True, "objects": objs[:20]}
    except Exception as e:
        return {"enabled": False, "error": str(e), "objects": []}


def mediapipe_pose_hint(img: Image.Image) -> Dict[str, Any]:
    try:
        import numpy as np
        import mediapipe as mp
        mp_pose = mp.solutions.pose
        with mp_pose.Pose(static_image_mode=True, model_complexity=1, enable_segmentation=False) as pose:
            res = pose.process(np.array(img))
            if not res.pose_landmarks:
                return {"enabled": True, "hasPose": False}
            lm = res.pose_landmarks.landmark
            def pt(i):
                return {"x": float(lm[i].x), "y": float(lm[i].y), "visibility": float(lm[i].visibility)}
            return {
                "enabled": True,
                "hasPose": True,
                "leftShoulder": pt(11), "rightShoulder": pt(12),
                "leftHip": pt(23), "rightHip": pt(24),
                "leftWrist": pt(15), "rightWrist": pt(16),
            }
    except Exception as e:
        return {"enabled": False, "error": str(e)}


def build_style_prompt(yolo: Dict[str, Any], pose: Dict[str, Any], products: List[Dict[str, Any]], user_profile: Dict[str, Any], allow_swimwear: bool, no_extra_covering: bool) -> str:
    return f"""
Bạn là JAPANO Camera Stylist. Hãy nhận xét outfit người lớn theo hướng thời trang, lịch sự, dùng được cho app bán hàng.
Không suy đoán danh tính, tuổi chính xác, giới tính nhạy cảm, sức khỏe hoặc thông tin riêng tư.
Nếu là bikini/đồ bơi/crop-top người lớn: được tư vấn kiểu dáng, form, size, phụ kiện; không yêu cầu che thêm nếu sản phẩm là đồ bơi hợp lệ.
Không hỗ trợ ảnh khỏa thân hoặc nội dung explicit.

Dữ liệu YOLO: {json.dumps(yolo, ensure_ascii=False)[:3000]}
Dữ liệu pose: {json.dumps(pose, ensure_ascii=False)[:2000]}
Sản phẩm shop: {json.dumps(products, ensure_ascii=False)[:4000]}
Hồ sơ user tự nhập: {json.dumps(user_profile, ensure_ascii=False)[:2000]}
allow_swimwear={allow_swimwear}; no_extra_covering={no_extra_covering}

Trả JSON thuần:
{{
  "summary": "1 câu nhận xét outfit",
  "styleTags": ["..."],
  "bodyFitHints": ["gợi ý form/size dựa trên dữ liệu, nói là ước lượng"],
  "recommendedCategories": ["..."],
  "accessoryAdvice": ["dây chuyền/đồng hồ/túi/kính phù hợp"],
  "sizeQuestions": ["câu hỏi cần hỏi thêm để chốt size"],
  "productSearchQuery": "câu tìm sản phẩm trong shop",
  "safety": "adult-fashion-only"
}}
"""

@app.get("/health")
def health():
    return {
        "ok": True,
        "version": APP_VERSION,
        "modelsDir": str(MODELS_DIR),
        "ollamaUrl": OLLAMA_URL,
        "textModel": OLLAMA_TEXT_MODEL,
        "visionModel": OLLAMA_VISION_MODEL,
        "features": {
            "adultSwimwearTryOn": True,
            "noExtraCoveringFashionMode": True,
            "nudityExplicit": False,
            "minorSexualized": False,
            "cameraStylist": True,
            "sizeAdvisor": True,
            "multiReference": True,
        },
        "modelFolders": [p.name for p in MODELS_DIR.iterdir()] if MODELS_DIR.exists() else [],
    }

@app.post("/camera/analyze")
def camera_analyze(req: ImageBase64Request):
    if not req.imageBase64:
        return {"ok": False, "message": "Missing imageBase64"}
    img = decode_image(req.imageBase64)
    yolo = analyze_objects_with_yolo(img)
    pose = mediapipe_pose_hint(img)
    img_b64 = _strip_data_uri(req.imageBase64)
    vision_prompt = build_style_prompt(yolo, pose, req.products, req.userProfile, req.allowSwimwear, req.noExtraCovering)
    vision_text = ollama_generate(vision_prompt, model=OLLAMA_VISION_MODEL, images=[img_b64], timeout=180)
    try:
        parsed = json.loads(vision_text.strip().strip('`').replace('json\n', '', 1))
    except Exception:
        parsed = {"summary": vision_text, "styleTags": [], "bodyFitHints": [], "recommendedCategories": [], "accessoryAdvice": [], "sizeQuestions": []}
    return {"ok": True, "analysis": parsed, "detector": yolo, "pose": pose, "ts": time.time()}

@app.post("/size/advice")
def size_advice(req: SizeAdviceRequest):
    prompt = f"""
Bạn là AI Size Advisor cho shop thời trang JAPANO. Hãy gợi ý size cẩn thận, không khẳng định tuyệt đối nếu thiếu số đo.
Dữ liệu user: heightCm={req.heightCm}, weightKg={req.weightKg}, bustCm={req.bustCm}, waistCm={req.waistCm}, hipCm={req.hipCm}, shoulderCm={req.shoulderCm}, wristCm={req.wristCm}, usualSize={req.usualSize}
Sản phẩm/category/fit/material: {json.dumps(req.product, ensure_ascii=False)} / {req.category} / {req.fit} / {req.material}

Quy tắc:
- Quần áo: dựa vòng ngực/eo/hông/vai + form rộng/ôm + co giãn.
- Bikini: cần cup size, vòng ngực, vòng dưới ngực, eo/hông, coverage mong muốn; nếu thiếu thì hỏi thêm.
- Đồng hồ: dựa wristCm, gợi ý mặt 28/32/36/40/42mm và độ rộng dây.
- Dây chuyền: gợi ý 40/45/50/60cm theo cổ/vai/style.
- Không body shaming.

Trả JSON thuần:
{{"recommendedSize":"...","confidence":"low|medium|high","why":["..."],"needMore":["..."],"accessorySizing":{{"watch":"...","necklace":"...","bracelet":"..."}},"fitWarning":["..."]}}
"""
    text = ollama_generate(prompt, model=OLLAMA_TEXT_MODEL, timeout=90)
    try:
        return {"ok": True, "advice": json.loads(text.strip().strip('`').replace('json\n', '', 1))}
    except Exception:
        return {"ok": True, "advice": {"raw": text}}

@app.post("/generate/realistic")
def generate_realistic(req: GenerateRequest):
    # Best-effort SDXL-Turbo local generation. If missing, returns an actionable fallback instead of crashing.
    swim_terms = ["bikini", "swimwear", "đồ bơi", "ao tam", "áo tắm"]
    text = (req.prompt + " " + req.mode).lower()
    if any(t in text for t in swim_terms) and not req.adultConfirmed:
        return {"ok": False, "requiresAdultConfirmation": True, "message": "Chế độ bikini/đồ bơi yêu cầu xác nhận người trong ảnh là người lớn."}
    enhanced_prompt = req.prompt
    if req.allowSwimwear:
        enhanced_prompt += ", adult fashion swimwear if requested, preserve garment cut, preserve visible skin, no extra covering layers, realistic catalog photography"
    enhanced_prompt += ", photorealistic, natural skin texture, accurate fabric, high-end Japanese fashion ecommerce, studio lighting"
    try:
        import torch
        from diffusers import AutoPipelineForText2Image
        model_path = MODELS_DIR / "sdxl-turbo"
        pipe_key = f"sdxl:{model_path}"
        if pipe_key not in _cached:
            if not model_path.exists() or not any(model_path.iterdir()):
                return {"ok": False, "message": "SDXL-Turbo chưa tải. Chạy JAPANO_V41_ONECLICK.bat hoặc tải model vào /home/rd/jp/ai/v41/models\\sdxl-turbo"}
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            pipe = AutoPipelineForText2Image.from_pretrained(str(model_path), torch_dtype=dtype, variant="fp16" if torch.cuda.is_available() else None)
            pipe = pipe.to("cuda" if torch.cuda.is_available() else "cpu")
            _cached[pipe_key] = pipe
        pipe = _cached[pipe_key]
        img = pipe(prompt=enhanced_prompt, negative_prompt=req.negativePrompt, num_inference_steps=max(1, min(req.steps, 8)), guidance_scale=0.0, width=req.width, height=req.height).images[0]
        return {"ok": True, "imageBase64": image_to_b64(img), "model": "SDXL-Turbo", "prompt": enhanced_prompt}
    except Exception as e:
        return {"ok": False, "message": str(e), "trace": traceback.format_exc()[-2000:]}

@app.post("/tryon/advanced")
def tryon_advanced(req: TryOnRequest):
    if not safe_category_allows_swimwear(req.category + " " + req.productName, req.adultConfirmed):
        return {"ok": False, "requiresAdultConfirmation": True, "message": "Try-on bikini/đồ bơi yêu cầu xác nhận người trong ảnh là người lớn."}

    # This endpoint prepares the exact V41 payload. Real CatVTON integration depends on which CatVTON repo/weights you install.
    # Until the CatVTON runner is connected, return a precise payload and a refinement prompt that your backend can send to the local runner/API fallback.
    prompt = f"""
Advanced fashion try-on for JAPANO.
Product/category: {req.productName} / {req.category}.
Use adult fashion catalog style. Preserve original person identity, pose, body shape, lighting.
If product is bikini/swimwear/crop-top: preserve visible skin and garment cut; do not add extra covering layers; do not transform swimwear into closed clothing.
Add accessories from reference images naturally at correct body locations: necklace on neck, watch on wrist, glasses on eyes, bag on shoulder/hand.
Photorealistic, accurate fabric, realistic shadows, no body distortion, no explicit nudity.
Extra user prompt: {req.prompt}
""".strip()

    catvton_dir = MODELS_DIR / "catvton"
    if not catvton_dir.exists() or not any(catvton_dir.iterdir()):
        return {
            "ok": False,
            "message": "CatVTON chưa sẵn sàng hoặc repo tải chưa đúng. Script đã tạo endpoint và prompt. Hãy tải CatVTON weights vào /home/rd/jp/ai/v41/models\\catvton hoặc nối runner CatVTON bạn đang dùng.",
            "v41Prompt": prompt,
            "fallbackSuggested": "ALLOW_API_FALLBACK=1: dùng API/Fotor cũ khi local chưa chạy."
        }
    return {
        "ok": False,
        "message": "CatVTON folder đã có, nhưng runner cụ thể chưa được nối tự động trong bản scaffold này. Dùng v41Prompt để nối vào CatVTON app.py/inference.py bạn đang chạy.",
        "v41Prompt": prompt,
        "catvtonDir": str(catvton_dir)
    }

@app.post("/remove-bg")
def remove_bg(req: ImageBase64Request):
    # Fallback simple transparent output placeholder. Proper BiRefNet integration depends on installed checkpoint class.
    try:
        img = decode_image(req.imageBase64).convert("RGBA")
        return {"ok": True, "imageBase64": image_to_b64(img), "message": "Placeholder remove-bg. Nối BiRefNet runner để xóa nền thật."}
    except Exception as e:
        return {"ok": False, "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
