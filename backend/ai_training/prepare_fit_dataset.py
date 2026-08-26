"""Kiểm tra và chia tập dữ liệu fit-aware của JAPANO.

Đọc `fit_dataset/metadata.jsonl`, xác thực từng dòng, rồi chia 70/15/15 theo
NHÓM DANH TÍNH: mọi mẫu của cùng một người phải nằm trong cùng một tập, nếu
không mô hình sẽ học thuộc khuôn mặt và điểm test trở nên vô nghĩa.

Chạy:
    python3 backend/ai_training/prepare_fit_dataset.py
    python3 backend/ai_training/prepare_fit_dataset.py --strict   # thiếu ảnh -> lỗi

Script này KHÔNG sinh dữ liệu và KHÔNG bịa nhãn. Chưa có dữ liệu thì nó nói
thẳng là chưa có.
"""

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / 'fit_dataset'
METADATA = DATASET / 'metadata.jsonl'

FIT_CLASSES = [
    'very_tight', 'tight', 'slightly_tight', 'good',
    'slightly_loose', 'loose', 'very_loose',
]
CATEGORIES = ['tops', 'bottoms', 'one-pieces']
REQUIRED = ['id', 'person', 'garment', 'category', 'selectedSize', 'recommendedSize', 'fitVerdict']


def load_rows():
    if not METADATA.exists():
        return []
    rows = []
    for index, line in enumerate(METADATA.read_text(encoding='utf-8').splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        try:
            rows.append((index, json.loads(line)))
        except json.JSONDecodeError as exc:
            raise SystemExit(f'metadata.jsonl dòng {index} không phải JSON hợp lệ: {exc}')
    return rows


def validate(rows, strict=False):
    problems = []
    for index, row in rows:
        for field in REQUIRED:
            if not row.get(field):
                problems.append(f'dòng {index}: thiếu trường "{field}"')
        if row.get('fitVerdict') not in FIT_CLASSES:
            problems.append(f'dòng {index}: fitVerdict "{row.get("fitVerdict")}" không thuộc {FIT_CLASSES}')
        if row.get('category') not in CATEGORIES:
            problems.append(f'dòng {index}: category "{row.get("category")}" không thuộc {CATEGORIES}')
        severity = row.get('severity')
        if severity is not None and not (0 <= float(severity) <= 1):
            problems.append(f'dòng {index}: severity phải nằm trong [0,1]')
        for field in ('person', 'garment', 'target'):
            relative = row.get(field)
            if not relative:
                continue
            if not (DATASET / 'images' / relative).exists():
                message = f'dòng {index}: không tìm thấy ảnh {field} -> images/{relative}'
                if strict:
                    problems.append(message)
                else:
                    print(f'  [cảnh báo] {message}')
    return problems


def identity_of(row):
    """Danh tính người mẫu — ưu tiên trường tường minh, nếu không thì lấy tên file."""
    return str(row.get('personId') or Path(str(row.get('person', ''))).stem.split('_')[0] or row.get('id'))


def split_by_identity(rows, ratios=(0.70, 0.15, 0.15), seed=17):
    groups = defaultdict(list)
    for _, row in rows:
        groups[identity_of(row)].append(row)
    keys = sorted(groups)
    random.Random(seed).shuffle(keys)
    total = sum(len(groups[key]) for key in keys)
    targets = [ratio * total for ratio in ratios]
    buckets = [[], [], []]
    for key in keys:
        # Ưu tiên tập nào đang thiếu nhiều nhất so với chỉ tiêu.
        index = max(range(3), key=lambda i: targets[i] - len(buckets[i]))
        buckets[index].extend(groups[key])
    return buckets


def report(name, rows):
    counter = Counter(row['fitVerdict'] for row in rows)
    categories = Counter(row['category'] for row in rows)
    print(f'  {name:<6} {len(rows):>4} mẫu | lớp: ' + ', '.join(f'{key}={counter.get(key, 0)}' for key in FIT_CLASSES))
    print(f'         {"":>4}        | loại: ' + ', '.join(f'{key}={categories.get(key, 0)}' for key in CATEGORIES))
    return counter


def main():
    parser = argparse.ArgumentParser(description='Kiểm tra và chia tập dữ liệu fit-aware')
    parser.add_argument('--strict', action='store_true', help='Thiếu ảnh cũng coi là lỗi')
    parser.add_argument('--seed', type=int, default=17)
    args = parser.parse_args()

    rows = load_rows()
    if not rows:
        print('DATASET_EMPTY — chưa có mẫu nào trong fit_dataset/metadata.jsonl.')
        print('Xem backend/ai_training/README.md để biết cách bổ sung dữ liệu.')
        return

    print(f'Đã đọc {len(rows)} mẫu từ {METADATA}')
    problems = validate(rows, strict=args.strict)
    if problems:
        print('\nDỮ LIỆU CHƯA HỢP LỆ:')
        for problem in problems:
            print(f'  - {problem}')
        raise SystemExit(1)

    train, val, test = split_by_identity(rows, seed=args.seed)
    print('\nPhân chia theo danh tính người mẫu (không rò rỉ giữa các tập):')
    counters = [report(name, bucket) for name, bucket in (('train', train), ('val', val), ('test', test))]

    for name, bucket in (('train', train), ('val', val), ('test', test)):
        path = DATASET / f'{name}.jsonl'
        path.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in bucket), encoding='utf-8')
        print(f'  -> đã ghi {path}')

    total = Counter()
    for counter in counters:
        total.update(counter)
    missing = [cls for cls in FIT_CLASSES if not total.get(cls)]
    if missing:
        print(f'\n[cảnh báo] Chưa có mẫu nào cho lớp: {", ".join(missing)}. '
              'Tập lệch lớp thì mọi số đo chất lượng sau này đều không đại diện.')
    largest = max(total.values()) if total else 0
    smallest = min((total.get(cls, 0) for cls in FIT_CLASSES if total.get(cls)), default=0)
    if smallest and largest / smallest > 4:
        print(f'[cảnh báo] Lớp nhiều nhất gấp {largest / smallest:.1f} lần lớp ít nhất — nên cân bằng thêm.')


if __name__ == '__main__':
    main()
