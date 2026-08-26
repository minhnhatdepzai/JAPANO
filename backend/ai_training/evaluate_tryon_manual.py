"""Chấm tay chất lượng ảnh thử đồ fit-aware.

Không có ground-truth "ảnh đúng" cho việc một chiếc áo chật trông thế nào, nên
chất lượng hình ảnh phải do người chấm. Script này chỉ làm hai việc trung thực:

  --init      tạo bảng chấm (CSV) từ các ca có trong backend/test/fixtures/fit/
  (mặc định)  đọc bảng đã chấm và tổng hợp thành số cho báo cáo

Mọi số do script in ra đều được gắn nhãn "manual evaluation" — đây KHÔNG phải
metric của một mô hình đã train.

Thang điểm mỗi tiêu chí: 1 (rất tệ) → 5 (hoàn hảo), riêng artifact/failure là 0/1.
    identity      giữ đúng khuôn mặt, tóc, màu da, vóc dáng
    garment       giữ đúng màu, hoạ tiết, logo, thiết kế
    fit_effect    hiệu ứng chật/rộng có đúng mức mong đợi không
    artifact      1 nếu ảnh có lỗi rõ (tay thừa, nền vỡ, vật thể lạ)
    failure       1 nếu ảnh không dùng được
"""

import argparse
import csv
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT.parent / 'test/fixtures/fit'
SHEET = ROOT / 'manual_evaluation.csv'

CASES = [
    ('normal_body_M_M', 'good'),
    ('large_body_S_XL', 'very_tight'),
    ('large_body_M_XXL', 'very_tight'),
    ('small_body_XL_S', 'very_loose'),
    ('small_body_XXL_M', 'very_loose'),
    ('kimono_tight', 'tight'),
    ('kimono_loose', 'loose'),
    ('bottom_tight', 'tight'),
    ('bottom_loose', 'loose'),
]
FIELDS = ['case', 'expected_verdict', 'image', 'identity', 'garment', 'fit_effect', 'artifact', 'failure', 'note']


def init_sheet():
    rows = []
    for case, expected in CASES:
        matches = sorted(FIXTURES.glob(f'{case}*')) if FIXTURES.exists() else []
        image = matches[0].name if matches else ''
        rows.append({
            'case': case, 'expected_verdict': expected, 'image': image,
            'identity': '', 'garment': '', 'fit_effect': '', 'artifact': '', 'failure': '', 'note': '',
        })
    with SHEET.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Đã tạo bảng chấm: {SHEET}')
    missing = [row['case'] for row in rows if not row['image']]
    if missing:
        print('Chưa có ảnh cho các ca: ' + ', '.join(missing))
        print(f'Đặt ảnh kết quả vào {FIXTURES} theo hướng dẫn trong README.md của thư mục đó.')


def summarize():
    if not SHEET.exists():
        print('Chưa có manual_evaluation.csv — chạy lại với --init rồi chấm điểm.')
        return
    with SHEET.open(encoding='utf-8') as handle:
        rows = [row for row in csv.DictReader(handle)]
    scored = [row for row in rows if row.get('identity')]
    if not scored:
        print('MANUAL_EVALUATION_EMPTY — bảng chấm chưa có dòng nào được điền.')
        print('Không có số nào để đưa vào báo cáo cho tới khi ảnh được chấm thật.')
        return

    def average(field):
        values = [float(row[field]) for row in scored if row.get(field)]
        return round(statistics.mean(values), 2) if values else None

    print(f'Manual evaluation — {len(scored)}/{len(rows)} ca đã chấm')
    print(f'  Identity preservation : {average("identity")} / 5')
    print(f'  Garment fidelity      : {average("garment")} / 5')
    print(f'  Fit-effect correctness: {average("fit_effect")} / 5')
    artifacts = sum(1 for row in scored if str(row.get('artifact')).strip() in {'1', 'true', 'yes'})
    failures = sum(1 for row in scored if str(row.get('failure')).strip() in {'1', 'true', 'yes'})
    print(f'  Artifact rate         : {artifacts}/{len(scored)} ({artifacts / len(scored) * 100:.0f}%)')
    print(f'  Failure rate          : {failures}/{len(scored)} ({failures / len(scored) * 100:.0f}%)')
    print('\nNguồn số liệu: manual evaluation (người chấm), không phải metric của model đã train.')


def main():
    parser = argparse.ArgumentParser(description='Chấm tay chất lượng ảnh thử đồ fit-aware')
    parser.add_argument('--init', action='store_true', help='Tạo bảng chấm rỗng')
    args = parser.parse_args()
    if args.init:
        init_sheet()
    else:
        summarize()


if __name__ == '__main__':
    main()
