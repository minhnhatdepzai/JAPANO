"""Tải BodyM (Amazon) — bộ ẢNH có SỐ ĐO THẬT, dùng để đo sai số end-to-end.

Vì sao cần bộ này: ANSUR II chỉ có số đo bằng thước, không có ảnh, nên nó không
đo được sai số của bước ẢNH → SỐ ĐO. VITON-HD có ảnh nhưng không có chiều cao/
cân nặng/vòng đo thật. BodyM là bộ công khai duy nhất tìm được có ĐỦ CẢ HAI:
silhouette chính diện + nghiêng của người thật, kèm chiều cao, cân nặng và 14 số
đo vòng, và có `subject_id` để chia tập theo danh tính.

License: CC-BY-NC-4.0 (theo AWS Open Data Registry). PHI THƯƠNG MẠI — dùng được
cho đồ án/nghiên cứu, KHÔNG được dùng cho bản thương mại của JAPANO. Phải ghi
nguồn Amazon BodyM khi công bố.

Bucket công khai, KHÔNG cần credential AWS:
    https://amazon-bodym.s3.us-west-2.amazonaws.com/
Script này chỉ dùng HTTPS GET ẩn danh — không đọc, không tạo, không in ra bất kỳ
khoá nào.

    python3 backend/ai_training/fetch_bodym_dataset.py --splits testB testA
    python3 backend/ai_training/fetch_bodym_dataset.py --splits train --limit 800
"""

import argparse
import csv
import hashlib
import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

BUCKET = 'https://amazon-bodym.s3.us-west-2.amazonaws.com'
SPLITS = ('train', 'testA', 'testB')
CSVS = ('hwg_metadata.csv', 'measurements.csv', 'subject_to_photo_map.csv')
DEFAULT_ROOT = Path(os.getenv('JAPANO_BODYM_ROOT', '/home/nhat/jp/datasets/bodym'))
PROVENANCE = Path(__file__).resolve().parent / 'body_dataset/provenance'


def get(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()


def download(url, path):
    if path.exists() and path.stat().st_size > 0:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    data = get(url)
    path.write_bytes(data)
    return True


def sha256_of(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def photo_ids(root, split, limit=0):
    """photo_id theo thứ tự subject — cắt bớt vẫn giữ nguyên nhóm danh tính."""
    path = root / split / 'subject_to_photo_map.csv'
    by_subject = {}
    with path.open(encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            by_subject.setdefault(row['subject_id'], []).append(row['photo_id'])
    ids = []
    for subject in sorted(by_subject):
        if limit and len(ids) >= limit:
            break
        ids.extend(by_subject[subject])
    return ids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default=str(DEFAULT_ROOT))
    parser.add_argument('--splits', nargs='+', default=['testB', 'testA'], choices=SPLITS)
    parser.add_argument('--limit', type=int, default=0, help='giới hạn số ẢNH mỗi split (0 = tất cả)')
    parser.add_argument('--views', nargs='+', default=['mask', 'mask_left'])
    parser.add_argument('--workers', type=int, default=16)
    args = parser.parse_args()

    root = Path(args.root)
    manifest = {
        'dataset': 'BodyM (Amazon body measurement dataset)',
        'paper': 'Ruiz et al., Human Body Measurement Estimation with Adversarial Augmentation (arXiv:2210.05667)',
        'canonicalUrl': 'https://registry.opendata.aws/bodym/',
        'bucket': 'arn:aws:s3:::amazon-bodym (us-west-2, truy cập ẩn danh)',
        'license': 'CC-BY-NC-4.0',
        'licenseImplications': [
            'NonCommercial: chỉ dùng cho nghiên cứu/đồ án. KHÔNG dùng cho bản thương mại của JAPANO.',
            'Attribution: phải ghi nguồn Amazon BodyM khi công bố kết quả.',
            'Checkpoint train từ bộ này thừa hưởng ràng buộc phi thương mại.',
        ],
        'containsCredential': False,
        'fields': {
            'hwg_metadata.csv': 'subject_id, gender, height_cm, weight_kg',
            'measurements.csv': 'subject_id + 14 số đo cm (chest, waist, hip, height, shoulder-breadth, ...)',
            'subject_to_photo_map.csv': 'subject_id -> photo_id (nhiều ảnh mỗi người)',
            'mask/': 'silhouette nhị phân CHÍNH DIỆN, mask_left/: silhouette NGHIÊNG',
        },
        'identitySplit': ('Có subject_id. train/testA/testB là ba tập người KHÁC NHAU do tác giả chia; '
                          'testB chụp trong điều kiện ít kiểm soát nên là lát cắt "ngoài phòng lab".'),
        'limits': [
            'Chỉ có silhouette nhị phân, KHÔNG có ảnh RGB — không đo được ảnh hưởng của tách nền hay hoa văn quần áo.',
            'Người mẫu mặc đồ bó sát khi chụp, nên không đại diện cho ảnh mặc áo phom rộng.',
            'Không công bố phân bố dân tộc/tuổi chi tiết.',
        ],
        'downloadedAt': datetime.now(timezone.utc).isoformat(),
        'localPath': str(root),
        'splits': {},
    }

    for split in args.splits:
        for name in CSVS:
            download(f'{BUCKET}/{split}/{name}', root / split / name)
        ids = photo_ids(root, split, args.limit)
        jobs = [(f'{BUCKET}/{split}/{view}/{photo}.png', root / split / view / f'{photo}.png')
                for photo in ids for view in args.views]
        fetched = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            for done in pool.map(lambda job: download(*job), jobs):
                fetched += int(done)
        subjects = len({row['subject_id'] for row in
                        csv.DictReader((root / split / 'measurements.csv').open(encoding='utf-8'))})
        manifest['splits'][split] = {
            'subjects': subjects,
            'photos': len(ids),
            'filesDownloadedNow': fetched,
            'views': args.views,
            'checksums': {name: sha256_of(root / split / name) for name in CSVS},
        }
        print(f'{split}: {subjects} người, {len(ids)} ảnh, tải mới {fetched} file')

    PROVENANCE.mkdir(parents=True, exist_ok=True)
    out = PROVENANCE / 'bodym.manifest.json'
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'-> {out}')


if __name__ == '__main__':
    main()
