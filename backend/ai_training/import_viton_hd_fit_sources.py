"""Nhập ảnh nguồn từ VITON-HD và sinh tập triplet fit-edit cho JAPANO.

    python3 backend/ai_training/import_viton_hd_fit_sources.py --identities 20
    python3 backend/ai_training/import_viton_hd_fit_sources.py --resume
    python3 backend/ai_training/import_viton_hd_fit_sources.py --contact-sheet

VITON-HD cho cái gì và KHÔNG cho cái gì
--------------------------------------
Cho:  ảnh người đang mặc áo bình thường (condition), ảnh áo flat-lay (garment),
      và một định danh ổn định để chia train/val/test không rò khuôn mặt.
Không cho:  nhãn chật/rộng. VITON-HD hoàn toàn không có khái niệm fit, nên
      target của các lớp tight/loose phải do fit-refiner hiện tại sinh ra và
      được đánh dấu `provenance = synthetic-flux2-klein-fit-refine`.
      Đây là self-distillation, KHÔNG phải nhãn do người chấm.

License: CC-BY-NC-SA-4.0 (phi thương mại). Xem
`backend/ai_training/provenance/viton_hd.manifest.json`.

Miền dữ liệu: chủ yếu upper-body ⇒ mọi kết luận chỉ áp cho `tops`.
"""

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageOps

# Chạy nền và ghi log ra file thì stdout bị buffer toàn phần: log rỗng suốt cả
# tiếng dù đã sinh hàng chục mẫu. In có flush để theo dõi được tiến độ thật.
print = __import__('functools').partial(print, flush=True)  # noqa: A001

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
DATASET = BACKEND / 'ai_training' / 'fit_dataset'
METADATA = DATASET / 'metadata.jsonl'
CONTACT_DIR = BACKEND / 'ai_training' / 'contact_sheets'
VITON = Path(os.getenv('JAPANO_VITON_HD_DIR', '/home/nhat/jp/datasets/viton-hd'))
SERVICE = os.getenv('JAPANO_FASHN_URL', 'http://127.0.0.1:7862')
SOURCE_DATASET = 'marquis03/high-resolution-viton-zalando-dataset'
SOURCE_LICENSE = 'CC-BY-NC-SA-4.0'

sys.path.insert(0, str(BACKEND))
from accessory_pipeline import fit_effect_quality  # noqa: E402

# Bảy lớp. `good` không cần sinh ảnh: chính ảnh condition đã là "mặc vừa".
FIT_CASES = [
    ('good', 0.0, 'M', 'M', []),
    ('slightly_tight', 0.34, 'M', 'L', ['fabric_tension']),
    ('tight', 0.66, 'M', 'XL', ['fabric_tension', 'seam_stress', 'button_strain']),
    ('very_tight', 0.95, 'S', 'XXL',
     ['fabric_tension', 'seam_stress', 'button_strain', 'seam_separation', 'small_seam_split']),
    ('slightly_loose', 0.34, 'L', 'M', ['extra_folds']),
    ('loose', 0.66, 'XL', 'M', ['dropped_shoulders', 'oversized_sleeves', 'extra_folds']),
    ('very_loose', 0.95, 'XXL', 'S',
     ['dropped_shoulders', 'oversized_sleeves', 'extra_folds', 'wide_drape', 'oversized_silhouette']),
]
FIT_TOKENS = {
    'very_tight': 'FIT_VERY_TIGHT', 'tight': 'FIT_TIGHT', 'slightly_tight': 'FIT_TIGHT',
    'good': 'FIT_GOOD',
    'slightly_loose': 'FIT_LOOSE', 'loose': 'FIT_LOOSE', 'very_loose': 'FIT_VERY_LOOSE',
}


def caption_for(verdict: str, severity: float) -> str:
    """Prompt điều kiện — cùng từ vựng với lúc suy luận để LoRA học đúng công tắc."""
    return (
        f"{FIT_TOKENS[verdict]}. Edit only the clothing fit of the main person. "
        f"Severity {severity:.2f}. Keep identity, face, body size, pose, background "
        f"and garment design unchanged."
    )


def load_rows():
    if not METADATA.exists():
        return []
    return [json.loads(line) for line in METADATA.read_text(encoding='utf-8').splitlines()
            if line.strip() and not line.startswith('//')]


def write_rows(rows):
    METADATA.parent.mkdir(parents=True, exist_ok=True)
    METADATA.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf-8')


def pick_identities(count: int, seed: int):
    """Chọn N cặp (người, áo) từ train_pairs.txt một cách tất định."""
    pairs_file = VITON / 'train_pairs.txt'
    if not pairs_file.exists():
        raise SystemExit(f'Không thấy {pairs_file}. Kiểm tra JAPANO_VITON_HD_DIR.')
    pairs = [line.split() for line in pairs_file.read_text().splitlines() if line.strip()]
    # Ghép người với CHÍNH chiếc áo họ đang mặc (paired setting): ảnh người
    # trong VITON-HD đã mặc sẵn áo cùng mã, nên condition và garment khớp nhau.
    people = sorted({p[0] for p in pairs})
    random.Random(seed).shuffle(people)
    chosen = []
    for person in people:
        person_path = VITON / 'train' / 'image' / person
        cloth_path = VITON / 'train' / 'cloth' / person  # cùng mã = áo đang mặc
        if person_path.exists() and cloth_path.exists():
            chosen.append((person_path, cloth_path))
        if len(chosen) >= count:
            break
    return chosen


def request_fit_target(condition_path: Path, verdict: str, severity: float,
                       selected: str, recommended: str, seed: int, timeout: int):
    """Gọi /fit-refine. KHÔNG gửi kèm ảnh áo: ảnh flat-lay của VITON-HD sạch,
    nhưng bước fit không cần nó và bỏ đi thì tránh hẳn nguy cơ model bám vào
    khung cảnh của ảnh tham chiếu."""
    with open(condition_path, 'rb') as handle:
        files = {'person': (condition_path.name, handle, 'image/jpeg')}
        data = {
            'category': 'tops', 'verdict': verdict, 'severity': str(severity),
            'tear_allowed': 'true' if verdict == 'very_tight' else 'false',
            'outerwear': 'false', 'selected_size': selected,
            'recommended_size': recommended, 'seed': str(seed),
        }
        response = requests.post(f'{SERVICE}/fit-refine', files=files, data=data, timeout=timeout)
    if response.status_code != 200:
        detail = ''
        try:
            detail = str(response.json().get('detail', ''))[:160]
        except Exception:
            pass
        raise RuntimeError(f'HTTP {response.status_code} {detail}')
    return response.content


def quality_check(condition_path: Path, target_path: Path, verdict: str, severity: float):
    with Image.open(condition_path) as clean, Image.open(target_path) as result:
        return fit_effect_quality(
            clean.convert('RGB'), result.convert('RGB'), None, 'upper',
            {'verdict': verdict, 'severity': severity, 'tearAllowed': verdict == 'very_tight'},
        )


def build(identities: int, seed: int, resume: bool, timeout: int, limit_cases: int,
          retry_offset: int = 0, only_classes: set | None = None):
    for sub in ('person', 'garment', 'target'):
        (DATASET / 'images' / sub).mkdir(parents=True, exist_ok=True)
    rows = load_rows() if resume else [r for r in load_rows() if r.get('sourceDataset') != SOURCE_DATASET]
    seen = {r['id'] for r in rows}
    chosen = pick_identities(identities, seed)
    print(f'Đã chọn {len(chosen)} identity từ VITON-HD')

    stats = {'kept': 0, 'rejected': 0, 'error': 0, 'skipped': 0}
    started = time.time()
    for index, (person_path, cloth_path) in enumerate(chosen):
        person_id = f'viton_{person_path.stem}'
        condition_rel = f'person/{person_id}.jpg'
        garment_rel = f'garment/{person_id}.jpg'
        condition_abs = DATASET / 'images' / condition_rel
        garment_abs = DATASET / 'images' / garment_rel
        if not condition_abs.exists():
            with Image.open(person_path) as im:
                ImageOps.exif_transpose(im).convert('RGB').save(condition_abs, quality=95)
        if not garment_abs.exists():
            with Image.open(cloth_path) as im:
                ImageOps.exif_transpose(im).convert('RGB').save(garment_abs, quality=95)

        for case_index, (verdict, severity, selected, recommended, effects) in enumerate(FIT_CASES[:limit_cases]):
            sample_id = f'{person_id}_{verdict}'
            if sample_id in seen:
                stats['skipped'] += 1
                continue
            if only_classes and verdict not in only_classes:
                continue
            target_rel = f'target/{sample_id}.png'
            target_abs = DATASET / 'images' / target_rel
            quality = None
            try:
                if verdict == 'good':
                    # "Vừa" = chính ảnh gốc, chuẩn hoá về đúng khổ mà refiner trả
                    # ra để cặp (condition, target) cùng kích thước khi train.
                    with Image.open(condition_abs) as im:
                        im.convert('RGB').resize((576, 768), Image.Resampling.LANCZOS).save(target_abs)
                    quality = {'ok': True, 'reasons': [], 'note': 'identity_target'}
                else:
                    payload = request_fit_target(
                        condition_abs, verdict, severity, selected, recommended,
                        # retry_offset đổi seed để lượt chạy lại KHÔNG lặp lại y
                        # nguyên ảnh đã bị cổng chất lượng loại. Không có nó,
                        # `--resume` chỉ sinh lại đúng bức ảnh hỏng cũ.
                        seed=1000 + index * 17 + case_index + retry_offset * 9973,
                        timeout=timeout,
                    )
                    target_abs.write_bytes(payload)
                    quality = quality_check(condition_abs, target_abs, verdict, severity)
                    if not quality.get('ok'):
                        # Mẫu bị cổng chất lượng chặn KHÔNG được vào metadata.
                        target_abs.unlink(missing_ok=True)
                        stats['rejected'] += 1
                        print(f'  [reject] {sample_id}: {",".join(quality.get("reasons", []))}')
                        continue
            except Exception as exc:
                target_abs.unlink(missing_ok=True)
                stats['error'] += 1
                print(f'  [error]  {sample_id}: {exc}')
                continue

            rows.append({
                'id': sample_id,
                'personId': person_id,
                'person': condition_rel,
                'garment': garment_rel,
                'target': target_rel,
                'category': 'tops',
                'selectedSize': selected,
                'recommendedSize': recommended,
                'fitVerdict': verdict,
                'severity': severity,
                'effects': effects,
                'caption': caption_for(verdict, severity),
                'provenance': 'identity-copy' if verdict == 'good' else 'synthetic-flux2-klein-fit-refine',
                'sourceDataset': SOURCE_DATASET,
                'sourceLicense': SOURCE_LICENSE,
                'sourceImage': str(person_path.relative_to(VITON)),
                'qualityGate': {k: v for k, v in (quality or {}).items() if k != 'resultPose'},
            })
            seen.add(sample_id)
            stats['kept'] += 1
            write_rows(rows)
            elapsed = time.time() - started
            print(f'  [ok]     {sample_id}  ({stats["kept"]} mẫu, {elapsed / 60:.1f} phút)')

    print(f'\nTổng: giữ {stats["kept"]} | loại {stats["rejected"]} | lỗi {stats["error"]} | bỏ qua {stats["skipped"]}')
    print(f'metadata: {METADATA} ({len(rows)} dòng)')
    return rows


def contact_sheet(per_class: int = 3):
    """Bảng ảnh để mắt người kiểm tra nhanh từng lớp."""
    rows = load_rows()
    by_class = {}
    for row in rows:
        by_class.setdefault(row['fitVerdict'], []).append(row)
    order = [case[0] for case in FIT_CASES]
    cell = 210
    width = cell * (per_class * 2)
    height = cell * len([v for v in order if by_class.get(v)]) + 30
    sheet = Image.new('RGB', (width, height), (250, 250, 250))
    draw = ImageDraw.Draw(sheet)
    y = 20
    for verdict in order:
        items = by_class.get(verdict, [])[:per_class]
        if not items:
            continue
        draw.text((6, y - 15), verdict, fill=(20, 20, 20))
        x = 0
        for row in items:
            for rel in (row['person'], row['target']):
                path = DATASET / 'images' / rel
                if not path.exists():
                    x += cell
                    continue
                with Image.open(path) as im:
                    thumb = im.convert('RGB')
                    thumb.thumbnail((cell - 6, cell - 6))
                    sheet.paste(thumb, (x + 3, y + 3))
                x += cell
        y += cell
    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    out = CONTACT_DIR / 'fit_dataset_contact_sheet.jpg'
    sheet.save(out, quality=88)
    print(f'Contact sheet: {out}')
    return out


def main():
    parser = argparse.ArgumentParser(description='Nhập nguồn VITON-HD và sinh triplet fit')
    parser.add_argument('--identities', type=int, default=20)
    parser.add_argument('--seed', type=int, default=17)
    parser.add_argument('--resume', action='store_true', help='Giữ mẫu đã có, chỉ sinh phần thiếu')
    parser.add_argument('--timeout', type=int, default=900)
    parser.add_argument('--cases', type=int, default=len(FIT_CASES), help='Số lớp mỗi identity')
    parser.add_argument('--contact-sheet', action='store_true', help='Chỉ dựng contact sheet rồi thoát')
    parser.add_argument('--retry-offset', type=int, default=0,
                        help='Đổi seed cho lượt sinh lại các mẫu từng bị loại')
    parser.add_argument('--only-classes', default='',
                        help='Chỉ sinh các lớp này, vd: loose,very_loose')
    args = parser.parse_args()

    if args.contact_sheet:
        contact_sheet()
        return
    only = {c.strip() for c in args.only_classes.split(',') if c.strip()} or None
    build(args.identities, args.seed, args.resume, args.timeout, args.cases,
          retry_offset=args.retry_offset, only_classes=only)
    contact_sheet()


if __name__ == '__main__':
    main()
