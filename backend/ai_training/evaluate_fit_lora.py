"""So sánh FLUX.2 gốc với checkpoint LoRA fit — và quyết định ACCEPTED/REJECTED.

    python3 backend/ai_training/evaluate_fit_lora.py --checkpoint backend/ai_training/models/fit_lora
    python3 backend/ai_training/evaluate_fit_lora.py --baseline-steps 6 --lora-steps 6

Nguyên tắc đo: cùng test identity, cùng condition image, cùng caption, cùng seed,
cùng resolution. Khác nhau duy nhất là có adapter hay không.

Các chỉ số dưới đây là **proxy tự động** tính bằng chính cổng chất lượng đang
chạy trong ứng dụng (`fit_effect_quality`), KHÔNG phải điểm do người chấm:

  identity/body-shape  <- bodyDrift (tỉ lệ dọc cơ thể đổi bao nhiêu)
  garment fidelity     <- colorShift (màu vùng trang phục lệch bao nhiêu)
  fit-effect           <- structureChange (hiệu ứng có hiện ra không)
  failure              <- cổng chất lượng trả reasons khác rỗng

Điểm do người chấm nằm ở `evaluate_tryon_manual.py` và phải luôn được gọi đúng
tên là *manual evaluation*.
"""

import argparse
import csv
import json
import math
import os
import statistics
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
AI_TRAINING = BACKEND / 'ai_training'
DATASET = AI_TRAINING / 'fit_dataset'
METADATA = DATASET / 'metadata.jsonl'
MODELS = AI_TRAINING / 'models'
STATUS_PATH = MODELS / 'fit_lora.status.json'
EVAL_DIR = AI_TRAINING / 'evaluation'
CONTACT_DIR = AI_TRAINING / 'contact_sheets'
SERVICE = os.getenv('JAPANO_FASHN_URL', 'http://127.0.0.1:7862')
DROPIN = Path.home() / '.config/systemd/user/japano-fashn.service.d/zz-fit-lora.conf'

sys.path.insert(0, str(BACKEND))
from accessory_pipeline import fit_effect_quality  # noqa: E402

sys.path.insert(0, str(AI_TRAINING))
from train_fit_lora import find_checkpoint, load_rows, split_by_identity  # noqa: E402


# --------------------------------------------------------------------------
# Bật/tắt adapter ở service (drop-in systemd, có thể hoàn tác sạch)
# --------------------------------------------------------------------------
def set_service_lora(path: Path | None, steps: int, categories: str = 'tops'):
    """Khởi động service với đúng adapter VÀ đúng số inference steps.

    Gán `os.environ` trong evaluator không thể thay đổi environment của service
    systemd đã chạy. Drop-in này làm benchmark 6-vs-4 bước thực sự khác nhau.
    Adapter được load lười ở request đầu, nên hàm chỉ xác minh cấu hình ở đây;
    `adapterLoaded` được kiểm tra sau khi lượt LoRA đã sinh ít nhất một ảnh.
    """
    DROPIN.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        '[Service]',
        f'Environment=JAPANO_FIT_STEPS={steps}',
        f'Environment=JAPANO_FIT_STEPS_EXTREME={steps}',
        f'Environment=JAPANO_FIT_LORA_PATH={path or ""}',
        f'Environment=JAPANO_FIT_LORA_CATEGORIES={categories}',
    ]
    DROPIN.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    subprocess.run(['systemctl', '--user', 'daemon-reload'], capture_output=True)
    subprocess.run(['systemctl', '--user', 'restart', 'japano-fashn'], capture_output=True)
    for _ in range(60):
        try:
            health = requests.get(f'{SERVICE}/health', timeout=10).json()
            if health.get('modelReady'):
                return health.get('fitLora', {})
        except Exception:
            time.sleep(2)
    raise RuntimeError('japano-fashn không sẵn sàng sau khi đổi cấu hình LoRA')


def restore_service_dropin(previous: bytes | None):
    """Khôi phục đúng cấu hình trước benchmark, kể cả khi evaluator lỗi giữa chừng."""
    if previous is None:
        DROPIN.unlink(missing_ok=True)
    else:
        DROPIN.parent.mkdir(parents=True, exist_ok=True)
        DROPIN.write_bytes(previous)
    subprocess.run(['systemctl', '--user', 'daemon-reload'], capture_output=True)
    subprocess.run(['systemctl', '--user', 'restart', 'japano-fashn'], capture_output=True)


def gpu_used_gb():
    try:
        out = subprocess.run(['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
                             capture_output=True, text=True, timeout=20).stdout.strip().splitlines()[0]
        return round(int(out) / 1024, 2)
    except Exception:
        return None


# --------------------------------------------------------------------------
# Sinh ảnh + chấm proxy
# --------------------------------------------------------------------------
def generate(condition: Path, verdict: str, severity: float, selected: str, recommended: str,
             seed: int, steps: int, out_path: Path, timeout: int = 900,
             busy_retries: int = 3):
    data = {'category': 'tops', 'verdict': verdict, 'severity': str(severity),
            'tear_allowed': 'true' if verdict == 'very_tight' else 'false',
            'outerwear': 'false', 'selected_size': selected,
            'recommended_size': recommended, 'seed': str(seed)}
    total_started = time.time()
    response = None
    for attempt in range(busy_retries + 1):
        # Multipart file handles cannot be safely reused after a request, so
        # reopen the condition image on every retry.
        with open(condition, 'rb') as handle:
            files = {'person': (condition.name, handle, 'image/jpeg')}
            response = requests.post(f'{SERVICE}/fit-refine', files=files, data=data, timeout=timeout)
        if response.status_code != 409 or attempt == busy_retries:
            break
        # 409 means another GPU job owns the service lock. This is transient
        # infrastructure contention, not a model-quality failure.
        time.sleep((2, 5, 10)[attempt])
    latency = time.time() - total_started
    if response is None or response.status_code != 200:
        status = response.status_code if response is not None else 'NO_RESPONSE'
        return None, latency, f'HTTP {status}'
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(response.content)
    return out_path, latency, ''


def score(condition: Path, result: Path, verdict: str, severity: float):
    with Image.open(condition) as clean, Image.open(result) as generated:
        return fit_effect_quality(
            clean.convert('RGB'), generated.convert('RGB'), None, 'upper',
            {'verdict': verdict, 'severity': severity, 'tearAllowed': verdict == 'very_tight'},
        )


def run_pass(label: str, samples, steps: int, out_root: Path, seed_base: int):
    rows = []
    peak = gpu_used_gb() or 0
    for index, sample in enumerate(samples):
        condition = DATASET / 'images' / sample['person']
        out_path = out_root / label / f"{sample['id']}.png"
        verdict, severity = sample['fitVerdict'], float(sample['severity'])
        if verdict == 'good':
            continue
        result, latency, error = generate(
            condition, verdict, severity, sample['selectedSize'], sample['recommendedSize'],
            seed=seed_base + index, steps=steps, out_path=out_path,
        )
        peak = max(peak, gpu_used_gb() or 0)
        if result is None:
            rows.append({'id': sample['id'], 'verdict': verdict, 'pass': label, 'ok': False,
                         'error': error, 'latency': round(latency, 2)})
            print(f'  [{label}] {sample["id"]}: LỖI {error}')
            continue
        quality = score(condition, result, verdict, severity)
        rows.append({
            'id': sample['id'], 'verdict': verdict, 'pass': label,
            'ok': bool(quality.get('ok')),
            'reasons': ','.join(quality.get('reasons', [])),
            'bodyDrift': max(quality.get('bodyDrift', {}).values(), default=0.0),
            'colorShift': quality.get('colorShift', 0.0),
            'structureChange': quality.get('structureChange', 0.0),
            'skinGain': quality.get('skinGain', 0.0),
            'latency': round(latency, 2),
            'image': str(out_path),
            'condition': str(condition),
            'error': '',
        })
        print(f'  [{label}] {sample["id"]}: ok={quality.get("ok")} '
              f'drift={rows[-1]["bodyDrift"]:.3f} color={rows[-1]["colorShift"]:.1f} '
              f'effect={rows[-1]["structureChange"]:.1f} {latency:.1f}s')
    return rows, peak


def summarize(rows, steps, peak):
    valid = [r for r in rows if not r.get('error')]
    lat = sorted(r['latency'] for r in rows) or [0]
    def mean(key):
        values = [r[key] for r in valid if isinstance(r.get(key), (int, float))]
        return round(statistics.mean(values), 4) if values else None
    return {
        'samples': len(rows),
        'steps': steps,
        'passRate': round(sum(1 for r in valid if r['ok']) / max(1, len(valid)), 3),
        'failureRate': round(sum(1 for r in rows if r.get('error')) / max(1, len(rows)), 3),
        'artifactRate': round(sum(1 for r in valid if not r['ok']) / max(1, len(valid)), 3),
        'bodyDriftMean': mean('bodyDrift'),
        'colorShiftMean': mean('colorShift'),
        'structureChangeMean': mean('structureChange'),
        'skinGainMean': mean('skinGain'),
        'latencyP50': round(statistics.median(lat), 2),
        'latencyP95': round(lat[max(0, math.ceil(len(lat) * 0.95) - 1)], 2),
        'peakVramGb': peak,
    }


def contact_sheet(baseline_rows, lora_rows, out_path: Path):
    pairs = {r['id']: r for r in baseline_rows if r.get('image')}
    cell = 220
    items = [r for r in lora_rows if r.get('image') and r['id'] in pairs][:8]
    if not items:
        return None
    sheet = Image.new('RGB', (cell * 3, cell * len(items)), (250, 250, 250))
    for row_index, row in enumerate(items):
        sample_id = row['id']
        condition = Path(row['condition'])
        candidates = [condition, Path(pairs[sample_id]['image']), Path(row['image'])]
        for col, path in enumerate(candidates):
            if not Path(path).exists():
                continue
            with Image.open(path) as im:
                thumb = im.convert('RGB')
                thumb.thumbnail((cell - 8, cell - 8))
                sheet.paste(thumb, (col * cell + 4, row_index * cell + 4))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=88)
    return out_path


# --------------------------------------------------------------------------
# Acceptance gate
# --------------------------------------------------------------------------
def acceptance(baseline: dict, lora: dict, tolerance: float):
    checks = []
    def check(name, ok, detail):
        checks.append({'check': name, 'passed': bool(ok), 'detail': detail})
        return ok

    check('identity_body_preserved',
          (lora['bodyDriftMean'] or 0) <= (baseline['bodyDriftMean'] or 0) + tolerance,
          f"bodyDrift LoRA {lora['bodyDriftMean']} vs baseline {baseline['bodyDriftMean']}")
    check('garment_fidelity_preserved',
          (lora['colorShiftMean'] or 0) <= (baseline['colorShiftMean'] or 0) * (1 + tolerance) + 2,
          f"colorShift LoRA {lora['colorShiftMean']} vs baseline {baseline['colorShiftMean']}")
    check('fit_effect_visible',
          (lora['structureChangeMean'] or 0) >= (baseline['structureChangeMean'] or 0) * (1 - tolerance),
          f"structureChange LoRA {lora['structureChangeMean']} vs baseline {baseline['structureChangeMean']}")
    check('artifact_not_worse',
          lora['artifactRate'] <= baseline['artifactRate'] + tolerance,
          f"artifactRate LoRA {lora['artifactRate']} vs baseline {baseline['artifactRate']}")
    check('failure_not_worse',
          lora['failureRate'] <= baseline['failureRate'] + tolerance,
          f"failureRate LoRA {lora['failureRate']} vs baseline {baseline['failureRate']}")
    check('latency_or_quality_justified',
          lora['latencyP50'] <= baseline['latencyP50'] or lora['passRate'] >= baseline['passRate'],
          f"latencyP50 {lora['latencyP50']}s vs {baseline['latencyP50']}s; "
          f"passRate {lora['passRate']} vs {baseline['passRate']}")
    return all(c['passed'] for c in checks), checks


def main():
    parser = argparse.ArgumentParser(description='Benchmark baseline vs LoRA + acceptance gate')
    parser.add_argument('--checkpoint', default=str(MODELS / 'fit_lora'))
    parser.add_argument('--baseline-steps', type=int, default=6)
    parser.add_argument('--lora-steps', type=int, default=6,
                        help='Giữ bằng baseline để không trộn lợi ích LoRA với việc giảm số bước inference')
    parser.add_argument('--max-samples', type=int, default=8)
    parser.add_argument('--seed', type=int, default=4242)
    parser.add_argument('--tolerance', type=float, default=0.05)
    parser.add_argument('--skip-baseline', action='store_true')
    parser.add_argument('--split', choices=['validation', 'test'], default='validation',
                        help='Validation dùng để chấp nhận checkpoint; test chỉ dùng báo cáo cuối.')
    parser.add_argument('--report-only', action='store_true',
                        help='Chỉ benchmark (dùng cho pilot), không đổi status hay bật adapter mặc định.')
    args = parser.parse_args()
    previous_dropin = DROPIN.read_bytes() if DROPIN.exists() else None

    checkpoint_dir = Path(args.checkpoint)
    checkpoint = find_checkpoint(checkpoint_dir) if checkpoint_dir.exists() else None
    if checkpoint is None:
        print(f'Không thấy checkpoint .safetensors trong {checkpoint_dir} — chưa có gì để đánh giá.')
        return 1

    rows = load_rows()
    splits = split_by_identity(rows)
    samples = [r for r in splits[args.split] if r['fitVerdict'] != 'good'][:args.max_samples]
    if not samples:
        print(f'{args.split} split rỗng — cần thêm identity.')
        return 1
    print(f'Đánh giá trên {len(samples)} mẫu {args.split} '
          f'({len({s["personId"] for s in samples})} identity)')

    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    out_root = EVAL_DIR / datetime.now().strftime('run-%Y%m%d-%H%M%S')

    print('\n=== Lượt BASELINE (không LoRA) ===')
    set_service_lora(None, args.baseline_steps)
    baseline_rows, baseline_peak = run_pass('baseline', samples, args.baseline_steps, out_root, args.seed)

    print(f'\n=== Lượt LoRA ({checkpoint_dir}) ===')
    lora_info = set_service_lora(checkpoint_dir, args.lora_steps)
    print(f'  adapter configured: {lora_info}')
    lora_rows, lora_peak = run_pass('lora', samples, args.lora_steps, out_root, args.seed)
    try:
        loaded_info = requests.get(f'{SERVICE}/health', timeout=20).json().get('fitLora', {})
    except Exception as exc:
        loaded_info = {'adapterLoaded': False, 'error': str(exc)}
    if not loaded_info.get('adapterLoaded'):
        print(f'  [!] Service KHÔNG nạp được adapter sau lượt LoRA: {loaded_info}')
        restore_service_dropin(previous_dropin)
        if not args.report_only:
            status = json.loads(STATUS_PATH.read_text()) if STATUS_PATH.exists() else {}
            status.update({'status': 'EVALUATION_FAILED', 'reason': 'ADAPTER_NOT_LOADED',
                           'adapter': loaded_info, 'updatedAt': datetime.now().astimezone().isoformat()})
            STATUS_PATH.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding='utf-8')
        return 1

    baseline_summary = summarize(baseline_rows, args.baseline_steps, baseline_peak)
    lora_summary = summarize(lora_rows, args.lora_steps, lora_peak)
    accepted, checks = acceptance(baseline_summary, lora_summary, args.tolerance)

    sheet = contact_sheet(baseline_rows, lora_rows, CONTACT_DIR / f'{out_root.name}-baseline-vs-lora.jpg')
    all_rows = baseline_rows + lora_rows
    csv_path = out_root / 'per_sample.csv'
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fields = sorted({k for r in all_rows for k in r})
    with csv_path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(all_rows)

    report = {
        'evaluatedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
        'checkpoint': str(checkpoint),
        'checkpointBytes': checkpoint.stat().st_size,
        'adapter': loaded_info,
        'evaluationSamples': len(samples),
        'evaluationIdentities': sorted({s['personId'] for s in samples}),
        'split': args.split,
        'baseline': baseline_summary,
        'lora': lora_summary,
        'acceptance': {'accepted': accepted, 'checks': checks},
        'metricNature': 'proxy tự động từ fit_effect_quality — KHÔNG phải điểm người chấm',
        'failedSamples': [r['id'] for r in all_rows if r.get('error') or not r.get('ok')],
        'contactSheet': str(sheet) if sheet else None,
        'perSampleCsv': str(csv_path),
    }
    (out_root / 'metrics.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    if not args.report_only:
        status = json.loads(STATUS_PATH.read_text()) if STATUS_PATH.exists() else {}
        status.update({
            'status': 'ACCEPTED' if accepted else 'REJECTED',
            'updatedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
            'evaluation': report,
        })
        if accepted:
            # `checkpoint` ở top-level là artifact cuối của lượt train (thường
            # checkpoint 600); trường này nói rõ mốc thật sự đang được chọn sau
            # benchmark để người đọc status không bật nhầm mốc bị loại.
            status['activeCheckpoint'] = str(checkpoint)
            status['activeCheckpointHash'] = loaded_info.get('checkpointHash')
        STATUS_PATH.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding='utf-8')

    print('\n=== KẾT QUẢ ===')
    print(f'  baseline: {baseline_summary}')
    print(f'  lora    : {lora_summary}')
    for check in checks:
        print(f"  [{'PASS' if check['passed'] else 'FAIL'}] {check['check']}: {check['detail']}")
    print(f"\n  => {'ACCEPTED' if accepted else 'REJECTED'}")
    print(f'  metrics: {out_root / "metrics.json"}')

    if args.report_only:
        restore_service_dropin(previous_dropin)
        print('  Report-only: đã khôi phục cấu hình service trước benchmark.')
    elif not accepted:
        # Không bật checkpoint chưa đạt.
        restore_service_dropin(previous_dropin)
        print('  Đã gỡ adapter khỏi service (checkpoint REJECTED, không bật mặc định).')
    return 0 if accepted else 2


if __name__ == '__main__':
    sys.exit(main())
