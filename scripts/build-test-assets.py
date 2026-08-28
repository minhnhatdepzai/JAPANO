"""Dựng bộ ảnh test cho Virtual Try-On theo ma trận vóc dáng / tư thế / ảnh khó.

    python3 scripts/build-test-assets.py

Nguồn ảnh: VITON-HD (đã tải sẵn, license CC-BY-NC-SA-4.0, phi thương mại — hợp
lệ cho kiểm thử đồ án). Script KHÔNG tải gì từ internet.

Cách chọn mẫu: đo tỉ lệ hình học thật của từng ảnh bằng chính
`backend/body_analysis.py` — cùng bộ đo mà pipeline dùng lúc chạy — rồi xếp ảnh
vào các lớp tương đương (equivalence class) theo tỉ lệ bề ngang thân/chiều cao
và tỉ lệ vai/hông. Nhờ vậy nhãn "gầy/đầy người/vai rộng" đến từ SỐ ĐO của ảnh
chứ không phải phỏng đoán bằng mắt.

Ảnh khó (thiếu sáng, độ phân giải thấp, người nhỏ trong khung...) được tạo bằng
biến đổi có kiểm soát từ chính ảnh gốc, nên biết chính xác biến số nào đang được
kiểm thử.
"""

import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
VITON = Path('/home/nhat/jp/datasets/viton-hd')
OUT = ROOT / 'test-assets'
sys.path.insert(0, str(BACKEND))

# Lớp tương đương theo bodyWidthRatio (bề ngang thân / chiều cao pixel).
# Ngưỡng lấy từ phân vị của chính tập ảnh, không phải số chọn tay — xem classify().
BODY_CLASSES = ['very_slim', 'slim', 'average', 'fuller', 'plus']


def measure(path: Path):
    from PIL import Image as PILImage
    from accessory_pipeline import analyze
    import body_analysis as ba
    with PILImage.open(path) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
    pose = analyze(image, source_coordinates=True)
    if pose.get('fallback'):
        return None
    m = ba.measure_body(image, pose)
    shape = ba.body_shape_ratios(m)
    quality = ba.pose_quality(pose, m)
    if quality < 0.4 or not shape.get('bodyWidthRatio'):
        return None
    return {
        'bodyWidthRatio': shape['bodyWidthRatio'],
        'shoulderHipRatio': shape['shoulderHipRatio'],
        'torsoRatio': shape['torsoRatio'],
        'legRatio': shape['legRatio'],
        'coverage': m['coverage'],
        'quality': round(quality, 3),
        'tiltDeg': round(m['tiltDeg'], 1),
    }


def classify(samples):
    """Chia thành 5 lớp theo phân vị của chính tập đã đo."""
    ordered = sorted(samples, key=lambda s: s['metrics']['bodyWidthRatio'])
    size = max(1, len(ordered) // len(BODY_CLASSES))
    for index, sample in enumerate(ordered):
        sample['body_class'] = BODY_CLASSES[min(index // size, len(BODY_CLASSES) - 1)]
    return ordered


def make_hard_variants(source: Path, stem: str, out_dir: Path):
    """Ảnh khó — mỗi biến thể chỉ đổi ĐÚNG MỘT biến số để quy lỗi được."""
    out_dir.mkdir(parents=True, exist_ok=True)
    made = []
    with Image.open(source) as im:
        base = im.convert('RGB')
        variants = {
            'I04_low_light': lambda x: ImageEnhance.Brightness(x).enhance(0.35),
            'I05_bright': lambda x: ImageEnhance.Brightness(x).enhance(1.75),
            'I06_low_res': lambda x: x.resize((x.width // 5, x.height // 5)).resize(x.size),
            'I09_square': lambda x: ImageOps.fit(x, (min(x.size), min(x.size))),
            'I10_small_person': lambda x: ImageOps.pad(
                x.resize((x.width // 3, x.height // 3)), x.size, color=(240, 240, 240)),
            'I11_edge': lambda x: x.crop((x.width // 3, 0, x.width, x.height)),
            'I02_dark_bg': lambda x: Image.composite(
                x, Image.new('RGB', x.size, (18, 18, 22)),
                x.convert('L').point(lambda p: 255 if p < 232 else 0)),
        }
        for name, transform in variants.items():
            target = out_dir / f'{stem}_{name}.jpg'
            transform(base).save(target, quality=92)
            made.append({'file': str(target.relative_to(OUT)), 'variant': name})
    return made


def main():
    people_dir = VITON / 'test' / 'image'
    if not people_dir.exists():
        raise SystemExit(f'Không thấy {people_dir}')
    candidates = sorted(people_dir.glob('*.jpg'))[:120]
    print(f'Đo {len(candidates)} ảnh ứng viên bằng chính bộ đo của pipeline…')

    samples = []
    for index, path in enumerate(candidates):
        metrics = measure(path)
        if metrics:
            samples.append({'source': path, 'metrics': metrics})
        if (index + 1) % 20 == 0:
            print(f'  {index + 1}/{len(candidates)} — giữ {len(samples)}')
    if len(samples) < len(BODY_CLASSES) * 2:
        raise SystemExit(f'Chỉ đo được {len(samples)} ảnh hợp lệ, chưa đủ để chia lớp.')

    classified = classify(samples)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        'source': 'VITON-HD (marquis03/high-resolution-viton-zalando-dataset)',
        'license': 'CC-BY-NC-SA-4.0 — phi thương mại, dùng cho kiểm thử đồ án',
        'measuredBy': 'backend/body_analysis.py (cùng bộ đo pipeline dùng khi chạy thật)',
        'bodyClassNote': 'Nhãn lớp suy từ phân vị bodyWidthRatio của chính tập đã đo, không gán bằng mắt.',
        'people': [],
        'hardImages': [],
    }

    # Mỗi lớp lấy 2 mẫu để có đại diện mà không phình bộ test.
    per_class = {}
    for sample in classified:
        bucket = per_class.setdefault(sample['body_class'], [])
        if len(bucket) < 2:
            bucket.append(sample)

    for body_class, bucket in per_class.items():
        target_dir = OUT / 'people' / body_class
        target_dir.mkdir(parents=True, exist_ok=True)
        for sample in bucket:
            stem = sample['source'].stem
            target = target_dir / f'{stem}.jpg'
            shutil.copy2(sample['source'], target)
            manifest['people'].append({
                'id': f'{body_class}_{stem}',
                'file': str(target.relative_to(OUT)),
                'body_class': body_class,
                'metrics': sample['metrics'],
                'expected_behavior': 'garment scales with measured torso, body itself unchanged',
            })

    # Ảnh khó dựng từ mẫu "average" đầu tiên để cô lập đúng biến số ảnh.
    average = per_class.get('average') or next(iter(per_class.values()))
    hard_source = average[0]['source']
    manifest['hardImages'] = make_hard_variants(hard_source, hard_source.stem, OUT / 'people' / 'difficult')

    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\nĐã dựng {len(manifest["people"])} ảnh người trên {len(per_class)} lớp, '
          f'{len(manifest["hardImages"])} ảnh khó')
    for body_class, bucket in per_class.items():
        ratios = [round(s['metrics']['bodyWidthRatio'], 3) for s in bucket]
        print(f'  {body_class:11} bodyWidthRatio={ratios}')
    print(f'-> {OUT / "manifest.json"}')


if __name__ == '__main__':
    main()
