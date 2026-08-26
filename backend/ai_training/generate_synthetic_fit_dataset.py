"""Sinh bộ triplet fit-edit có provenance rõ ràng từ catalog JAPANO.

Đây là dữ liệu TỔNG HỢP để khởi động thí nghiệm LoRA, không thay thế bộ ảnh
người thật được chấm nhãn. Ảnh catalog đang mặc đồ là condition; FLUX.2 fit
refiner tạo target theo bảy mức. Mỗi target phải qua chính fit quality gate của
ứng dụng trước khi được ghi vào metadata.

Chạy khi service FASHN/FLUX ở cổng 7862 đang hoạt động:
  python3 backend/ai_training/generate_synthetic_fit_dataset.py --resume
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
DATASET = BACKEND / 'ai_training' / 'fit_dataset'
PRODUCTS = ROOT / 'mobile' / 'assets' / 'products'
METADATA = DATASET / 'metadata.jsonl'
sys.path.insert(0, str(BACKEND))
from accessory_pipeline import fit_effect_quality  # noqa: E402


# Chỉ dùng SKU có cả ảnh người đang mặc và flat-lay trong source hiện tại.
# Mỗi slug là một identity group để prepare_fit_dataset.py không làm rò khuôn
# mặt giữa train/validation/test.
SOURCES = [
    ('ao-len-cardigan', 'tops', True),
    ('ao-len-co-lo', 'tops', False),
    ('blazer-kaki', 'tops', True),
    ('cardigan-dai', 'tops', True),
    ('kimono-hong', 'one-pieces', False),
    ('naruto', 'one-pieces', False),
    ('so-mi-trang', 'tops', False),
    ('yae-miko', 'one-pieces', False),
    ('yukata-xanh', 'one-pieces', False),
    ('yumeko', 'one-pieces', False),
]

FIT_CASES = [
    ('very_tight', 0.95, 'S', 'XL', ['fabric_tension', 'seam_stress', 'button_strain', 'small_seam_split']),
    ('tight', 0.66, 'M', 'XL', ['fabric_tension', 'seam_stress', 'button_strain']),
    ('slightly_tight', 0.34, 'M', 'L', ['fabric_tension']),
    ('good', 0.0, 'M', 'M', []),
    ('slightly_loose', 0.34, 'L', 'M', ['extra_folds']),
    ('loose', 0.66, 'XL', 'M', ['dropped_shoulders', 'oversized_sleeves', 'extra_folds']),
    ('very_loose', 0.95, 'XL', 'S', ['dropped_shoulders', 'oversized_sleeves', 'extra_folds', 'wide_drape', 'oversized_silhouette']),
]


def find_asset(slug, suffix):
    matches = sorted(PRODUCTS.glob(f'{slug}_{suffix}.*'))
    if not matches:
        raise FileNotFoundError(f'Không thấy asset {slug}_{suffix}.*')
    return matches[0]


def write_metadata(rows):
    METADATA.parent.mkdir(parents=True, exist_ok=True)
    METADATA.write_text(
        ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in sorted(rows.values(), key=lambda item: item['id'])),
        encoding='utf-8',
    )


def quality_for(condition_path, target_path, category, verdict, severity):
    with Image.open(condition_path) as source, Image.open(target_path) as target:
        return fit_effect_quality(
            ImageOps.exif_transpose(source).convert('RGB'),
            ImageOps.exif_transpose(target).convert('RGB'),
            cloth_type='upper' if category == 'tops' else 'overall',
            fit={
                'verdict': verdict,
                'severity': severity,
                'tearAllowed': verdict == 'very_tight' and category != 'bottoms',
            },
        )


def generate_target(service_url, condition_path, garment_path, output_path, case, category, outerwear, seed):
    verdict, severity, selected, recommended, _effects = case
    if verdict == 'good':
        shutil.copy2(condition_path, output_path)
        return {'ok': True, 'reasons': [], 'effectVisible': False, 'syntheticIdentityTarget': True}

    last_quality = None
    for retry in range(3):
        with condition_path.open('rb') as person, garment_path.open('rb') as cloth:
            response = requests.post(
                f'{service_url.rstrip("/")}/fit-refine',
                files={'person': (condition_path.name, person), 'cloth': (garment_path.name, cloth)},
                data={
                    'category': category,
                    'verdict': verdict,
                    'severity': str(severity),
                    'tear_allowed': str(verdict == 'very_tight' and category != 'bottoms').lower(),
                    'outerwear': str(bool(outerwear)).lower(),
                    'selected_size': selected,
                    'recommended_size': recommended,
                    'seed': str(seed + retry * 997),
                },
                timeout=900,
            )
        if response.status_code != 200:
            print(f'    lượt {retry + 1}: HTTP {response.status_code} {response.text[:160]}')
            continue
        output_path.write_bytes(response.content)
        last_quality = quality_for(condition_path, output_path, category, verdict, severity)
        if last_quality.get('ok'):
            return last_quality
        print(f'    lượt {retry + 1}: quality reject {last_quality.get("reasons")}')
    output_path.unlink(missing_ok=True)
    raise RuntimeError(f'Không tạo được target qua quality gate: {last_quality}')


def main():
    parser = argparse.ArgumentParser(description='Sinh dataset fit tổng hợp có quality gate')
    parser.add_argument('--service-url', default='http://127.0.0.1:7862')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--only', nargs='*', help='Chỉ sinh các slug được chỉ định')
    args = parser.parse_args()

    person_dir = DATASET / 'images' / 'person'
    garment_dir = DATASET / 'images' / 'garment'
    target_dir = DATASET / 'images' / 'target'
    for directory in (person_dir, garment_dir, target_dir):
        directory.mkdir(parents=True, exist_ok=True)

    existing = {}
    if args.resume and METADATA.exists():
        for line in METADATA.read_text(encoding='utf-8').splitlines():
            if line.strip():
                row = json.loads(line)
                existing[row['id']] = row

    sources = [item for item in SOURCES if not args.only or item[0] in set(args.only)]
    for source_index, (slug, category, outerwear) in enumerate(sources):
        source_asset = find_asset(slug, '1')
        garment_asset = find_asset(slug, 'tryon-flat')
        condition_path = person_dir / f'{slug}{source_asset.suffix.lower()}'
        garment_path = garment_dir / f'{slug}{garment_asset.suffix.lower()}'
        if not condition_path.exists():
            shutil.copy2(source_asset, condition_path)
        if not garment_path.exists():
            shutil.copy2(garment_asset, garment_path)

        for case_index, case in enumerate(FIT_CASES):
            verdict, severity, selected, recommended, effects = case
            sample_id = f'synthetic_{slug}_{verdict}'
            target_path = target_dir / f'{slug}_{verdict}.png'
            if args.resume and sample_id in existing and target_path.exists():
                print(f'[skip] {sample_id}')
                continue
            print(f'[{source_index + 1}/{len(sources)}] {slug}: {verdict}')
            try:
                quality = generate_target(
                    args.service_url, condition_path, garment_path, target_path,
                    case, category, outerwear, seed=77 + source_index * 101 + case_index,
                )
            except Exception as exc:
                print(f'  [loại] {sample_id}: {exc}')
                continue
            existing[sample_id] = {
                'id': sample_id,
                'personId': slug,
                'person': f'person/{condition_path.name}',
                'garment': f'garment/{garment_path.name}',
                'target': f'target/{target_path.name}',
                'category': category,
                'selectedSize': selected,
                'recommendedSize': recommended,
                'fitVerdict': verdict,
                'severity': severity,
                'effects': effects,
                'outerwear': outerwear,
                'provenance': 'synthetic-flux2-klein-fit-refine',
                'sourceCredits': 'mobile/assets/products/IMAGE-CREDITS.json',
                'qualityGate': quality,
            }
            write_metadata(existing)

    print(f'Đã có {len(existing)} mẫu tại {METADATA}')
    print('Dữ liệu này là synthetic bootstrap; phải ghi đúng provenance trong báo cáo và tiếp tục bổ sung người thật.')


if __name__ == '__main__':
    main()
