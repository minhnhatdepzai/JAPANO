"""Ma trận kiểm thử Virtual Try-On: vóc dáng × size, chạy qua API thật.

    python3 scripts/tryon-size-matrix.py --quick     # 1 người × 3 size
    python3 scripts/tryon-size-matrix.py             # toàn bộ ma trận

Câu hỏi mà bộ test này trả lời — và là câu hỏi quan trọng nhất của tính năng:

    Cùng một người, đổi size áo, ảnh kết quả có KHÁC nhau không?

Nếu XS và XXL cho ra ảnh gần như giống hệt thì hệ thống chỉ đang "co áo cho vừa
người", tức là sai hoàn toàn về mặt nghiệp vụ. Vì vậy mỗi ca được chấm bằng cả
số liệu (mức fit, severity, hiệu ứng có được dựng không) lẫn ảnh lưu lại để soi
bằng mắt.

Số đo cơ thể được lấy từ CHÍNH ảnh (body analysis), không bịa. Khi biết chiều
cao/cân nặng thật thì truyền vào để so sánh hai chế độ.
"""

import argparse
import base64
import json
import time
from pathlib import Path

import requests

print = __import__('functools').partial(print, flush=True)

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'test-assets'
RESULTS = ROOT / 'test-results' / 'size-matrix'
API = 'http://127.0.0.1:4100'

# Người test: (nhãn lớp, chiều cao, cân nặng) — mô phỏng các vóc dáng khác nhau
# bằng số đo NGƯỜI DÙNG NHẬP, vì đó là đường dữ liệu mạnh nhất của size engine.
BODY_PROFILES = [
    ('short_thin',   {'height': '150', 'weight': '42'}),
    ('short_plus',   {'height': '152', 'weight': '78'}),
    ('average',      {'height': '165', 'weight': '58'}),
    ('tall_thin',    {'height': '180', 'weight': '58'}),
    ('tall_plus',    {'height': '182', 'weight': '95'}),
]
SIZES = ['S', 'M', 'L', 'XL', 'XXL']


def load_person(image_path: Path) -> str:
    return 'data:image/jpeg;base64,' + base64.b64encode(image_path.read_bytes()).decode()


def pick_person_image() -> Path:
    manifest = ASSETS / 'manifest.json'
    if manifest.exists():
        data = json.loads(manifest.read_text(encoding='utf-8'))
        people = data.get('people') or []
        if people:
            return ASSETS / people[0]['file']
    fallback = ROOT / 'backend/assets/poses/front-neutral-reference.jpg'
    if fallback.exists():
        return fallback
    raise SystemExit('Không tìm thấy ảnh người để test.')


def run_case(person_b64: str, product: str, size: str, profile: dict, label: str, timeout=900):
    payload = {
        'personImageBase64': person_b64,
        'productId': product,
        'size': size,
        'profile': profile,
        'measurementMode': 'user',
    }
    # Báo focus là việc phụ trợ; backend chưa sẵn sàng thì đừng làm hỏng cả ca test.
    try:
        requests.post(f'{API}/api/gpu/focus', json={'focus': 'tryon'}, timeout=15)
    except requests.RequestException:
        pass
    started = time.time()
    try:
        response = requests.post(f'{API}/api/tryon', json=payload, timeout=timeout)
        data = response.json()
    except Exception as exc:
        return {'case': label, 'size': size, 'ok': False, 'error': str(exc)[:120],
                'seconds': round(time.time() - started, 1)}
    took = round(time.time() - started, 1)
    fit = data.get('sizeFit') or {}
    effect = data.get('fitEffect') or {}
    body = data.get('bodyAnalysis') or {}
    image_path = ''
    image = data.get('imageBase64') or ''
    if image.startswith('data:'):
        RESULTS.mkdir(parents=True, exist_ok=True)
        image_path = str(RESULTS / f'{label}_{size}.png')
        Path(image_path).write_bytes(base64.b64decode(image.split(',', 1)[1]))
    return {
        'case': label, 'size': size, 'ok': bool(data.get('ok')), 'status': response.status_code,
        'seconds': took,
        'recommendedSize': fit.get('recommendedSize'),
        'verdict': fit.get('verdict'), 'severity': fit.get('severity'),
        'delta': fit.get('delta'),
        'tension': (fit.get('visualEffect') or {}).get('tension'),
        'looseness': (fit.get('visualEffect') or {}).get('looseness'),
        'effectApplied': effect.get('applied'),
        'heightUsed': (body.get('estimatedHeight') or {}).get('valueCm'),
        'image': image_path,
        'message': str(data.get('message'))[:80],
    }


def main():
    parser = argparse.ArgumentParser(description='Ma trận vóc dáng × size cho try-on')
    parser.add_argument('--product', default='ao-len-cardigan')
    parser.add_argument('--quick', action='store_true', help='1 người × 3 size')
    parser.add_argument('--sizes', default=','.join(SIZES))
    args = parser.parse_args()

    person_path = pick_person_image()
    person_b64 = load_person(person_path)
    print(f'Ảnh người: {person_path}')
    print(f'Sản phẩm : {args.product}\n')

    profiles = BODY_PROFILES[2:3] if args.quick else BODY_PROFILES
    # --sizes luôn thắng: `--quick` chỉ rút gọn số NGƯỜI, không được âm thầm ghi
    # đè danh sách size mà người chạy chỉ định.
    explicit_sizes = [s.strip() for s in args.sizes.split(',') if s.strip()]
    sizes = explicit_sizes if explicit_sizes != SIZES else (['S', 'M', 'XXL'] if args.quick else SIZES)

    rows = []
    for label, profile in profiles:
        for size in sizes:
            result = run_case(person_b64, args.product, size, profile, label)
            rows.append(result)
            print(f"[{label:11} {size:3}] ok={str(result['ok']):5} {result['seconds']:6}s "
                  f"khuyến nghị={result.get('recommendedSize')} verdict={result.get('verdict')} "
                  f"severity={result.get('severity')} effect={result.get('effectApplied')}", flush=True)

    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / 'results.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')

    # Kiểm tra cốt lõi: đổi size PHẢI đổi kết quả.
    print('\n=== Kiểm tra size có tạo khác biệt không ===')
    by_case = {}
    for row in rows:
        by_case.setdefault(row['case'], []).append(row)
    for case, items in by_case.items():
        verdicts = {i.get('verdict') for i in items if i.get('ok')}
        severities = [i.get('severity') for i in items if i.get('ok') and i.get('severity') is not None]
        spread = round(max(severities) - min(severities), 2) if len(severities) > 1 else 0
        status = 'ĐẠT' if len(verdicts) > 1 else 'NGỜ'
        print(f'  {case:11} verdicts={sorted(v for v in verdicts if v)} '
              f'biên độ severity={spread} -> {status}')
    print(f'\n-> {RESULTS / "results.json"}')


if __name__ == '__main__':
    main()
