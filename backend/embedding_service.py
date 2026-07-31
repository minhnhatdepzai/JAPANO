"""JAPANO semantic embedding service.

Sentence-transformer đa ngôn ngữ để chấm độ giống nhau về NGHĨA giữa sản phẩm
(dùng cho related-products trong lib/embeddings.js) — ưu tiên CUDA, chỉ rơi về
CPU khi máy không có GPU, cùng device-selection pattern với fashn_service.py/
catvton_service.py để nhất quán toàn bộ stack AI cục bộ của JAPANO.
"""

import ctypes
import gc
import os
import threading

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_ID = os.getenv("JAPANO_EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

LOCK = threading.RLock()
MODEL = None


def release_memory() -> None:
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


def get_model() -> SentenceTransformer:
    global MODEL
    if MODEL is None:
        with LOCK:
            if MODEL is None:
                MODEL = SentenceTransformer(MODEL_ID, device=DEVICE)
    return MODEL


api = FastAPI(title="JAPANO Semantic Embedding Service")


class EmbedRequest(BaseModel):
    texts: list[str]


class DeviceRequest(BaseModel):
    device: str


@api.get("/health")
def health():
    return {
        "ok": True,
        "service": "JAPANO Semantic Embedding Service",
        "model": MODEL_ID,
        "device": DEVICE,
        "cuda": torch.cuda.is_available(),
        "loaded": MODEL is not None,
    }


@api.post("/embed")
def embed(payload: EmbedRequest):
    texts = [str(text or "")[:500] for text in payload.texts]
    if not texts:
        raise HTTPException(status_code=400, detail="texts rỗng")
    # Không cho /device di chuyển model trong lúc encode.
    with LOCK:
        model = get_model()
        vectors = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=32)
    return {"ok": True, "device": DEVICE, "model": MODEL_ID, "embeddings": vectors.tolist()}


@api.post("/device")
def move_device(payload: DeviceRequest):
    """Chuyển recommendation embedding giữa CUDA và CPU theo GPU focus."""
    global DEVICE, MODEL
    requested = str(payload.device or "").strip().lower()
    if requested not in {"cpu", "cuda"}:
        raise HTTPException(status_code=400, detail="device phải là cpu hoặc cuda")
    if requested == "cuda" and not torch.cuda.is_available():
        raise HTTPException(status_code=409, detail="CUDA không sẵn sàng")
    with LOCK:
        previous = DEVICE
        if MODEL is not None and previous != requested:
            MODEL.to(requested)
        DEVICE = requested
        if requested == "cpu" and torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    return {
        "ok": True,
        "device": DEVICE,
        "previousDevice": previous,
        "moved": previous != DEVICE,
        "loaded": MODEL is not None,
    }


@api.post("/unload")
def unload_model():
    """Tắt hẳn semantic suggestions khi GPU/RAM thuộc về generative job."""
    global MODEL
    with LOCK:
        was_loaded = MODEL is not None
        MODEL = None
        release_memory()
    return {
        "ok": True,
        "device": "off",
        "unloaded": was_loaded,
        "loaded": False,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        api,
        host=os.getenv("JAPANO_EMBEDDING_HOST", "127.0.0.1"),
        port=int(os.getenv("JAPANO_EMBEDDING_PORT", "7865")),
    )
