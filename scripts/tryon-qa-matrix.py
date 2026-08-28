#!/usr/bin/env python3
"""Ma trận kiểm thử Try-On theo VÓC DÁNG × SIZE, chạy qua API thật.

    python3 scripts/tryon-qa-matrix.py                 # bộ ca chuẩn
    python3 scripts/tryon-qa-matrix.py --all-sizes     # đủ XS..XXL cho mọi dáng

Câu hỏi bộ test này trả lời không phải "API có 200 không" mà là:

    Cùng một người, đổi size, ẢNH có khác đi đúng hướng không?

Mỗi ca lưu ảnh kết quả để soi bằng mắt. Số liệu (verdict, severity, hiệu ứng có
dựng được không) chỉ là điều kiện cần — điều kiện đủ nằm ở ảnh.

Ảnh người lấy từ test-assets, mỗi lớp vóc dáng một ảnh; chiều cao/cân nặng là số
NGƯỜI DÙNG NHẬP vì đó là đường dữ liệu mạnh nhất của bộ suy luận kích cỡ.
"""

import argparse
import base64
import json
import time
from pathlib import Path

import requests

print = __import__('functools').partial(print, flush=True)

ROOT = Path(__file__).resolve().parents[1]
API = 'http://127.0.0.1:4100'
OUT = ROOT / 'test-results' / 'qa-matrix'

# (nhãn, ảnh người, chiều cao, cân nặng)
BODIES = {
    'short_thin': ('very_slim/00566_00.jpg', '150', '42'),
    'tall_thin':  ('slim/00740_00.jpg',      '180', '55'),
    'average':    ('average/00858_00.jpg',   '165', '58'),
    'fuller':     ('fuller/00611_00.jpg',    '162', '74'),
    'plus':       ('plus/00698_00.jpg',      '158', '92'),
}

# Bộ ca chuẩn: lớp tương đương + ca biên, không quét vét cạn.
CASES = [
    ('short_thin', 'S',   'vừa/hơi chật'),
    ('short_thin', 'M',   'rộng'),
    ('short_thin', 'L',   'rất rộng'),
    ('short_thin', 'XL',  'oversized'),
    ('short_thin', 'XXL', 'oversized cực đại'),
    ('tall_thin',  'XS',  'ngắn/chật'),
    ('tall_thin',  'M',   'vừa'),
    ('tall_thin',  'XXL', 'oversized'),
    ('average',    'XS',  'chật'),
    ('average',    'M',   'vừa'),
    ('average',    'XXL', 'oversized'),
    ('fuller',     'S',   'chật'),
    ('fuller',     'XL',  'vừa hơn'),
    ('plus',       'S',   'rất chật'),
    ('plus',       'XXL', 'thoải mái'),
]

LOOSE = {'slightly_loose', 'loose', 'very_loose'}
TIGHT = {'slightly_tight', 'tight', 'very_tight'}


def cham(verdict, mong_doi):
    """Đối chiếu mức fit với kỳ vọng nghiệp vụ của ca test."""
    if not verdict:
        return 'FAIL'
    muon_rong = any(k in mong_doi for k in ('rộng', 'oversized', 'thoải mái'))
    muon_chat = any(k in mong_doi for k in ('chật', 'ngắn'))
    if muon_rong:
        return 'PASS' if verdict in LOOSE else 'WARN'
    if muon_chat:
        return 'PASS' if verdict in TIGHT else 'WARN'
    return 'PASS' if verdict in ({'good'} | TIGHT | LOOSE) else 'WARN'


def chay(body, size, mong_doi, product, timeout=900):
    anh, cao, nang = BODIES[body]
    duong_dan = ROOT / 'test-assets' / 'people' / anh
    data = base64.b64encode(duong_dan.read_bytes()).decode()
    payload = {
        'personImageBase64': 'data:image/jpeg;base64,' + data,
        'productId': product, 'size': size, 'clientId': 'qa-matrix',
        'profile': {'height': cao, 'weight': nang}, 'measurementMode': 'user',
    }
    bat_dau = time.time()
    try:
        res = requests.post(f'{API}/api/tryon', json=payload, timeout=timeout)
        kq = res.json()
    except Exception as exc:
        return {'body': body, 'size': size, 'ok': False, 'error': str(exc)[:120],
                'seconds': round(time.time() - bat_dau, 1), 'grade': 'FAIL'}
    giay = round(time.time() - bat_dau, 1)
    fit = kq.get('sizeFit') or {}
    anh_ra = ''
    hinh = kq.get('imageBase64') or ''
    if hinh.startswith('data:'):
        OUT.mkdir(parents=True, exist_ok=True)
        anh_ra = str(OUT / f'{body}_{size}.png')
        Path(anh_ra).write_bytes(base64.b64decode(hinh.split(',', 1)[1]))
    return {
        'body': body, 'size': size, 'expected': mong_doi, 'ok': bool(kq.get('ok')),
        'seconds': giay, 'recommendedSize': fit.get('recommendedSize'),
        'verdict': fit.get('verdict'), 'severity': fit.get('severity'), 'delta': fit.get('delta'),
        'effectApplied': (kq.get('fitEffect') or {}).get('applied'),
        'image': anh_ra, 'message': str(kq.get('message'))[:100],
        'grade': cham(fit.get('verdict'), mong_doi) if kq.get('ok') else 'FAIL',
    }


def main():
    ap = argparse.ArgumentParser(description='Ma trận QA vóc dáng × size')
    ap.add_argument('--product', default='ao-len-cardigan')
    ap.add_argument('--all-sizes', action='store_true')
    ap.add_argument('--only', default='', help='lọc theo nhãn vóc dáng')
    args = ap.parse_args()

    cases = CASES
    if args.all_sizes:
        cases = [(b, s, '') for b in BODIES for s in ('XS', 'S', 'M', 'L', 'XL', 'XXL')]
    if args.only:
        cases = [c for c in cases if c[0] == args.only]

    rows = []
    for body, size, mong_doi in cases:
        row = chay(body, size, mong_doi, args.product)
        rows.append(row)
        print(f"[{row['grade']:4}] {body:11} {size:3} {row['seconds']:6}s "
              f"khuyến nghị={row.get('recommendedSize')} verdict={row.get('verdict')} "
              f"sev={row.get('severity')} hiệu ứng={row.get('effectApplied')}"
              + (f"  ({mong_doi})" if mong_doi else ''))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'results.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')

    print('\n=== Đổi size có làm đổi kết quả không ===')
    theo_body = {}
    for row in rows:
        theo_body.setdefault(row['body'], []).append(row)
    for body, items in theo_body.items():
        verdicts = sorted({i['verdict'] for i in items if i.get('ok') and i.get('verdict')})
        sev = [i['severity'] for i in items if i.get('ok') and i.get('severity') is not None]
        bien_do = round(max(sev) - min(sev), 2) if len(sev) > 1 else 0
        print(f'  {body:11} verdicts={verdicts} biên độ severity={bien_do}')

    diem = {}
    for row in rows:
        diem[row['grade']] = diem.get(row['grade'], 0) + 1
    print(f"\nTổng: {len(rows)} ca | " + ' | '.join(f'{k}={v}' for k, v in sorted(diem.items())))
    print(f'-> {OUT / "results.json"}')


if __name__ == '__main__':
    main()
