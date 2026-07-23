"""Resource-guarded One-to-All Animation service for JAPANO.

The service stays lightweight while idle.  A short-lived CUDA process is
started only after the customer selects one action, and a separate semantic
quality process validates the resulting clip before it can reach the app.
There is deliberately no CPU or legacy LTX fallback.
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


ROOT = Path(__file__).resolve().parent.parent
MODEL_HOME = Path(
    os.getenv("JAPANO_ONE_TO_ALL_HOME", str(Path.home() / "jp/ai/One-to-All-Animation"))
).expanduser().resolve()
MODEL_PYTHON = Path(
    os.getenv("JAPANO_ONE_TO_ALL_PYTHON", str(MODEL_HOME / ".venv/bin/python"))
).expanduser()
MODEL_ROOT = MODEL_HOME / "pretrained_models/Wan2.1-T2V-1.3B-Diffusers"
CHECKPOINT_ROOT = MODEL_HOME / "checkpoints/One-to-All-1.3b_2"
POSE_ROOT = MODEL_HOME / "pretrained_models/process_checkpoint"
RUNNER = ROOT / "backend/one_to_all_runner.py"
QUALITY = ROOT / "backend/motion_quality.py"
RUNTIME = Path(os.getenv("JAPANO_MOTION_RUNTIME_DIR", "/tmp/japano-motion-runtime")).resolve()
RUNTIME.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()
WARMED = False
CUDA_RUNTIME_OK: bool | None = None
GIB = 1024 * 1024 * 1024
ENGINE = "one-to-all-animation-1.3b-v2"

MOTIONS = {
    "runway_walk": "Đi một vòng",
    "spin": "Xoay một vòng",
    "jump": "Nhảy lên",
    "pose_sway": "Khoe dáng qua lại",
    "sit_stand": "Đứng lên · ngồi xuống",
}


class MotionRequest(BaseModel):
    imageBase64: str
    motion: str
    seed: int = 42


class MotionQualityError(RuntimeError):
    """The new model ran, but its result is not safe to show customers."""


api = FastAPI(title="JAPANO One-to-All local motion service")


def indexed_files_exist(folder: Path, index_name: str) -> bool:
    index_path = folder / index_name
    if not index_path.is_file():
        return False
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
        names = set(index.get("weight_map", {}).values())
        return bool(names) and all((folder / name).is_file() for name in names)
    except (OSError, ValueError, TypeError):
        return False


def model_files_ready() -> bool:
    required = (
        MODEL_PYTHON,
        RUNNER,
        QUALITY,
        MODEL_HOME / "video-generation/configs/wan2.1_t2v_1.3b.json",
        MODEL_HOME / "video-generation/configs/wan2.1_t2v_1.3b_controlnet_2.json",
        MODEL_HOME / "video-generation/configs/wan2.1_t2v_1.3b_refextractor_2d_withmask2.json",
        MODEL_ROOT / "vae/diffusion_pytorch_model.safetensors",
        POSE_ROOT / "det/yolov10m.onnx",
        POSE_ROOT / "pose2d/vitpose_h_wholebody.onnx/end2end.onnx",
    )
    checkpoint_shards = list(CHECKPOINT_ROOT.glob("*.safetensors"))
    return (
        all(path.is_file() for path in required)
        and len(checkpoint_shards) == 2
        and indexed_files_exist(MODEL_ROOT / "text_encoder", "model.safetensors.index.json")
    )


def cuda_runtime_ready(refresh: bool = False) -> bool:
    global CUDA_RUNTIME_OK
    if CUDA_RUNTIME_OK is not None and not refresh:
        return CUDA_RUNTIME_OK
    if not MODEL_PYTHON.is_file() or not shutil.which("nvidia-smi"):
        CUDA_RUNTIME_OK = False
        return False
    try:
        probe = subprocess.run(
            [
                str(MODEL_PYTHON),
                "-c",
                "import torch,onnxruntime as o; raise SystemExit(0 if torch.cuda.is_available() and 'CUDAExecutionProvider' in o.get_available_providers() else 1)",
            ],
            capture_output=True,
            timeout=15,
        )
        CUDA_RUNTIME_OK = probe.returncode == 0
    except (OSError, subprocess.SubprocessError):
        CUDA_RUNTIME_OK = False
    return CUDA_RUNTIME_OK


def available_memory_gib() -> float:
    try:
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) * 1024 / GIB
    except (OSError, ValueError, IndexError):
        pass
    return 0.0


def gpu_memory() -> tuple[int, int]:
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=memory.total,memory.used",
                "--format=csv,noheader,nounits",
                "--id=" + os.getenv("JAPANO_MOTION_GPU", "0"),
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        total, used = (int(part.strip()) for part in result.stdout.splitlines()[0].split(","))
        return total, used
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return 0, 0


def wait_for_gpu() -> None:
    minimum_free = int(os.getenv("JAPANO_MOTION_MIN_FREE_VRAM_MIB", "13500"))
    deadline = time.monotonic() + float(os.getenv("JAPANO_MOTION_GPU_WAIT_SEC", "45"))
    while True:
        total, used = gpu_memory()
        if total and total - used >= minimum_free:
            return
        if time.monotonic() >= deadline:
            raise RuntimeError(
                f"GPU chưa nhả đủ VRAM cho One-to-All (còn {max(0, total - used)} MiB, cần {minimum_free} MiB). "
                "Ảnh thử đồ vẫn được giữ nguyên; vui lòng thử lại sau ít phút."
            )
        time.sleep(1)


def decode_image(value: str) -> bytes:
    raw = str(value or "")
    if "," in raw and raw.startswith("data:image/"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Ảnh thử đồ không phải base64 hợp lệ.") from exc
    if not data or len(data) > 20 * 1024 * 1024:
        raise ValueError("Ảnh thử đồ trống hoặc vượt quá 20 MB.")
    return data


def scoped_command(memory_high: str, memory_max: str, swap_max: str, command: list[str]) -> list[str]:
    return [
        "systemd-run",
        "--user",
        "--scope",
        "--quiet",
        "-p",
        f"MemoryHigh={memory_high}",
        "-p",
        f"MemoryMax={memory_max}",
        "-p",
        f"MemorySwapMax={swap_max}",
        "-p",
        "OOMPolicy=kill",
        *command,
    ]


def generate_motion(image_bytes: bytes, motion: str, seed: int) -> Path:
    if motion not in MOTIONS:
        raise ValueError("Chuyển động mẫu không hợp lệ.")
    if not model_files_ready() or not cuda_runtime_ready():
        raise RuntimeError("One-to-All 1.3B-v2 hoặc CUDA runtime chưa sẵn sàng.")
    available = available_memory_gib()
    minimum_available = float(os.getenv("JAPANO_MOTION_MIN_AVAILABLE_GB", "14"))
    if available and available < minimum_available:
        raise RuntimeError(
            f"Máy hiện chỉ còn {available:.1f} GiB RAM khả dụng; cần {minimum_available:.0f} GiB để tạo video an toàn."
        )
    wait_for_gpu()

    job_id = f"motion-{int(time.time() * 1000)}-{os.getpid()}"
    job_dir = RUNTIME / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    source = job_dir / "tryon.png"
    output = job_dir / f"japano-{motion}-one-to-all.mp4"
    source.write_bytes(image_bytes)

    environment = [
        "env",
        "CUDA_VISIBLE_DEVICES=" + os.getenv("JAPANO_MOTION_GPU", "0"),
        "CUDA_MODULE_LOADING=LAZY",
        "PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True",
        "TOKENIZERS_PARALLELISM=false",
        "HF_HUB_OFFLINE=1",
        "TRANSFORMERS_OFFLINE=1",
        f"HF_HOME={Path.home() / '.cache/huggingface'}",
        f"PYTHONPATH={MODEL_HOME / 'video-generation'}",
    ]
    runner_command = scoped_command(
        os.getenv("JAPANO_MOTION_MEMORY_HIGH", "15G"),
        os.getenv("JAPANO_MOTION_MEMORY_MAX", "18G"),
        os.getenv("JAPANO_MOTION_SWAP_MAX", "2G"),
        [
            *environment,
            str(MODEL_PYTHON),
            "-u",
            str(RUNNER),
            "--image",
            str(source),
            "--motion",
            motion,
            "--output",
            str(output),
            "--repo",
            str(MODEL_HOME),
            "--frames",
            os.getenv("JAPANO_MOTION_FRAMES", "49"),
            "--fps",
            os.getenv("JAPANO_MOTION_FPS", "12"),
            "--steps",
            os.getenv("JAPANO_MOTION_STEPS", "30"),
            "--seed",
            str(max(0, min(int(seed), 2_147_483_647))),
        ],
    )
    result = subprocess.run(
        runner_command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=int(os.getenv("JAPANO_MOTION_TIMEOUT_SEC", "1200")),
    )
    if result.returncode != 0 or not output.is_file() or output.stat().st_size < 10_000:
        detail = (result.stderr or result.stdout or "One-to-All không tạo được MP4.")[-3000:]
        if result.returncode in {137, -9}:
            detail = "One-to-All đã chạm giới hạn RAM an toàn và được dừng; VS Code/Android Studio không bị ảnh hưởng."
        raise RuntimeError(detail)

    quality_command = scoped_command(
        "4G",
        "6G",
        "1G",
        [
            *environment,
            str(MODEL_PYTHON),
            "-u",
            str(QUALITY),
            "--video",
            str(output),
            "--motion",
            motion,
            "--repo",
            str(MODEL_HOME),
        ],
    )
    quality = subprocess.run(
        quality_command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=int(os.getenv("JAPANO_MOTION_QUALITY_TIMEOUT_SEC", "180")),
    )
    if quality.returncode != 0:
        detail = (quality.stderr or quality.stdout or "Clip không qua kiểm tra chất lượng.")[-2400:]
        if quality.returncode == 3:
            raise MotionQualityError(
                "Video mới đã bị chặn trước khi gửi cho khách vì chuyển động chưa đúng action hoặc hình chưa ổn định. "
                f"Chi tiết: {detail}"
            )
        raise RuntimeError(detail)
    return output


@api.get("/health")
def health():
    total_vram, used_vram = gpu_memory()
    files_ready = model_files_ready()
    cuda_ready = cuda_runtime_ready() if files_ready else False
    return {
        "ok": files_ready and cuda_ready,
        "service": "JAPANO local fashion motion",
        "engine": ENGINE,
        "modelReady": files_ready,
        "cudaRuntimeReady": cuda_ready,
        "poseExecutionProvider": "CUDAExecutionProvider" if cuda_ready else "unavailable",
        "executionDevice": "cuda" if cuda_ready else "unavailable",
        "cpuFallback": False,
        "legacyFallback": False,
        "warmed": WARMED,
        "busy": LOCK.locked(),
        "motions": [{"id": key, "label": label} for key, label in MOTIONS.items()],
        "qualityGate": "optical-flow+temporal-continuity+action-pose",
        "resources": {
            "availableRamGiB": round(available_memory_gib(), 1),
            "gpuTotalMiB": total_vram,
            "gpuUsedMiB": used_vram,
            "memoryHigh": os.getenv("JAPANO_MOTION_MEMORY_HIGH", "15G"),
            "memoryMax": os.getenv("JAPANO_MOTION_MEMORY_MAX", "18G"),
        },
    }


@api.post("/warmup")
def warmup():
    global WARMED
    if not model_files_ready():
        raise HTTPException(status_code=503, detail="Checkpoint One-to-All chưa tải đủ.")
    if not cuda_runtime_ready(refresh=True):
        raise HTTPException(status_code=503, detail="CUDA runtime cho One-to-All/pose chưa sẵn sàng.")
    WARMED = True
    return {"ok": True, "engine": ENGINE, "executionDevice": "cuda"}


@api.post("/animate")
async def animate(request: MotionRequest):
    if not model_files_ready() or not cuda_runtime_ready():
        raise HTTPException(status_code=503, detail="One-to-All 1.3B-v2 chưa sẵn sàng.")
    if request.motion not in MOTIONS:
        raise HTTPException(status_code=400, detail="Chuyển động mẫu không hợp lệ.")
    try:
        image_bytes = decode_image(request.imageBase64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if LOCK.locked():
        raise HTTPException(status_code=409, detail="GPU đang tạo một video khác. Vui lòng chờ lượt hiện tại hoàn tất.")
    try:
        with LOCK:
            output = await run_in_threadpool(generate_motion, image_bytes, request.motion, request.seed)
        return FileResponse(output, media_type="video/mp4", filename=f"japano-{request.motion}.mp4")
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Tạo chuyển động quá thời gian an toàn.") from exc
    except MotionQualityError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        api,
        host=os.getenv("JAPANO_MOTION_HOST", "127.0.0.1"),
        port=int(os.getenv("JAPANO_MOTION_PORT", "7864")),
    )
