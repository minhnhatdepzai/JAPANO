"""JAPANO local try-on service.

FASHN VTON 1.5 is the primary garment engine.  FLUX.2 Klein is loaded only
for photos whose pose is unsuitable, then released before FASHN is loaded so
both models fit on a 16 GB GPU.
"""

import ctypes
import gc
import hashlib
import json
import os
import threading
import time
import urllib.request
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageFilter, ImageOps
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
# Khoá riêng cho trạng thái LoRA: KHÔNG dùng chung với LOCK (hàng đợi GPU) để
# hai request đồng thời không khoá chéo nhau.
LORA_LOCK = threading.Lock()
LORA_STATE: dict = {"loaded": False, "path": "", "fingerprint": "", "pipe": None}
# LoRA fit được train trên VITON-HD (upper-body). Không áp cho quần, kimono hay
# đồ liền thân vì validation không có dữ liệu của các miền đó.
FIT_LORA_CATEGORIES = [
    item.strip() for item in os.getenv("JAPANO_FIT_LORA_CATEGORIES", "tops").split(",") if item.strip()
]
CANCEL_REQUESTED = threading.Event()
FASHN_PIPELINE = None
FLUX_PIPELINE = None
LAST_ENGINE = ""
GPU_ACTIVE_FILE = Path(os.getenv("JAPANO_TRYON_GPU_LOCK", "/tmp/japano-tryon-gpu.active")).resolve()

api = FastAPI(title="JAPANO FASHN VTON 1.5 + FLUX.2 Pose API")


class GpuJobCancelled(RuntimeError):
    pass


def check_cancelled():
    if CANCEL_REQUESTED.is_set():
        raise GpuJobCancelled("Lượt thử đồ đã dừng vì người dùng đổi tính năng.")


def cuda_cleanup():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


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


def gpu_job_active() -> bool:
    """Có lượt thử đồ đang chạy thật hay không.

    Khoá ghi PID tiến trình đang giữ GPU. Nếu tiến trình đó đã chết (máy sập,
    service bị kill) thì khoá còn sót lại là khoá mồ côi — phải dọn đi, nếu
    không mọi yêu cầu nhả VRAM về sau đều bị từ chối oan.
    """
    if not GPU_ACTIVE_FILE.exists():
        return False
    try:
        pid = int(GPU_ACTIVE_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return True
    if pid == os.getpid():
        return True
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        GPU_ACTIVE_FILE.unlink(missing_ok=True)
        print(f"=== Dọn khoá GPU mồ côi của tiến trình {pid} ===", flush=True)
        return False
    except PermissionError:
        return True


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
            # "none" giữ toàn bộ pipeline trên GPU — nhanh nhất, tốn VRAM nhất.
            # Chỉ dùng khi máy không chạy kèm emulator hay tiến trình GPU khác.
            offload = os.getenv("JAPANO_FLUX_OFFLOAD", "sequential").strip().lower()
            if offload in {"none", "off", "0", "full"}:
                FLUX_PIPELINE.to("cuda")
            elif offload == "model":
                FLUX_PIPELINE.enable_model_cpu_offload()
            else:
                FLUX_PIPELINE.enable_sequential_cpu_offload()
        LAST_ENGINE = "flux2-klein-4b-pose"
    return FLUX_PIPELINE


def open_rgb(path: Path) -> Image.Image:
    with Image.open(path) as source:
        return ImageOps.exif_transpose(source).convert("RGB")


def polish_output(image: Image.Image) -> Image.Image:
    """Xuất ảnh nét đồng nhất mà không gọi thêm model sinh ảnh.

    FASHN gốc sinh ở lưới suy luận của model. Upscale Lanczos + unsharp nhẹ giữ nguyên
    danh tính/pattern, khác với đưa qua một generative upscaler có thể vẽ lại
    mặt và logo. Các phép tính inference vẫn chạy trên CUDA; FLUX có thể chuyển
    tuần tự phần weights không hoạt động về RAM để vừa GPU 16 GB.
    """
    result = image.convert("RGB")
    target_long_edge = max(0, int(os.getenv("JAPANO_TRYON_OUTPUT_LONG_EDGE", "1536")))
    current_long_edge = max(result.size)
    if target_long_edge and current_long_edge < target_long_edge:
        scale = target_long_edge / current_long_edge
        result = result.resize(
            (max(1, round(result.width * scale)), max(1, round(result.height * scale))),
            Image.Resampling.LANCZOS,
        )
    if os.getenv("JAPANO_TRYON_OUTPUT_SHARPEN", "1").strip().lower() not in {"0", "false", "no", "off"}:
        result = result.filter(ImageFilter.UnsharpMask(radius=1.1, percent=105, threshold=3))
    return result


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
        "If image 2 is an open-front outer jacket, coat, cardigan or Haori, keep it visibly open, preserve the existing inner shirt through the opening, "
        "and match its full sleeve width, sleeve length and long hem. Never turn long outerwear into a short-sleeve shirt, cropped blazer, dress or closed robe. "
        "Preserve the trousers, skirt or other lower garment already present in image 1 exactly; the outer garment may overlap it naturally but must not replace it. "
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


# --- Mô phỏng độ vừa vặn (fit) ----------------------------------------------
# FASHN chịu trách nhiệm MẶC ĐÚNG trang phục; bước dưới đây chịu trách nhiệm
# làm trang phục đó trông đúng độ chật/rộng trên chính cơ thể của khách.
#
# Nguyên tắc: không bao giờ đổi cơ thể để quần áo vừa. Người 100kg mặc áo S thì
# chiếc áo S phải căng trên người 100kg — không phải AI làm người gầy đi.
FIT_ZONE_FOCUS = {
    "tops": {
        "tight": "chest, shoulders, upper arms, belly and the button placket",
        "loose": "shoulder seams, sleeve width and length, chest volume and hem width",
    },
    "bottoms": {
        "tight": "waistband, hips and thighs, with natural and non-explicit tension",
        "loose": "waistband, hip room, wide leg openings and stacked folds",
    },
    "one-pieces": {
        "tight": "shoulders, bust, waist, hips and the overall length",
        "loose": "shoulders, bust volume, waist, hips, hem width and overall length",
    },
}
FIT_OUTERWEAR_NOTE = (
    "This is a Japanese fashion garment (kimono, yukata, haori or outerwear): keep the collar overlap, "
    "the wide rectangular sleeve construction, the belt/obi position and the original hem line intact. "
)

IDENTITY_LOCK = (
    "Keep the same person: same face, hair, skin tone, body size and shape, pose, hands, feet, "
    "background and lighting. Do not make the person thinner, fatter, taller or shorter. "
)
GARMENT_LOCK = (
    "Keep the garment's colour, pattern, print, logos, collar, buttons and design unchanged. "
)
SAFETY_LOCK = (
    "Damage affects fabric only: no injury, no blood, no nudity, no exposed private areas; "
    "keep a neutral inner layer visible behind any split. Photorealistic. "
)

# Ràng buộc riêng cho trang phục hở da. Đây KHÔNG phải là gợi ý phong cách mà là
# ràng buộc an toàn: với đồ bơi, "quá chật" mà xử lý như áo thun đồng nghĩa với
# việc tạo ra ảnh hở vùng nhạy cảm.
COVERAGE_LOCK = (
    "Keep the garment's coverage exactly as designed: the chest, pelvis and buttocks stay fully covered "
    "at all times. Do not shrink, pull aside, remove or make any part of the garment transparent. "
    "Do not add cleavage, do not enlarge the bust or hips, do not sexualise the pose or the body. "
)
SWIMWEAR_LOCK = (
    "This is ordinary swimwear on an adult. Never tear, split or open it. Excess tightness shows only as "
    "slightly taut straps and fabric, never as exposure. Keep every strap, tie and panel intact and in place. "
)
CROP_LOCK = (
    "This is a cropped garment: keep its hem exactly where it is. Never lengthen it to cover the midriff, "
    "and never shorten it further. The exposed midriff is intentional; render it as natural skin that matches "
    "the face and arms in tone and texture. "
)
SHORT_HEM_LOCK = (
    "Keep the hem length of the shorts or skirt exactly as designed — neither shorter nor longer — and keep "
    "the pelvis and buttocks fully covered. "
)
JAPANESE_LOCK = (
    "Preserve the traditional Japanese construction: collar overlap direction, wide rectangular sleeve panels, "
    "the obi/belt position and the original hem line. "
)

SWIMWEAR_TYPES = {"bikini_top", "bikini_bottom", "bikini_two_piece", "one_piece_swimsuit"}
CROP_TYPES = {"crop_top"}
SHORT_HEM_TYPES = {"shorts", "short_skirt"}
JAPANESE_TYPES = {"kimono", "yukata", "haori", "hakama", "jinbei", "samue", "noragi", "happi"}


def build_fit_prompt(
    category: str,
    verdict: str,
    severity: float,
    tear_allowed: bool,
    outerwear: bool = False,
    has_garment_reference: bool = False,
    garment_type: str = "",
    force_tear: bool = False,
) -> str:
    """Prompt cho FLUX.2 — mô tả ĐỘ VỪA VẶN, không mô tả sản phẩm cụ thể.

    Prompt cố ý NGẮN và đặt mệnh lệnh "chỉ sửa độ vừa vặn" lên đầu. Bản dài
    trước đây (kèm ba đoạn khoá dài dòng) khiến model bỏ qua ảnh gốc và vẽ lại
    cả khung cảnh — chạy thật cho ra một người khác ngồi trên ghế sofa.
    """
    focus = FIT_ZONE_FOCUS.get(category, FIT_ZONE_FOCUS["tops"])
    header = (
        "Edit image 1. Change ONLY how the clothing fits the body; everything else stays identical. "
    )
    if has_garment_reference:
        header = (
            "Edit image 1. Image 2 is the flat-lay reference of the same garment — match its colour and pattern. "
            "Change ONLY how the clothing fits the body in image 1; everything else stays identical. "
        )
    outer_note = FIT_OUTERWEAR_NOTE if outerwear else ""
    swimwear = garment_type in SWIMWEAR_TYPES
    # Đồ bơi: cấm tuyệt đối hiệu ứng rách, bất kể tham số truyền vào.
    if swimwear:
        tear_allowed = False

    if verdict in {"slightly_tight", "tight", "very_tight"}:
        body = f"The garment is too small for this body. Make it look too tight around the {focus['tight']}. "
        if verdict == "slightly_tight":
            body += "Body-hugging with few folds and mild stretch. No damage, no open seams. "
        elif verdict == "tight":
            body += (
                "Fabric stretched taut with radiating tension wrinkles, seams pulled straight, "
                "sleeves gripping the arms, straining buttons with small gaps, hem riding up. No tears. "
            )
        else:
            body += (
                "Fabric pulled drum-tight, strong tension wrinkles, stressed seams partially separating at a "
                "shoulder or side seam, pulled buttonholes, sleeves and hem too short for this body. "
            )
            if tear_allowed and force_tear:
                body += (
                    "MUST show exactly ONE clearly visible 5-10 cm split at an outer shoulder or side garment seam, "
                    "with stretched stitches and a few frayed threads. Put an opaque neutral inner layer behind the "
                    "split: no bare skin, no injury. The seam split is required because no sold size fits. "
                )
            elif tear_allowed:
                body += "Allow ONE small realistic split along a garment seam with frayed threads. "
            else:
                body += "Do not tear the garment; keep strain at stressed seams only. "
    elif verdict in {"slightly_loose", "loose", "very_loose"}:
        body = f"The garment is too large for this body. Make it look oversized at the {focus['loose']}. "
        if verdict == "slightly_loose":
            body += "Shoulder seams slightly past the shoulder points, a little extra fabric, a few soft folds. "
        elif verdict == "loose":
            body += (
                "Shoulder seams dropped well past the shoulders, wide sleeves running long over the hands, "
                "a boxy body with a visible air gap between fabric and torso, many soft hanging folds. "
            )
        else:
            body += (
                "The garment hangs off the body like a wide robe: shoulders dropped far down the upper arms, "
                "sleeves swallowing the hands, deep cascading drape folds, a very wide flowing hem. "
                "The body inside stays small and unchanged; the empty volume belongs to the garment. "
            )
    else:
        body = "Show a clean correct fit with natural folds, no straining and no artificial volume. "

    coverage_note = COVERAGE_LOCK
    if swimwear:
        coverage_note += SWIMWEAR_LOCK
    if garment_type in CROP_TYPES:
        coverage_note += CROP_LOCK
    if garment_type in SHORT_HEM_TYPES:
        coverage_note += SHORT_HEM_LOCK
    if garment_type in JAPANESE_TYPES:
        coverage_note += JAPANESE_LOCK
    return header + body + outer_note + IDENTITY_LOCK + GARMENT_LOCK + coverage_note + SAFETY_LOCK


def _lora_checkpoint_file(path: Path) -> Path | None:
    """File trọng số thật bên trong thư mục checkpoint (nếu có)."""
    if path.is_file():
        return path
    for name in ("pytorch_lora_weights.safetensors", "adapter_model.safetensors"):
        candidate = path / name
        if candidate.exists():
            return candidate
    weights = sorted(path.glob("*.safetensors"))
    return weights[0] if weights else None


def _lora_fingerprint(path: Path) -> str:
    """Vân tay checkpoint để health endpoint và log nói đúng bản nào đang chạy."""
    target = _lora_checkpoint_file(path)
    if target is None:
        return ""
    stat = target.stat()
    digest = hashlib.sha256()
    with open(target, "rb") as handle:
        digest.update(handle.read(1 << 20))
    return f"{digest.hexdigest()[:16]}-{stat.st_size}"


def apply_fit_lora(pipe):
    """Gắn LoRA fit vào pipeline — nạp ĐÚNG MỘT LẦN cho mỗi checkpoint.

    Trước đây hàm này gọi `load_lora_weights()` trong MỌI request. Với LoRA vài
    trăm MB, đó là vài giây bị đốt mỗi lượt thử đồ, và các adapter chồng lên
    nhau qua từng lần gọi. Nay adapter được cache theo (đường dẫn, vân tay
    checkpoint): đổi checkpoint hoặc ghi đè file thì tự nạp lại, còn không thì
    dùng lại adapter đang gắn sẵn.

    LORA_LOCK bảo vệ trạng thái này khỏi hai request đồng thời. Nó KHÁC với
    LOCK (hàng đợi GPU) nên không gây deadlock.
    """
    global LORA_STATE
    lora_path = os.getenv("JAPANO_FIT_LORA_PATH", "").strip()
    with LORA_LOCK:
        if not lora_path:
            if LORA_STATE.get("loaded") and LORA_STATE.get("pipe") is pipe:
                try:
                    pipe.unload_lora_weights()
                except Exception:
                    pass
            LORA_STATE = {"loaded": False, "path": "", "fingerprint": "", "pipe": None}
            return False

        path = Path(lora_path).expanduser()
        if not path.exists():
            print(f"=== Fit LoRA not found at {path}; using base FLUX.2 ===", flush=True)
            LORA_STATE = {"loaded": False, "path": str(path), "fingerprint": "", "pipe": None,
                          "error": "checkpoint_missing"}
            return False

        fingerprint = _lora_fingerprint(path)
        if not fingerprint:
            print(f"=== Fit LoRA at {path} has no .safetensors; using base FLUX.2 ===", flush=True)
            LORA_STATE = {"loaded": False, "path": str(path), "fingerprint": "", "pipe": None,
                          "error": "no_safetensors"}
            return False

        already = (
            LORA_STATE.get("loaded")
            and LORA_STATE.get("path") == str(path)
            and LORA_STATE.get("fingerprint") == fingerprint
            and LORA_STATE.get("pipe") is pipe
        )
        if already:
            return True

        try:
            if LORA_STATE.get("loaded") and LORA_STATE.get("pipe") is pipe:
                pipe.unload_lora_weights()
            pipe.load_lora_weights(str(path))
            LORA_STATE = {"loaded": True, "path": str(path), "fingerprint": fingerprint, "pipe": pipe}
            print(f"=== Fit LoRA loaded once: {path} [{fingerprint}] ===", flush=True)
            return True
        except Exception as exc:
            print(f"=== Fit LoRA could not be loaded ({exc}); using base FLUX.2 ===", flush=True)
            LORA_STATE = {"loaded": False, "path": str(path), "fingerprint": fingerprint,
                          "pipe": None, "error": str(exc)[:200]}
            return False


def _detach_fit_lora(pipe) -> bool:
    """Gỡ LoRA khi danh mục nằm ngoài miền dữ liệu đã train."""
    global LORA_STATE
    with LORA_LOCK:
        if LORA_STATE.get("loaded") and LORA_STATE.get("pipe") is pipe:
            try:
                pipe.unload_lora_weights()
            except Exception:
                pass
            LORA_STATE = {**LORA_STATE, "loaded": False, "pipe": None, "detachedForCategory": True}
    return False


def fit_lora_status() -> dict:
    """Trạng thái adapter cho /health — không bao giờ lộ nội dung secret."""
    configured = os.getenv("JAPANO_FIT_LORA_PATH", "").strip()
    with LORA_LOCK:
        state = dict(LORA_STATE)
    return {
        "configuredPath": configured or None,
        "adapterLoaded": bool(state.get("loaded")),
        "checkpointHash": state.get("fingerprint") or None,
        "error": state.get("error"),
        # LoRA hiện chỉ được train trên dữ liệu upper-body nên chỉ áp cho `tops`.
        "appliesToCategories": FIT_LORA_CATEGORIES,
    }


def refine_fit(
    tryon_image: Image.Image,
    garment: Image.Image | None,
    category: str,
    verdict: str,
    severity: float,
    tear_allowed: bool,
    outerwear: bool,
    seed: int,
    low_memory: bool = False,
    garment_type: str = "",
    force_tear: bool = False,
) -> tuple[Image.Image, bool]:
    """Sửa độ vừa vặn trên ảnh đã mặc đồ xong.

    `garment` chỉ được truyền vào khi đó là ảnh flat-lay sạch (nền trắng, không
    có người). Ảnh sản phẩm chụp trên người mẫu tuyệt đối KHÔNG được dùng làm
    tham chiếu ở đây: chạy thật cho thấy FLUX lấy luôn khung cảnh của ảnh đó —
    trả về một người khác ngồi trên ghế sofa thay vì khách hàng.
    """
    pipe = load_flux()
    # LoRA chỉ được áp cho danh mục nằm trong miền dữ liệu đã train. Với các
    # danh mục khác, hàm dưới đây tự gỡ adapter và chạy FLUX gốc.
    lora = apply_fit_lora(pipe) if category in FIT_LORA_CATEGORIES else _detach_fit_lora(pipe)
    width, height = normalized_output_size(tryon_image, low_memory)
    prompt = build_fit_prompt(
        category, verdict, severity, tear_allowed, outerwear,
        has_garment_reference=garment is not None,
        garment_type=garment_type,
        force_tear=force_tear,
    )
    generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed)
    # Fit là hiệu ứng hình học mạnh hơn một lượt làm đẹp thông thường, nên cho
    # phép nhiều bước hơn khi độ lệch size lớn — vẫn giữ trần thấp vì FLUX là
    # phần tốn VRAM nhất của cả pipeline.
    steps = int(os.getenv("JAPANO_FIT_STEPS", "4"))
    if severity >= 0.72:
        steps = int(os.getenv("JAPANO_FIT_STEPS_EXTREME", str(max(steps, 6))))
    if force_tear and tear_allowed:
        steps = max(steps, int(os.getenv("JAPANO_FIT_STEPS_FORCE_TEAR", "5")))
    references = [tryon_image] if garment is None else [tryon_image, garment]
    result = pipe(
        image=references,
        prompt=prompt,
        width=width,
        height=height,
        guidance_scale=float(os.getenv("JAPANO_FIT_CFG", "1.0")),
        num_inference_steps=steps,
        generator=generator,
    ).images[0].convert("RGB")
    return result, lora


def run_fit_refine_locked(
    tryon_path: Path,
    garment_path: Path | None,
    category: str,
    verdict: str,
    severity: float,
    tear_allowed: bool,
    outerwear: bool,
    seed: int,
    garment_type: str = "",
    force_tear: bool = False,
):
    """Chạy fit-refine với đúng kỷ luật VRAM: nhả FASHN trước khi nạp FLUX."""
    global LAST_ENGINE
    with LOCK:
        GPU_ACTIVE_FILE.write_text(str(os.getpid()), encoding="utf-8")
        try:
            check_cancelled()
            release_ollama_vram()
            unload_fashn()
            cuda_cleanup()
            tryon_image = open_rgb(tryon_path)
            garment = open_rgb(garment_path) if garment_path is not None else None
            # FASHN vẫn suy luận 768x1024 để khóa chi tiết áo. Fit-refine chỉ
            # sửa hình học ôm/rủ nên dùng canvas 576x768, sau đó polish về 1536;
            # tiết kiệm ~44% pixel cho FLUX mà không hạ ảnh VTON gốc.
            prefer_low_memory = os.getenv("JAPANO_FIT_LOW_MEMORY", "1").strip().lower() not in {
                "0", "false", "no", "off"
            }
            for attempt in range(2):
                try:
                    check_cancelled()
                    output, lora = refine_fit(
                        tryon_image, garment, category, verdict, severity, tear_allowed, outerwear, seed,
                        low_memory=prefer_low_memory or attempt > 0, garment_type=garment_type,
                        force_tear=force_tear,
                    )
                    break
                except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
                    retryable = isinstance(exc, torch.cuda.OutOfMemoryError) or any(
                        marker in str(exc).lower()
                        for marker in ("out of memory", "gpu chưa đủ", "cuda error", "cublas")
                    )
                    if not retryable or attempt == 1:
                        raise
                    unload_flux()
                    release_ollama_vram()
                    cuda_cleanup()
                    print("=== GPU pressure: retrying fit refine at reduced resolution ===", flush=True)
                    time.sleep(2)
            output_path = RUNTIME_DIR / f"fit-{time.time_ns()}.png"
            output = polish_output(output)
            output.save(output_path, optimize=True)
            LAST_ENGINE = "flux2-klein-4b-fit-refine" + ("+japano-fit-lora" if lora else "")
            return output_path
        finally:
            GPU_ACTIVE_FILE.unlink(missing_ok=True)
            # Cùng chính sách với run_tryon_locked: JAPANO_UNLOAD_AFTER_TRYON=0
            # giữ FLUX lại giữa các lượt liên tiếp. Trước đây bước fit LUÔN nhả
            # model, nên sinh dataset hay thử nhiều size liền nhau phải nạp lại
            # ~15GB mỗi lần. GPU arbiter vẫn tự giải phóng khi đổi tính năng.
            if os.getenv("JAPANO_UNLOAD_AFTER_TRYON", "1").strip().lower() not in {"0", "false", "no", "off"}:
                unload_flux()
            cuda_cleanup()


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
        elif kind == "hair_clip":
            instructions.append(
                f"Fasten {name} from image {index} into the hair beside one temple, above and slightly behind one ear. "
                "Keep it compact, preserve its exact flowers, bow and dangling ornament, and never float it above the head or cover the face."
            )
        elif kind == "earmuffs":
            instructions.append(
                f"Make the main person wear {name} from image {index} correctly: one padded cup centered over each ear and the band following the crown. "
                "Keep both eyes and the entire face visible; do not turn it into a hat, handheld toy or duplicate object."
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
            check_cancelled()
            rough = open_rgb(rough_path)
            clean = open_rgb(clean_path)
            accessories = [open_rgb(item) for item in accessory_paths]
            for attempt in range(2):
                try:
                    check_cancelled()
                    result = refine_accessory_fit(
                        rough, clean, accessories, metadata, seed,
                        low_memory=attempt > 0,
                    )
                    check_cancelled()
                    output_path = RUNTIME_DIR / f"accessory-refined-{time.time_ns()}.png"
                    result = polish_output(result)
                    result.save(output_path, optimize=True)
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
    check_cancelled()
    release_ollama_vram()
    cuda_cleanup()
    person = open_rgb(person_path)
    reposed_path = RUNTIME_DIR / f"reposed-{time.time_ns()}.png"
    if repose:
        person = repose_main_subject(person, reposed_path, low_memory)
        check_cancelled()
        # Do not keep the 13 GB edit model resident while loading FASHN.
        unload_flux()

    pipeline = load_fashn()
    check_cancelled()
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
    check_cancelled()
    refined = False
    if refine:
        unload_fashn()
        try:
            output = refine_garment_fidelity(output, cloth, low_memory)
            check_cancelled()
            refined = True
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            # Fidelity refinement is cosmetic. A valid FASHN result is much
            # better than making the customer wait and then returning no image.
            print(f"=== Skipped optional FLUX fidelity refinement: {exc} ===", flush=True)
        finally:
            unload_flux()
    output_path = RUNTIME_DIR / f"tryon-{time.time_ns()}.png"
    output = polish_output(output)
    output.save(output_path, optimize=True)
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
                    check_cancelled()
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


def warm_fashn_locked():
    """Nạp FASHN khi người dùng vừa mở màn thử đồ, trước lúc bấm Tạo ảnh."""
    with LOCK:
        GPU_ACTIVE_FILE.write_text(str(os.getpid()), encoding="utf-8")
        try:
            CANCEL_REQUESTED.clear()
            pipeline = load_fashn()
            free_bytes = torch.cuda.mem_get_info()[0] if torch.cuda.is_available() else 0
            return {"ok": pipeline is not None, "engine": "fashn-vton-1.5", "freeVramGb": round(free_bytes / (1024 ** 3), 2)}
        finally:
            GPU_ACTIVE_FILE.unlink(missing_ok=True)


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
        "fitRefiner": "flux2-klein-4b-fit-refine" if flux_ready else "unavailable",
        "fitRefinerReady": flux_ready,
        "fitLora": fit_lora_status(),
        "modelReady": model_ready,
        "poseEditorReady": flux_ready,
        "loaded": {"fashn": FASHN_PIPELINE is not None, "flux": FLUX_PIPELINE is not None},
        "lastEngine": LAST_ENGINE,
        "singleSubject": True,
        "ollamaVramHandoff": os.getenv("JAPANO_RELEASE_OLLAMA_VRAM", "1") != "0",
        "gpuJobActive": gpu_job_active(),
        "quality": {
            "fashnSteps": int(os.getenv("JAPANO_FASHN_STEPS", "30")),
            "fluxOffload": os.getenv("JAPANO_FLUX_OFFLOAD", "sequential"),
            "lowMemory": os.getenv("JAPANO_TRYON_LOW_MEMORY", "1") not in {"0", "false", "no", "off"},
            "fitLowMemory": os.getenv("JAPANO_FIT_LOW_MEMORY", "1") not in {"0", "false", "no", "off"},
            "outputLongEdge": int(os.getenv("JAPANO_TRYON_OUTPUT_LONG_EDGE", "1536")),
        },
    }


@api.post("/warmup")
async def warmup():
    """Pre-warm không sinh ảnh; GPU arbiter gọi khi màn try-on được focus."""
    try:
        return await run_in_threadpool(warm_fashn_locked)
    except Exception as exc:
        print(f"FASHN warmup failed: {exc}", flush=True)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@api.post("/unload")
def unload_models():
    """Nhả toàn bộ VRAM đang giữ, để tính năng khác (tạo chuyển động, chatbot,
    vision) được ưu tiên GPU. Bộ điều phối GPU ở backend Node gọi endpoint này
    khi người dùng chuyển sang màn hình khác; model sẽ tự nạp lại ở lượt thử đồ
    kế tiếp nên không mất chức năng, chỉ tốn thêm thời gian nạp lần đầu."""
    if gpu_job_active():
        # Đang có lượt thử đồ chạy dở — nhả model giữa chừng sẽ làm hỏng chính
        # tác vụ người dùng đang chờ. Từ chối một cách tường minh.
        return {"ok": False, "skipped": "gpu-job-active", "loaded": {"fashn": FASHN_PIPELINE is not None, "flux": FLUX_PIPELINE is not None}}
    was = {"fashn": FASHN_PIPELINE is not None, "flux": FLUX_PIPELINE is not None}
    unload_fashn()
    unload_flux()
    cuda_cleanup()
    free_bytes = torch.cuda.mem_get_info()[0] if torch.cuda.is_available() else 0
    print(f"=== Unload theo yêu cầu: {was} -> đã nhả, VRAM trống {free_bytes / (1024 ** 3):.1f} GB ===", flush=True)
    return {"ok": True, "unloaded": was, "freeVramGb": round(free_bytes / (1024 ** 3), 2)}


@api.post("/cancel")
def cancel_active_job():
    """Yêu cầu job hiện tại dừng ở checkpoint an toàn gần nhất."""
    active = gpu_job_active() or LOCK.locked()
    CANCEL_REQUESTED.set()
    return {"ok": True, "cancelled": active, "cooperative": True}


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
        CANCEL_REQUESTED.clear()
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
    except GpuJobCancelled as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Accessory refinement failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        rough_path.unlink(missing_ok=True)
        clean_path.unlink(missing_ok=True)
        for item_path in accessory_paths:
            item_path.unlink(missing_ok=True)


@api.post("/fit-refine")
async def fit_refine(
    person: UploadFile = File(...),
    cloth: UploadFile | None = File(None),
    category: str = Form("tops"),
    verdict: str = Form("good"),
    severity: float = Form(0.0),
    tear_allowed: bool = Form(False),
    force_tear: bool = Form(False),
    outerwear: bool = Form(False),
    selected_size: str = Form(""),
    recommended_size: str = Form(""),
    seed: int = Form(77),
    garment_type: str = Form(""),
):
    """Mô phỏng độ vừa vặn trên ảnh ĐÃ mặc đồ xong.

    Tách khỏi /tryon có chủ đích: FASHN giữ đúng trang phục, còn bước này chỉ
    sửa cách vải ôm/rủ. Backend gọi nó một cách có điều kiện (chỉ khi lệch size
    đủ lớn) để không đốt VRAM cho những lượt thử vốn đã vừa người.
    """
    allowed = {
        "good", "slightly_tight", "tight", "very_tight",
        "slightly_loose", "loose", "very_loose",
    }
    if verdict not in allowed:
        raise HTTPException(status_code=400, detail="verdict không hợp lệ")
    if category not in {"tops", "bottoms", "one-pieces"}:
        raise HTTPException(status_code=400, detail="category không hợp lệ")
    if verdict == "good":
        raise HTTPException(status_code=400, detail="Size đã vừa, không cần mô phỏng fit")
    person_path = RUNTIME_DIR / f"fit-person-{time.time_ns()}.png"
    person_path.write_bytes(await person.read())
    # Ảnh vải là TUỲ CHỌN và chỉ nên gửi khi là flat-lay sạch — xem refine_fit().
    cloth_path = None
    if cloth is not None:
        cloth_bytes = await cloth.read()
        if cloth_bytes:
            cloth_path = RUNTIME_DIR / f"fit-cloth-{time.time_ns()}.jpg"
            cloth_path.write_bytes(cloth_bytes)
    print(
        f"=== [FIT REFINE] verdict={verdict} severity={severity:.2f} category={category} "
        f"selected={selected_size or '?'} recommended={recommended_size or '?'} tear={bool(tear_allowed)} "
        f"forceTear={bool(force_tear)} "
        f"garmentRef={cloth_path is not None} ===",
        flush=True,
    )
    try:
        CANCEL_REQUESTED.clear()
        output_path = await run_in_threadpool(
            run_fit_refine_locked,
            person_path, cloth_path, category, verdict, float(severity),
            bool(tear_allowed), bool(outerwear), int(seed), garment_type, bool(force_tear),
        )
        return FileResponse(
            output_path,
            media_type="image/png",
            headers={"x-japano-engine": LAST_ENGINE, "x-japano-fit-verdict": verdict},
        )
    except torch.cuda.OutOfMemoryError as exc:
        unload_flux()
        unload_fashn()
        raise HTTPException(status_code=507, detail="GPU không đủ VRAM cho bước mô phỏng độ vừa vặn") from exc
    except GpuJobCancelled as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Fit refine failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        person_path.unlink(missing_ok=True)
        if cloth_path is not None:
            cloth_path.unlink(missing_ok=True)


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
        CANCEL_REQUESTED.clear()
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
    except GpuJobCancelled as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Try-on failed: {exc}", flush=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        person_path.unlink(missing_ok=True)
        cloth_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(api, host=os.getenv("JAPANO_FASHN_HOST", "127.0.0.1"), port=int(os.getenv("JAPANO_FASHN_PORT", "7862")))
