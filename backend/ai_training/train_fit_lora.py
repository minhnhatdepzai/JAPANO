"""Orchestrator fine-tune LoRA cho bước fit-refinement (FLUX.2 Klein 4B img2img).

    python3 backend/ai_training/train_fit_lora.py --preflight
    python3 backend/ai_training/train_fit_lora.py --pilot
    python3 backend/ai_training/train_fit_lora.py --train --max-steps 600
    python3 backend/ai_training/train_fit_lora.py --resume
    python3 backend/ai_training/train_fit_lora.py --evaluate

Script này GỌI THẬT trainer image-to-image chính thức của diffusers
(`train_dreambooth_lora_flux2_klein_img2img.py`) chứ không tự viết một vòng
noise-prediction rút gọn: FLUX.2 cần packing latent + image/text ids đúng kiến
trúc, một vòng "trông giống train" nhưng sai kiến trúc chỉ tạo checkpoint vô
nghĩa.

Kỷ luật trạng thái: chỉ ghi TRAINED khi tiến trình trainer trả về mã 0 VÀ có
checkpoint `.safetensors` trên đĩa. Chỉ ghi ACCEPTED sau khi acceptance gate ở
`evaluate_fit_lora.py` cho kết quả đạt.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AI_TRAINING = ROOT / 'backend' / 'ai_training'
DATASET = AI_TRAINING / 'fit_dataset'
METADATA = DATASET / 'metadata.jsonl'
MODELS = AI_TRAINING / 'models'
STATUS_PATH = MODELS / 'fit_lora.status.json'
OUTPUT_DIR = Path(os.getenv('JAPANO_FIT_LORA_OUTPUT', str(MODELS / 'fit_lora')))
HF_DATASET = Path(os.getenv('JAPANO_FIT_HF_DATASET', '/home/nhat/jp/datasets/japano-fit-hf'))
LOG_DIR = Path(os.getenv('JAPANO_TRAIN_LOG_DIR', '/home/nhat/jp/logs'))

TRAIN_VENV = Path(os.getenv('JAPANO_FIT_TRAIN_PYTHON', '/home/nhat/jp/ai/flux2-fit-train/.venv/bin/python'))
TRAINER = Path(os.getenv(
    'JAPANO_FLUX_LORA_TRAINER',
    '/home/nhat/jp/ai/diffusers-training/examples/dreambooth/train_dreambooth_lora_flux2_klein_img2img.py',
))
FLUX_HOME = Path(os.getenv('JAPANO_FLUX_REPOSE_HOME', str(Path.home() / 'jp/ai/FLUX.2-klein-4B')))

FIT_CLASSES = ['good', 'slightly_tight', 'tight', 'very_tight',
               'slightly_loose', 'loose', 'very_loose']
FIT_TOKENS = {
    'very_tight': 'FIT_VERY_TIGHT', 'tight': 'FIT_TIGHT', 'slightly_tight': 'FIT_TIGHT',
    'good': 'FIT_GOOD',
    'slightly_loose': 'FIT_LOOSE', 'loose': 'FIT_LOOSE', 'very_loose': 'FIT_VERY_LOOSE',
}


def caption_of(row: dict) -> str:
    """Caption của một mẫu — suy ra được nếu metadata cũ chưa có sẵn.

    Mẫu sinh từ các phiên bản importer trước không có trường `caption`. Caption
    là hàm thuần của (verdict, severity) nên dựng lại được y hệt, không việc gì
    phải chặn cả lượt train chỉ vì một trường suy ra được.
    """
    if row.get('caption'):
        return row['caption']
    verdict = row.get('fitVerdict', 'good')
    severity = float(row.get('severity') or 0)
    return (
        f"{FIT_TOKENS.get(verdict, 'FIT_GOOD')}. Edit only the clothing fit of the main person. "
        f"Severity {severity:.2f}. Keep identity, face, body size, pose, background "
        f"and garment design unchanged."
    )


SEED = int(os.getenv('JAPANO_FIT_TRAIN_SEED', '17'))


# --------------------------------------------------------------------------
# Trạng thái
# --------------------------------------------------------------------------
VALID_STATUS = {
    'MODEL_NOT_TRAINED', 'PILOT_RUNNING', 'PILOT_PASSED', 'TRAINING',
    'TRAINED', 'EVALUATION_FAILED', 'ACCEPTED', 'REJECTED',
}


def read_status() -> dict:
    if STATUS_PATH.exists():
        try:
            return json.loads(STATUS_PATH.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            return {}
    return {}


def write_status(status: str, **extra):
    assert status in VALID_STATUS, f'Trạng thái không hợp lệ: {status}'
    MODELS.mkdir(parents=True, exist_ok=True)
    # Mỗi trạng thái là một snapshot độc lập. Merge payload cũ từng làm
    # PILOT_PASSED vẫn mang `reason=TRAINER_FAILED` và datasetProblems của lần
    # OOM trước, khiến báo cáo tự mâu thuẫn dù checkpoint đã sinh thành công.
    payload = {
        'status': status,
        'updatedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
        **extra,
    }
    STATUS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'[status] {status}')
    return payload


# --------------------------------------------------------------------------
# Dataset
# --------------------------------------------------------------------------
def load_rows():
    if not METADATA.exists():
        return []
    return [json.loads(line) for line in METADATA.read_text(encoding='utf-8').splitlines()
            if line.strip() and not line.startswith('//')]


def split_by_identity(rows, ratios=(0.70, 0.15, 0.15), seed=SEED):
    """Chia theo danh tính: một người không được xuất hiện ở hai tập."""
    import random
    groups = defaultdict(list)
    for row in rows:
        groups[row.get('personId') or row['id']].append(row)
    keys = sorted(groups)
    random.Random(seed).shuffle(keys)
    total = sum(len(groups[k]) for k in keys)
    targets = [ratio * total for ratio in ratios]
    buckets = [[], [], []]
    for key in keys:
        index = max(range(3), key=lambda i: targets[i] - len(buckets[i]))
        buckets[index].extend(groups[key])
    return {'train': buckets[0], 'validation': buckets[1], 'test': buckets[2]}


def validate_dataset(rows, min_samples: int, require_all_classes: bool = True):
    problems = []
    if len(rows) < min_samples:
        problems.append(f'Chỉ có {len(rows)} mẫu, cần tối thiểu {min_samples}.')
    classes = Counter(r['fitVerdict'] for r in rows)
    missing = [c for c in FIT_CLASSES if not classes.get(c)]
    if missing and require_all_classes:
        problems.append(f'Thiếu hoàn toàn lớp: {", ".join(missing)}.')
    identities = {r.get('personId') or r['id'] for r in rows}
    if len(identities) < 3:
        problems.append(f'Chỉ có {len(identities)} identity — không chia được theo người.')
    for row in rows:
        for field in ('person', 'target', 'fitVerdict', 'provenance'):
            if not row.get(field):
                problems.append(f'Mẫu {row.get("id")} thiếu trường "{field}".')
                break
        if not (DATASET / 'images' / row.get('target', '')).exists():
            problems.append(f'Mẫu {row.get("id")}: thiếu ảnh target.')
        if not (DATASET / 'images' / row.get('person', '')).exists():
            problems.append(f'Mẫu {row.get("id")}: thiếu ảnh condition.')
    return problems, dict(classes), len(identities)


def build_hf_dataset(splits: dict, limit_train: int | None = None, tag: str = 'full') -> Path:
    """Xuất dataset sang parquet có hai cột ảnh (image + condition_image).

    Dùng parquet thay vì ImageFolder vì ImageFolder chỉ cast được MỘT cột ảnh;
    parquet giữ nguyên schema Features nên `load_dataset()` trả về đúng hai đối
    tượng PIL như trainer mong đợi.
    """
    from datasets import Dataset, Features, Image as HFImage, Value

    root = HF_DATASET if tag == 'full' else HF_DATASET.parent / f'{HF_DATASET.name}-{tag}'
    if root.exists():
        shutil.rmtree(root)
    features = Features({'image': HFImage(), 'condition_image': HFImage(), 'caption': Value('string'),
                         'fit_verdict': Value('string'), 'person_id': Value('string')})
    written = {}
    for split, rows in splits.items():
        if not rows:
            continue
        if split == 'train' and limit_train:
            # Lấy cân bằng lớp cho pilot thay vì cắt cụt đầu danh sách.
            by_class = defaultdict(list)
            for row in rows:
                by_class[row['fitVerdict']].append(row)
            balanced, index = [], 0
            while len(balanced) < limit_train and any(len(v) > index for v in by_class.values()):
                for cls in FIT_CLASSES:
                    if len(by_class.get(cls, [])) > index and len(balanced) < limit_train:
                        balanced.append(by_class[cls][index])
                index += 1
            rows = balanced
        data = {
            'image': [str(DATASET / 'images' / r['target']) for r in rows],
            'condition_image': [str(DATASET / 'images' / r['person']) for r in rows],
            'caption': [caption_of(r) for r in rows],
            'fit_verdict': [r['fitVerdict'] for r in rows],
            'person_id': [r.get('personId') or r['id'] for r in rows],
        }
        dataset = Dataset.from_dict(data, features=features)
        split_dir = root / split
        split_dir.mkdir(parents=True, exist_ok=True)
        dataset.to_parquet(str(split_dir / f'{split}-00000.parquet'))
        written[split] = len(rows)
    (root / 'DATASET_INFO.json').write_text(json.dumps({
        'source': 'JAPANO fit dataset',
        'sourceDataset': 'marquis03/high-resolution-viton-zalando-dataset (VITON-HD)',
        'license': 'CC-BY-NC-SA-4.0 — phi thương mại',
        'targetProvenance': 'synthetic-flux2-klein-fit-refine (self-distillation, KHÔNG phải nhãn người)',
        'domain': 'upper-body (tops)',
        'splits': written,
        'splitPolicy': 'group theo personId, 70/15/15, test không dùng để chọn checkpoint',
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'[dataset] {root} -> {written}')
    return root


# --------------------------------------------------------------------------
# Môi trường
# --------------------------------------------------------------------------
def check_environment():
    problems = []
    if not TRAIN_VENV.exists():
        problems.append(f'Thiếu python môi trường train: {TRAIN_VENV}')
    if not TRAINER.exists():
        problems.append(f'Thiếu trainer: {TRAINER}')
    if not (FLUX_HOME / 'model_index.json').exists():
        problems.append(f'Thiếu model FLUX tại {FLUX_HOME}')
    if TRAIN_VENV.exists() and TRAINER.exists():
        probe = subprocess.run(
            [str(TRAIN_VENV), str(TRAINER), '--help'],
            capture_output=True, text=True, timeout=300,
        )
        if probe.returncode != 0:
            tail = (probe.stderr or '').strip().splitlines()[-3:]
            problems.append('trainer --help thất bại: ' + ' | '.join(tail))
    return problems


def environment_fingerprint() -> dict:
    def run(cmd):
        try:
            return subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout.strip()
        except Exception:
            return ''
    info = {
        'python': run([str(TRAIN_VENV), '-c', 'import sys;print(sys.version.split()[0])']),
        'torch': run([str(TRAIN_VENV), '-c', 'import torch;print(torch.__version__)']),
        'cuda': run([str(TRAIN_VENV), '-c', 'import torch;print(torch.version.cuda)']),
        'gpu': run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader']),
        'diffusersSource': str(TRAINER.parents[2]),
        'diffusersSha': run(['git', '-C', str(TRAINER.parents[2]), 'rev-parse', 'HEAD']),
        'seed': SEED,
    }
    freeze = run([str(TRAIN_VENV), '-m', 'pip', 'freeze'])
    if freeze:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        (LOG_DIR / 'fit-lora-pip-freeze.txt').write_text(freeze, encoding='utf-8')
        info['pipFreeze'] = str(LOG_DIR / 'fit-lora-pip-freeze.txt')
    return info


# --------------------------------------------------------------------------
# Lệnh train
# --------------------------------------------------------------------------
QUANT_CONFIG = AI_TRAINING / 'configs' / 'bnb_nf4.json'


def build_command(dataset_dir: Path, output_dir: Path, max_steps: int, rank: int,
                  resolution: int, resume: str | None, validation_image: str | None,
                  checkpointing_steps: int, learning_rate: float, quantize: bool = False,
                  cache_latents: bool = False, max_sequence_length: int = 64):
    command = [
        str(TRAIN_VENV), str(TRAINER),
        '--pretrained_model_name_or_path', str(FLUX_HOME),
        '--dataset_name', str(dataset_dir),
        '--image_column', 'image',
        '--cond_image_column', 'condition_image',
        '--caption_column', 'caption',
        '--output_dir', str(output_dir),
        '--mixed_precision', 'bf16',
        '--resolution', str(resolution),
        '--max_sequence_length', str(max_sequence_length),
        '--train_batch_size', '1',
        '--gradient_accumulation_steps', '4',
        '--gradient_checkpointing',
        '--offload',
        '--use_8bit_adam',
        '--rank', str(rank),
        '--lora_alpha', str(rank),
        '--learning_rate', str(learning_rate),
        '--lr_scheduler', 'constant',
        '--lr_warmup_steps', '0',
        '--max_train_steps', str(max_steps),
        '--checkpointing_steps', str(checkpointing_steps),
        '--checkpoints_total_limit', '3',
        '--seed', str(SEED),
        '--report_to', 'tensorboard',
        '--logging_dir', str(LOG_DIR / 'fit-lora-tb'),
        # Không đẩy model lên Hub trong nhiệm vụ này.
    ]
    if cache_latents:
        # Trainer giữ toàn bộ latent trên GPU. Chỉ bật cho pilot nhỏ; tập train
        # đầy đủ phải encode theo batch để không tăng VRAM theo số lượng ảnh.
        command += ['--cache_latents']
    if quantize:
        # NF4 4-bit cho transformer: cách duy nhất đưa FLUX.2 Klein 4B vào vừa
        # phần VRAM còn lại khi một dự án khác đang giữ cố định ~5 GB.
        # KHÔNG dùng chung với --do_fp8_training.
        command += ['--bnb_quantization_config_path', str(QUANT_CONFIG)]
    if validation_image:
        command += ['--validation_image', validation_image,
                    '--validation_prompt', 'FIT_VERY_TIGHT. Edit only the clothing fit of the main person.',
                    '--num_validation_images', '1', '--validation_epochs', '1000']
    else:
        command += ['--skip_final_inference']
    if resume:
        command += ['--resume_from_checkpoint', resume]
    return command


def find_checkpoint(output_dir: Path):
    """File trọng số LoRA thật (nếu có)."""
    for name in ('pytorch_lora_weights.safetensors', 'adapter_model.safetensors'):
        candidate = output_dir / name
        if candidate.exists():
            return candidate
    weights = sorted(output_dir.glob('**/*.safetensors'))
    return weights[-1] if weights else None


def run_trainer(command, log_path: Path, phase: str):
    """Chạy trainer, stream log ra cả terminal lẫn file. Trả (returncode, peak_vram)."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    print(f'[{phase}] lệnh:\n  ' + ' '.join(command) + '\n')
    peak_vram = {'gb': 0.0}
    monitor_stop = threading.Event()
    started = time.time()
    with open(log_path, 'w', encoding='utf-8') as log:
        log.write(' '.join(command) + '\n\n')
        log.flush()
        environment = {
            **os.environ,
            # Thông báo OOM của torch tự gợi ý cờ này: nó giảm phân mảnh bộ nhớ
            # khi model được nạp theo từng lớp.
            'PYTORCH_CUDA_ALLOC_CONF': 'expandable_segments:True',
        }
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   text=True, bufsize=1, cwd=str(TRAINER.parent), env=environment)

        def monitor_gpu():
            while not monitor_stop.wait(1):
                used = gpu_used_gb()
                if used is not None:
                    peak_vram['gb'] = max(peak_vram['gb'], used)

        monitor = threading.Thread(target=monitor_gpu, name='fit-lora-gpu-monitor', daemon=True)
        monitor.start()
        for line in process.stdout:
            log.write(line)
            log.flush()
            stripped = line.rstrip()
            if stripped:
                print(f'  {stripped[:190]}')
            if 'CUDA out of memory' in line:
                peak_vram['gb'] = -1.0
        process.wait()
        monitor_stop.set()
        monitor.join(timeout=3)
    duration = time.time() - started
    print(f'[{phase}] kết thúc sau {duration / 60:.1f} phút, mã thoát {process.returncode}')
    return process.returncode, duration, round(peak_vram['gb'], 2)


def gpu_used_gb():
    try:
        out = subprocess.run(['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
                             capture_output=True, text=True, timeout=30).stdout.strip().splitlines()[0]
        return round(int(out) / 1024, 2)
    except Exception:
        return None


def gpu_free_gb():
    try:
        out = subprocess.run(
            ['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
            capture_output=True, text=True, timeout=30).stdout.strip().splitlines()[0]
        used, total = [int(value.strip()) for value in out.split(',')]
        return round((total - used) / 1024, 2)
    except Exception:
        return None


def stop_inference_services(required_free_gb=9.0, timeout_sec=120):
    """Nhả VRAM của JAPANO trước khi train. Chỉ đụng service của chính dự án.

    `systemctl stop` trả về ngay khi đã gửi tín hiệu, còn tiến trình thì cần vài
    giây nữa mới thật sự nhả VRAM — và japano-fashn được cấu hình
    JAPANO_UNLOAD_AFTER_TRYON=0 nên giữ FLUX + FASHN thường trú. Khởi động
    trainer ngay sau lệnh stop khiến nó thấy GPU còn chưa tới 100 MiB trống và
    chết vì OOM. Vì vậy phải CHỜ ĐO ĐƯỢC VRAM trống thật sự.
    """
    for unit in ('japano-fashn', 'japano-motion'):
        subprocess.run(['systemctl', '--user', 'stop', unit], capture_output=True)
    print('[gpu] đã dừng japano-fashn / japano-motion, đang chờ VRAM được giải phóng…')
    deadline = time.time() + timeout_sec
    free = gpu_free_gb()
    while time.time() < deadline:
        free = gpu_free_gb()
        if free is None or free >= required_free_gb:
            break
        time.sleep(3)
    print(f'[gpu] VRAM trống: {free} GB (cần ≥ {required_free_gb} GB)')
    if free is not None and free < required_free_gb:
        print('[gpu] CẢNH BÁO: vẫn chưa đủ VRAM. Tiến trình khác đang giữ GPU — '
              'trainer có thể OOM. Không tự kill tiến trình lạ.')
    return free


def start_inference_services():
    subprocess.run(['systemctl', '--user', 'start', 'japano-fashn'], capture_output=True)
    print('[gpu] đã bật lại japano-fashn')


# --------------------------------------------------------------------------
# Các chế độ
# --------------------------------------------------------------------------
def do_preflight(args):
    rows = load_rows()
    if not rows:
        write_status('MODEL_NOT_TRAINED', reason='DATASET_EMPTY',
                     hint='Chạy import_viton_hd_fit_sources.py để sinh dữ liệu.')
        return 1
    problems, classes, identities = validate_dataset(rows, args.min_samples, not args.allow_missing_classes)
    env_problems = check_environment()
    splits = split_by_identity(rows)
    leak = set(r.get('personId') for r in splits['train']) & set(r.get('personId') for r in splits['test'])
    if leak:
        problems.append(f'Rò identity giữa train và test: {sorted(leak)[:3]}')

    print(f'[dataset] {len(rows)} mẫu | {identities} identity | lớp: {classes}')
    print(f'[split] train {len(splits["train"])} | val {len(splits["validation"])} | test {len(splits["test"])}')
    if problems or env_problems:
        for problem in problems + env_problems:
            print(f'  [!] {problem}')
        write_status('MODEL_NOT_TRAINED', reason='PREFLIGHT_FAILED',
                     datasetProblems=problems, environmentProblems=env_problems,
                     samples=len(rows), classes=classes, identities=identities)
        return 1

    dataset_dir = build_hf_dataset(splits)
    command = build_command(dataset_dir / 'train', OUTPUT_DIR, args.max_steps, args.rank,
                            args.resolution, None, None, args.checkpointing_steps, args.learning_rate,
                            quantize=not args.no_quantize,
                            cache_latents=args.cache_latents is True,
                            max_sequence_length=args.max_sequence_length)
    print('\n[preflight] lệnh train đã resolve:\n  ' + ' '.join(command))
    write_status('MODEL_NOT_TRAINED', reason='PREFLIGHT_PASSED', samples=len(rows), classes=classes,
                 identities=identities, splits={k: len(v) for k, v in splits.items()},
                 datasetDir=str(dataset_dir), environment=environment_fingerprint(),
                 resolvedCommand=' '.join(command))
    return 0


def do_train(args, pilot: bool):
    rows = load_rows()
    min_samples = args.pilot_samples if pilot else args.min_samples
    problems, classes, identities = validate_dataset(rows, min_samples, not args.allow_missing_classes)
    env_problems = check_environment()
    if problems or env_problems:
        for problem in problems + env_problems:
            print(f'  [!] {problem}')
        write_status('MODEL_NOT_TRAINED', reason='PREFLIGHT_FAILED',
                     datasetProblems=problems, environmentProblems=env_problems)
        return 1

    splits = split_by_identity(rows)
    tag = 'pilot' if pilot else 'full'
    dataset_dir = build_hf_dataset(splits, limit_train=args.pilot_samples if pilot else None, tag=tag)
    output_dir = OUTPUT_DIR.parent / 'fit_lora_pilot' if pilot else OUTPUT_DIR
    max_steps = args.pilot_steps if pilot else args.max_steps
    checkpointing = min(args.checkpointing_steps, max(10, max_steps // 2)) if pilot else args.checkpointing_steps
    # Cache giúp pilot nhỏ nhanh hơn, nhưng cache toàn bộ tập train làm VRAM tăng
    # tuyến tính theo số ảnh. Full train mặc định encode từng batch.
    cache_latents = args.cache_latents if args.cache_latents is not None else pilot

    free_before = None
    if not args.keep_services:
        free_before = stop_inference_services()
    write_status('PILOT_RUNNING' if pilot else 'TRAINING', phase=tag, maxSteps=max_steps,
                 freeVramGbBeforeTrain=free_before,
                 cacheLatents=cache_latents,
                 datasetDir=str(dataset_dir), outputDir=str(output_dir),
                 environment=environment_fingerprint())

    command = build_command(dataset_dir / 'train', output_dir, max_steps, args.rank, args.resolution,
                            args.resume, None, checkpointing, args.learning_rate,
                            quantize=not args.no_quantize, cache_latents=cache_latents,
                            max_sequence_length=args.max_sequence_length)
    log_path = LOG_DIR / f'fit-lora-{tag}.log'
    code, duration, peak = run_trainer(command, log_path, tag)
    checkpoint = find_checkpoint(output_dir)

    if code != 0:
        write_status('MODEL_NOT_TRAINED', reason='TRAINER_FAILED', exitCode=code,
                     log=str(log_path), phase=tag, durationMinutes=round(duration / 60, 1))
        print(f'[!] Trainer thất bại (mã {code}). Xem log: {log_path}')
        if not args.keep_services:
            start_inference_services()
        return 1
    if checkpoint is None:
        write_status('MODEL_NOT_TRAINED', reason='NO_CHECKPOINT', log=str(log_path), phase=tag)
        print('[!] Trainer báo thành công nhưng không có .safetensors — không ghi TRAINED.')
        if not args.keep_services:
            start_inference_services()
        return 1

    write_status('PILOT_PASSED' if pilot else 'TRAINED',
                 phase=tag, exitCode=0, checkpoint=str(checkpoint),
                 checkpointBytes=checkpoint.stat().st_size,
                 steps=max_steps, durationMinutes=round(duration / 60, 1),
                 peakVramGb=peak, log=str(log_path), datasetDir=str(dataset_dir))
    print(f'[{tag}] checkpoint: {checkpoint}')
    if not args.keep_services:
        start_inference_services()
    return 0


def do_evaluate(args):
    script = AI_TRAINING / 'evaluate_fit_lora.py'
    if not script.exists():
        print(f'Thiếu {script}')
        return 1
    return subprocess.run([sys.executable, str(script)] + args.evaluate_args).returncode


def main():
    parser = argparse.ArgumentParser(description='Fine-tune LoRA fit-refinement cho JAPANO')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--preflight', action='store_true')
    mode.add_argument('--pilot', action='store_true')
    mode.add_argument('--train', action='store_true')
    mode.add_argument('--evaluate', action='store_true')
    parser.add_argument('--resume', nargs='?', const='latest', default=None,
                        help='Tiếp tục từ checkpoint (mặc định "latest")')
    parser.add_argument('--max-steps', type=int, default=600)
    parser.add_argument('--pilot-steps', type=int, default=30)
    parser.add_argument('--pilot-samples', type=int, default=21)
    parser.add_argument('--min-samples', type=int, default=100)
    parser.add_argument('--rank', type=int, default=8)
    parser.add_argument('--resolution', type=int, default=512)
    parser.add_argument('--max-sequence-length', type=int, default=64,
                        help='Độ dài embedding caption; caption JAPANO nằm gọn trong 64 token')
    parser.add_argument('--learning-rate', type=float, default=1e-4)
    parser.add_argument('--checkpointing-steps', type=int, default=100)
    parser.add_argument('--allow-missing-classes', action='store_true')
    parser.add_argument('--no-quantize', action='store_true',
                        help='Tắt NF4 4-bit (chỉ dùng khi GPU dư VRAM)')
    latent_cache = parser.add_mutually_exclusive_group()
    latent_cache.add_argument('--cache-latents', dest='cache_latents', action='store_true',
                              help='Cache toàn bộ latent trên GPU (chỉ phù hợp pilot nhỏ)')
    latent_cache.add_argument('--no-cache-latents', dest='cache_latents', action='store_false',
                              help='Encode latent theo batch để giới hạn VRAM')
    parser.set_defaults(cache_latents=None)
    parser.add_argument('--keep-services', action='store_true',
                        help='Không tự dừng japano-fashn (chỉ dùng khi đã tự quản VRAM)')
    parser.add_argument('--evaluate-args', nargs='*', default=[])
    args = parser.parse_args()

    if args.evaluate:
        return do_evaluate(args)
    if args.pilot:
        return do_train(args, pilot=True)
    if args.train or args.resume:
        return do_train(args, pilot=False)
    return do_preflight(args)


if __name__ == '__main__':
    sys.exit(main())
