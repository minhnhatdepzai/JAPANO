"""JAPANO local try-on service.

FASHN VTON 1.5 is the primary garment engine.  FLUX.2 Klein is loaded only
for photos whose pose is unsuitable, then released before FASHN is loaded so
both models fit on a 16 GB GPU.
"""

import gc
import json
import os
import threading
import time
import urllib.request
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from starlette.concurrency import run_in_threadpool

import torch


FASHN_HOME = Path(os.getenv("JAPANO_FASHN_HOME", str(Path.home() / "jp/ai/fashn-vton-1.5"))).resolve()
FASHN_WEIGHTS = Path(os.getenv("JAPANO_FASHN_WEIGHTS", str(FASHN_HOME / "weights"))).resolve()
FLUX_HOME = Path(os.getenv("JAPANO_FLUX_REPOSE_HOME", str(Path.home() / "jp/ai/FLUX.2-klein-4B"))).resolve()
POSE_REFERENCE = Path(
    os.getenv(
        "JAPANO_POSE_REFERENCE",
        str(Path(__file__).resolve().parent / "assets/poses/catalog-neutral-mannequin.png"),
    )
).resolve()
# Ảnh trung gian là dữ liệu tạm, không nên ghi lẫn vào thư mục model (vừa làm
# model directory phình dần, vừa dễ lỗi quyền ghi khi service được chạy bởi
# user/container khác). Có thể đổi qua biến môi trường nếu cần lưu lâu hơn.
RUNTIME_DIR = Path(os.getenv("JAPANO_TRYON_RUNTIME_DIR", "/tmp/japano-tryon-runtime")).resolve()
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

LOCK = threading.Lock()
FASHN_PIPELINE = None
FLUX_PIPELINE = None
LAST_ENGINE = ""
GPU_ACTIVE_FILE = Path(os.getenv("JAPANO_TRYON_GPU_LOCK", "/tmp/japano-tryon-gpu.active")).resolve()

api = FastAPI(title="JAPANO FASHN VTON 1.5 + FLUX.2 Pose API")


def cuda_cleanup():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()


def ollama_loaded_models(base: str):
    with urllib.request.urlopen(f"{base}/api/ps", timeout=3) as response:
        payload = json.loads(response.read().decode("utf-8"))
    names = [str(row.get("name") or row.get("model") or "").strip() for row in payload.get("models", [])]
    return [name for name in names if name]


def request_ollama_unload(base: str, name: str):
    body = json.dumps({"model": name, "keep_alive": 0}).encode("utf-8")
    request = urllib.request.Request(
        f"{base}/api/generate", data=body, headers={"content-type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        response.read()


def release_ollama_vram():
    """Unload Ollama weights before the 16 GB GPU is used for try-on.

    This does not stop Ollama or delete a model. A later chatbot/vision request
    simply loads its model again. Without this hand-off an idle qwen3-vl:8b can
    keep 6-8 GB VRAM and make FLUX fail for a missing ~50 MB.
    """
    if os.getenv("JAPANO_RELEASE_OLLAMA_VRAM", "1").strip().lower() not in {"1", "true", "yes", "on"}:
        return []
    base = os.getenv("JAPANO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        released = []
        deadline = time.monotonic() + float(os.getenv("JAPANO_OLLAMA_UNLOAD_TIMEOUT_SEC", "30"))
        while True:
            names = ollama_loaded_models(base)
            for name in names:
                if name not in released:
                    released.append(name)
                request_ollama_unload(base, name)
            if not names:
                # /api/ps may become empty slightly before the CUDA driver has
                # reclaimed llama-server's allocations. Give it a short grace
                # period instead of racing straight into FLUX.
                time.sleep(float(os.getenv("JAPANO_OLLAMA_RELEASE_GRACE_SEC", "1.5")))
                break
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Ollama chưa nhả model sau thời gian chờ: {', '.join(names)}")
            time.sleep(0.5)
        if released:
            print(f"=== Released Ollama VRAM for try-on: {', '.join(released)} ===", flush=True)
        return released
    except Exception as exc:
        # Ollama is optional; an offline instance must never block VTON.
        print(f"Ollama VRAM hand-off skipped: {exc}", flush=True)
        return []


def wait_for_gpu_headroom():
    """Wait until other processes have left enough global VRAM for FLUX/VTON."""
    if not torch.cuda.is_available():
        return
    required = int(float(os.getenv("JAPANO_MIN_GPU_FREE_GB", "8")) * (1024 ** 3))
    deadline = time.monotonic() + float(os.getenv("JAPANO_GPU_HEADROOM_TIMEOUT_SEC", "45"))
    last_free = 0
    while time.monotonic() < deadline:
        cuda_cleanup()
        last_free, _ = torch.cuda.mem_get_info()
        if last_free >= required:
            return
        release_ollama_vram()
        time.sleep(0.75)
    raise RuntimeError(
        f"GPU chưa đủ bộ nhớ trống cho thử đồ: {last_free / (1024 ** 3):.1f} GB, cần {required / (1024 ** 3):.1f} GB"
    )


def unload_fashn():
    global FASHN_PIPELINE
    if FASHN_PIPELINE is not None:
        del FASHN_PIPELINE
        FASHN_PIPELINE = None
        cuda_cleanup()


def unload_flux():
    global FLUX_PIPELINE
    if FLUX_PIPELINE is not None:
        del FLUX_PIPELINE
        FLUX_PIPELINE = None
        cuda_cleanup()


def load_fashn():
    global FASHN_PIPELINE, LAST_ENGINE
    if FASHN_PIPELINE is None:
        if not (FASHN_WEIGHTS / "model.safetensors").exists():
            raise RuntimeError(f"Thiếu FASHN weights tại {FASHN_WEIGHTS}")
        unload_flux()
        release_ollama_vram()
        wait_for_gpu_headroom()
        from fashn_vton import TryOnPipeline

        print("=== Loading FASHN VTON 1.5 for JAPANO ===", flush=True)
        FASHN_PIPELINE = TryOnPipeline(weights_dir=str(FASHN_WEIGHTS), device="cuda" if torch.cuda.is_available() else "cpu")
        LAST_ENGINE = "fashn-vton-1.5"
    return FASHN_PIPELINE


def load_flux():
    global FLUX_PIPELINE, LAST_ENGINE
    if FLUX_PIPELINE is None:
        model_index = FLUX_HOME / "model_index.json"
        if not model_index.exists():
            raise RuntimeError(f"Thiếu FLUX.2 Klein 4B tại {FLUX_HOME}")
        if not POSE_REFERENCE.exists():
            raise RuntimeError(f"Thiếu ảnh pose chuẩn tại {POSE_REFERENCE}")
        unload_fashn()
        release_ollama_vram()
        wait_for_gpu_headroom()
        from diffusers import Flux2KleinPipeline

        print("=== Loading FLUX.2 Klein 4B pose editor for JAPANO ===", flush=True)
        dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float32
        FLUX_PIPELINE = Flux2KleinPipeline.from_pretrained(str(FLUX_HOME), torch_dtype=dtype)
        if torch.cuda.is_available():
            # Remote Desktop và Android emulator cũng cần VRAM. Sequential
            # offload chậm hơn nhưng giữ headroom ổn định trên GPU 16 GB; có thể
            # chủ động đổi sang model offload khi chạy không kèm emulator.
            offload = os.getenv("JAPANO_FLUX_OFFLOAD", "sequential").strip().lower()
            if offload == "model":
                FLUX_PIPELINE.enable_model_cpu_offload()
            else:
                FLUX_PIPELINE.enable_sequential_cpu_offload()
        LAST_ENGINE = "flux2-klein-4b-pose"
    return FLUX_PIPELINE


def open_rgb(path: Path) -> Image.Image:
    with Image.open(path) as source:
        return ImageOps.exif_transpose(source).convert("RGB")


def normalized_output_size(image: Image.Image, low_memory: bool = False):
    # FLUX works in multiples of 32.  Use a portrait catalog canvas without
    # stretching the source; FASHN will preserve the resulting aspect ratio.
    if low_memory:
        return (576, 768) if image.height >= image.width else (768, 576)
    return (768, 1024) if image.height >= image.width else (1024, 768)


def repose_main_subject(person: Image.Image, output_path: Path, low_memory: bool = False) -> Image.Image:
    pipe = load_flux()
    target = open_rgb(POSE_REFERENCE)
    width, height = normalized_output_size(person, low_memory)
    prompt = (
        "Edit image 1 only. Image 1 is the user's photograph. Image 2 is an identity-free pose guide. "
        "Keep the same main person's exact face, hair, age, skin tone and body proportions from image 1. "
        "Move only the largest central main person into the upright front-facing catalog stance of image 2: "
        "head upright, torso visible, legs straight, feet apart, both arms lowered naturally, hands away from the chest. "
        "Keep the original background, lighting and every secondary person from image 1 unchanged. "
        "If the main person originally holds food, a sign, brochure, bag or any prop, either place it naturally in a lowered hand "
        "or remove it cleanly and reconstruct the background; never leave a detached or floating object at the old hand position. "
        "Do not copy the mannequin body, face, material or nudity. Keep the user's current ordinary clothing for this pose-only step. "
        "Exactly one main subject is re-posed; no duplicate limbs, no extra people, no text. Photorealistic."
    )
    generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(
        int(os.getenv("JAPANO_REPOSE_SEED", "17"))
    )
    result = pipe(
        image=[person, target],
        prompt=prompt,
        width=width,
        height=height,
        guidance_scale=float(os.getenv("JAPANO_REPOSE_CFG", "1.0")),
        num_inference_steps=int(os.getenv("JAPANO_REPOSE_STEPS", "4")),
        generator=generator,
    ).images[0].convert("RGB")
    result.save(output_path, quality=96)
    return result


def refine_garment_fidelity(tryon_image: Image.Image, garment: Image.Image, low_memory: bool = False) -> Image.Image:
    pipe = load_flux()
    width, height = normalized_output_size(tryon_image, low_memory)
    # QUAN TRỌNG: không hardcode mô tả một trang phục cụ thể (vd màu/hoạ tiết kimono-hong)
    # ở đây — prompt này chạy cho MỌI sản phẩm one-piece có ảnh flat-lay (kimono, yukata,
    # cosplay...). Chi tiết trang phục phải lấy từ chính ảnh tham chiếu (image 2), không
    # phải từ text, nếu không sẽ vẽ nhầm hoạ tiết của sản phẩm này sang sản phẩm khác.
    prompt = (
        "Edit image 1 only. Image 1 is an already valid virtual try-on result. Image 2 is the exact flat-lay garment reference. "
        "Keep the person's face, hair, identity, body proportions, upright pose, hands, feet, background and lighting from image 1 unchanged. "
        "Refine only the garment so it faithfully matches image 2 exactly: the same color, pattern, print placement, collar/neckline style, "
        "and sleeve shape and length as the reference garment in image 2. "
        "The garment's hem must reach exactly as low on the body as it does in image 2 relative to the garment's own proportions — if image 2 "
        "shows a long, ankle-length or floor-length garment, image 1's result must also reach the ankles, not become a shorter knee-length "
        "garment; do not shorten, lengthen, or otherwise change the garment's proportions compared to image 2. "
        "Do not expose the chest, do not alter skin, do not add props or people, do not change the pose. Photorealistic fabric and folds."
    )
    generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(
        int(os.getenv("JAPANO_REFINE_SEED", "29"))
    )
    return pipe(
        image=[tryon_image, garment],
        prompt=prompt,
        width=width,
        height=height,
        guidance_scale=float(os.getenv("JAPANO_REFINE_CFG", "1.0")),
        num_inference_steps=int(os.getenv("JAPANO_REFINE_STEPS", "4")),
        generator=generator,
    ).images[0].convert("RGB")


def refine_accessory_fit(
    rough_image: Image.Image,
    clean_image: Image.Image,
    accessory_images: list[Image.Image],
    metadata: list[dict],
    seed: int,
    low_memory: bool = False,
) -> Image.Image:
    """Turn pose-anchored accessory overlays into a coherent photograph.

    The rough image gives deterministic spatial control while the clean VTON
    image preserves the face, garment and background. Remaining references are
    exact catalog accessories. FLUX.2 Klein supports this multi-reference edit
    natively, so it can reconstruct fingers/hair/occlusion instead of leaving a
    sticker-like alpha composite.
    """
    pipe = load_flux()
    width, height = normalized_output_size(clean_image, low_memory)
    references = [rough_image, clean_image, *accessory_images]
    indexed = []
    instructions = []
    for index, item in enumerate(metadata[: len(accessory_images)], start=3):
        name = str(item.get("name") or f"accessory {index - 2}")
        kind = str(item.get("kind") or "hand")
        indexed.append(f"image {index} is the exact product reference for {name} ({kind})")
        if kind == "hat":
            instructions.append(
                f"Place {name} from image {index} naturally on top of the main person's head. "
                "The lowest brim must sit above the eyebrows; both eyes, nose and mouth must remain completely visible. "
                "Hair must pass naturally behind or under the hat with realistic contact shadow."
            )
        elif kind == "umbrella":
            instructions.append(
                f"Make the main person genuinely hold the handle of {name} from image {index} in one visible hand. "
                "Wrap the fingers around the handle, bend that elbow into an elegant relaxed pose, and keep the canopy above one shoulder. "
                "The canopy and shaft must not cross or cover the face."
            )
        elif kind == "shoe":
            instructions.append(
                f"Fit {name} from image {index} to the visible feet with correct left/right perspective, contact shadows and scale."
            )
        elif kind in {"bag", "sword"}:
            instructions.append(
                f"Put {name} from image {index} into one visible hand with physically correct finger contact and a relaxed fashion pose."
            )
        else:
            instructions.append(
                f"Wear or hold {name} from image {index} at its anatomically correct location with realistic contact and scale."
            )
    prompt = (
        "Edit image 1 only. Image 1 is a rough spatial layout, not a finished photograph. "
        "Image 2 is the clean virtual try-on and is the absolute identity, garment, body, lighting and background reference. "
        + ("; ".join(indexed) + ". " if indexed else "")
        + "Keep the exact face, hair color, age, skin tone, body proportions, garment design, garment print, background and every secondary person from image 2. "
        "Replace the pasted-looking accessories in image 1 with photorealistic versions matching their product references exactly. "
        + " ".join(instructions)
        + " Remove every overlay seam, guide line, marker dot, floating object, duplicated accessory and duplicate limb. "
        "Only the single largest central main person may change arm/hand pose, and only as much as needed to use the accessories. "
        "Do not change any secondary person. Do not redesign the clothing. Editorial fashion photography, anatomically correct hands, natural shadows."
    )
    generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed)
    return pipe(
        image=references,
        prompt=prompt,
        width=width,
        height=height,
        guidance_scale=float(os.getenv("JAPANO_ACCESSORY_REFINE_CFG", "1.0")),
        num_inference_steps=int(os.getenv("JAPANO_ACCESSORY_REFINE_STEPS", "4")),
        generator=generator,
    ).images[0].convert("RGB")


def run_accessory_refine_locked(
    rough_path: Path,
    clean_path: Path,
    accessory_paths: list[Path],
    metadata: list[dict],
    seed: int,
):
    global LAST_ENGINE
    with LOCK:
        GPU_ACTIVE_FILE.write_text(str(os.getpid()), encoding="utf-8")
        try:
            rough = open_rgb(rough_path)
            clean = open_rgb(clean_path)
            accessories = [open_rgb(item) for item in accessory_paths]
            for attempt in range(2):
                try:
                    result = refine_accessory_fit(
                        rough, clean, accessories, metadata, seed,
                        low_memory=attempt > 0,
                    )
                    output_path = RUNTIME_DIR / f"accessory-refined-{time.time_ns()}.png"
                    result.save(output_path)
                    LAST_ENGINE = "flux2-klein-4b-accessory-refine" + ("+adaptive-low-memory" if attempt else "")
                    return output_path
                except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
                    retryable = isinstance(exc, torch.cuda.OutOfMemoryError) or any(
                        marker in str(exc).lower()
                        for marker in ("out of memory", "gpu chưa đủ", "cuda error", "cublas")
                    )
                    unload_flux()
                    release_ollama_vram()
                    cuda_cleanup()
                    if not retryable or attempt == 1:
                        raise
                    print("=== GPU pressure: retrying accessory refinement at 576x768 ===", flush=True)
                    time.sleep(2)
        finally:
            unload_flux()
            GPU_ACTIVE_FILE.unlink(missing_ok=True)


def run_tryon(
    person_path: Path,
    cloth_path: Path,
    category: str,
    garment_photo_type: str,
    repose: bool,
    refine: bool,
    seed: int,
    low_memory: bool = False,
):
    global LAST_ENGINE
    release_ollama_vram()
    cuda_cleanup()
    person = open_rgb(person_path)
    reposed_path = RUNTIME_DIR / f"reposed-{time.time_ns()}.png"
    if repose:
        person = repose_main_subject(person, reposed_path, low_memory)
        # Do not keep the 13 GB edit model resident while loading FASHN.
        unload_flux()

    pipeline = load_fashn()
    cloth = open_rgb(cloth_path)
    output = pipeline(
        person_image=person,
        garment_image=cloth,
        category=category,
        garment_photo_type=garment_photo_type,
        num_samples=1,
        num_timesteps=int(os.getenv("JAPANO_FASHN_STEPS", "30")),
        guidance_scale=float(os.getenv("JAPANO_FASHN_CFG", "1.5")),
        seed=seed,
        segmentation_free=True,
    ).images[0].convert("RGB")
    refined = False
    if refine:
        unload_fashn()
        try:
            output = refine_garment_fidelity(output, cloth, low_memory)
            refined = True
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            # Fidelity refinement is cosmetic. A valid FASHN result is much
            # better than making the customer wait and then returning no image.
            print(f"=== Skipped optional FLUX fidelity refinement: {exc} ===", flush=True)
        finally:
            unload_flux()
    output_path = RUNTIME_DIR / f"tryon-{time.time_ns()}.png"
    output.save(output_path)
    stages = []
    if repose:
        stages.append("flux2-klein-4b-pose")
    stages.append("fashn-vton-1.5")
    if refined:
        stages.append("flux2-klein-4b-fidelity")
    elif refine:
        stages.append("fidelity-skipped-low-vram")
    if low_memory:
        stages.append("adaptive-low-memory")
    LAST_ENGINE = "+".join(stages)
    return output_path, reposed_path if repose else None


def run_tryon_locked(
    person_path: Path,
    cloth_path: Path,
    category: str,
    garment_photo_type: str,
    repose: bool,
    refine: bool,
    seed: int,
):
    """Serialize GPU jobs without ever blocking FastAPI's event loop.

    Acquiring a threading.Lock around an ``await run_in_threadpool(...)`` can
    deadlock: request B blocks the event loop waiting for the lock while request
    A needs that same event loop to resume and release it. Lock inside the worker
    thread instead, so concurrent requests queue safely.
    """
    with LOCK:
        GPU_ACTIVE_FILE.write_text(str(os.getpid()), encoding="utf-8")
        try:
            prefer_low_memory = os.getenv("JAPANO_TRYON_LOW_MEMORY", "1").strip().lower() not in {
                "0", "false", "no", "off"
            }
            for attempt in range(2):
                try:
                    return run_tryon(
                        person_path,
                        cloth_path,
                        category,
                        garment_photo_type,
                        repose,
                        refine,
                        seed,
                        low_memory=prefer_low_memory or attempt > 0,
                    )
                except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
                    retryable = isinstance(exc, torch.cuda.OutOfMemoryError) or any(
                        marker in str(exc).lower()
                        for marker in ("out of memory", "gpu chưa đủ", "cuda error", "cublas")
                    )
                    if not retryable:
                        raise
                    unload_flux()
                    unload_fashn()
                    release_ollama_vram()
                    cuda_cleanup()
                    if attempt == 1:
                        raise
                    print("=== GPU pressure: retrying the same try-on at 576x768 ===", flush=True)
                    time.sleep(2)
        finally:
            GPU_ACTIVE_FILE.unlink(missing_ok=True)
            # Máy này đồng thời chạy Android emulator và Remote Desktop. Giữ
            # model nằm trên GPU sau khi đã trả ảnh chỉ làm giao diện từ xa dễ
            # thiếu VRAM; lượt sau có thể nạp lại khi người dùng thật sự yêu cầu.
            if os.getenv("JAPANO_UNLOAD_AFTER_TRYON", "1").strip().lower() not in {"0", "false", "no", "off"}:
                unload_fashn()
                unload_flux()


@api.get("/health")
def health():
    model_ready = (FASHN_WEIGHTS / "model.safetensors").exists()
    flux_ready = (FLUX_HOME / "model_index.json").exists() and POSE_REFERENCE.exists()
    return {
        "ok": model_ready,
        "service": "JAPANO FASHN VTON 1.5 + FLUX.2 Pose API",
        "primary": "fashn-vton-1.5",
        "poseEditor": "flux2-klein-4b" if flux_ready else "unavailable",
        "accessoryRefiner": "flux2-klein-4b-multi-reference" if flux_ready else "unavailable",
        "modelReady": model_ready,
        "poseEditorReady": flux_ready,
        "loaded": {"fashn": FASHN_PIPELINE is not None, "flux": FLUX_PIPELINE is not None},
        "lastEngine": LAST_ENGINE,
        "singleSubject": True,
        "ollamaVramHandoff": os.getenv("JAPANO_RELEASE_OLLAMA_VRAM", "1") != "0",
        "gpuJobActive": GPU_ACTIVE_FILE.exists(),
    }


@api.post("/accessory-refine")
async def accessory_refine(
    rough: UploadFile = File(...),
    clean: UploadFile = File(...),
    accessories: list[UploadFile] = File(...),
    metadata: str = Form("[]"),
    seed: int = Form(101),
):
    if not accessories:
        raise HTTPException(status_code=400, detail="Thiếu ảnh phụ kiện tham chiếu")
    try:
        parsed = json.loads(metadata or "[]")
        if not isinstance(parsed, list):
            raise ValueError("metadata phải là mảng")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Metadata phụ kiện không hợp lệ: {exc}") from exc
    rough_path = RUNTIME_DIR / f"accessory-rough-{time.time_ns()}.png"
    clean_path = RUNTIME_DIR / f"accessory-clean-{time.time_ns()}.png"
    accessory_paths = []
    rough_path.write_bytes(await rough.read())
    clean_path.write_bytes(await clean.read())
    for index, upload in enumerate(accessories[:4]):
        item_path = RUNTIME_DIR / f"accessory-ref-{time.time_ns()}-{index}.png"
        item_path.write_bytes(await upload.read())
        accessory_paths.append(item_path)
    try:
        output_path = await run_in_threadpool(
            run_accessory_refine_locked,
            rough_path,
            clean_path,
            accessory_paths,
            parsed[: len(accessory_paths)],
            seed,
        )
        return FileResponse(
            output_path,
            media_type="image/png",
            headers={"x-japano-engine": LAST_ENGINE},
        )
    except torch.cuda.OutOfMemoryError as exc:
        raise HTTPException(status_code=507, detail="GPU không đủ VRAM cho bước làm đẹp phụ kiện") from exc
    except Exception as exc:
        print(f"Accessory refinement failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        rough_path.unlink(missing_ok=True)
        clean_path.unlink(missing_ok=True)
        for item_path in accessory_paths:
            item_path.unlink(missing_ok=True)


@api.post("/tryon")
async def tryon(
    person: UploadFile = File(...),
    cloth: UploadFile = File(...),
    category: str = Form("tops"),
    garment_photo_type: str = Form("model"),
    repose: bool = Form(False),
    refine: bool = Form(False),
    seed: int = Form(42),
):
    if category not in {"tops", "bottoms", "one-pieces"}:
        raise HTTPException(status_code=400, detail="category không hợp lệ")
    if garment_photo_type not in {"model", "flat-lay"}:
        raise HTTPException(status_code=400, detail="garment_photo_type không hợp lệ")
    person_path = RUNTIME_DIR / f"person-{time.time_ns()}.jpg"
    cloth_path = RUNTIME_DIR / f"cloth-{time.time_ns()}.jpg"
    person_path.write_bytes(await person.read())
    cloth_path.write_bytes(await cloth.read())
    try:
        output_path, reposed_path = await run_in_threadpool(
            run_tryon_locked, person_path, cloth_path, category, garment_photo_type, repose, refine, seed
        )
        return FileResponse(
            output_path,
            media_type="image/png",
            headers={
                "x-japano-engine": LAST_ENGINE,
                "x-japano-reposed": "true" if reposed_path else "false",
            },
        )
    except torch.cuda.OutOfMemoryError as exc:
        unload_flux()
        unload_fashn()
        raise HTTPException(status_code=507, detail="GPU không đủ VRAM cho pipeline thử đồ") from exc
    except Exception as exc:
        print(f"Try-on failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        person_path.unlink(missing_ok=True)
        cloth_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(api, host=os.getenv("JAPANO_FASHN_HOST", "127.0.0.1"), port=int(os.getenv("JAPANO_FASHN_PORT", "7862")))
