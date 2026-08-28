#!/usr/bin/env python3
"""Điều khiển app trên máy Android bằng NHÃN trên màn hình, không bằng toạ độ.

    python3 scripts/adb-ui.py tap "Tiếp theo"
    python3 scripts/adb-ui.py tap-contains "chỉ xem"
    python3 scripts/adb-ui.py text                 # in mọi nhãn đang hiện
    python3 scripts/adb-ui.py find "0 sản phẩm"    # có nhãn đó không
    python3 scripts/adb-ui.py shot duong/dan.png
    python3 scripts/adb-ui.py wait "Sản phẩm" 30   # chờ nhãn xuất hiện

Toạ độ cố định vỡ ngay khi layout xê dịch một chút, còn nhãn thì gắn với ý
nghĩa của nút. Khi cần bấm nhiều lần trong một phiên test dài, đây là khác biệt
giữa "test chạy được" và "test bấm nhầm vào khoảng trắng".
"""

import re
import subprocess
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET

DUMP = '/sdcard/japano-ui.xml'


def adb(*args, binary=False):
    result = subprocess.run(['adb', *args], capture_output=True)
    return result.stdout if binary else result.stdout.decode('utf-8', 'replace')


def hierarchy(retries=3):
    """uiautomator thỉnh thoảng trả rỗng khi UI đang animate — thử lại vài lần."""
    for attempt in range(retries):
        adb('shell', 'uiautomator', 'dump', DUMP)
        raw = adb('exec-out', 'cat', DUMP, binary=True)
        if raw and b'<hierarchy' in raw:
            try:
                return ET.fromstring(raw.decode('utf-8', 'replace'))
            except ET.ParseError:
                pass
        time.sleep(1 + attempt)
    return None


def nodes(root):
    for node in root.iter('node'):
        yield node


def fold(value):
    """Bỏ dấu và chuẩn hoá để so khớp tiếng Việt không phụ thuộc cách gõ."""
    text = unicodedata.normalize('NFD', str(value or ''))
    return ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower().strip()


def labels(root):
    out = []
    for node in nodes(root):
        for key in ('text', 'content-desc'):
            value = (node.get(key) or '').strip()
            if value:
                out.append(value)
    return out


def centre(node):
    bounds = re.findall(r'-?\d+', node.get('bounds') or '')
    if len(bounds) != 4:
        return None
    x1, y1, x2, y2 = map(int, bounds)
    return (x1 + x2) // 2, (y1 + y2) // 2


def locate(root, needle, contains=False):
    """Tìm điểm bấm cho một nhãn.

    Nhãn thường nằm trên node KHÔNG bấm được (ImageView, TextView) nằm trong
    một node cha bấm được. Bấm vào chính nó có thể không kích hoạt gì — đúng
    lỗi đã gặp với bộ chọn ảnh của Android. Nên khi node khớp không bấm được,
    leo lên tổ tiên gần nhất bấm được rồi lấy tâm của tổ tiên đó.
    """
    parents = {child: parent for parent in root.iter() for child in parent}

    def diem_bam(node):
        current = node
        for _ in range(6):
            if current.get('clickable') == 'true':
                return centre(current)
            current = parents.get(current)
            if current is None:
                break
        return centre(node)

    target = fold(needle)
    best = None
    for node in nodes(root):
        for key in ('text', 'content-desc'):
            value = fold(node.get(key))
            if not value:
                continue
            hit = target in value if contains else value == target
            if hit:
                point = diem_bam(node)
                if not point:
                    continue
                score = (node.get('clickable') == 'true', -len(value))
                if best is None or score > best[0]:
                    best = (score, point)
    return best[1] if best else None


def cuon_tim(needle, lan=10):
    """Cuộn tìm nhãn, thử xuống trước rồi lên.

    Nút nằm ngoài vùng nhìn được uiautomator báo bounds 0,0,0,0 — bấm vào đó là
    bấm vào góc màn hình. Nên phải cuộn cho nó vào khung rồi mới lấy toạ độ, và
    phải thử cả hai chiều vì không biết nó ở trên hay dưới vị trí hiện tại.
    """
    def thu():
        root = hierarchy(retries=1)
        if root is None:
            return None
        point = locate(root, needle, contains=True)
        # (0,0) nghĩa là node ngoài màn hình, không phải điểm bấm hợp lệ.
        return point if point and point != (0, 0) else None

    for chieu, (y1, y2) in (('xuong', (1600, 800)), ('len', (800, 1600))):
        for _ in range(lan // 2 + 1):
            point = thu()
            if point:
                return point
            adb('shell', 'input', 'swipe', '540', str(y1), '540', str(y2), '350')
            time.sleep(1.2)
    return thu()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    command = sys.argv[1]

    if command == 'shot':
        path = sys.argv[2] if len(sys.argv) > 2 else 'screen.png'
        data = adb('exec-out', 'screencap', '-p', binary=True)
        open(path, 'wb').write(data)
        print(f'{path} ({len(data)} byte)')
        return 0

    root = hierarchy()
    if root is None:
        print('KHÔNG đọc được UI hierarchy')
        return 1

    if command == 'text':
        for value in labels(root):
            print(value)
        return 0

    if command == 'scroll-tap':
        needle = sys.argv[2]
        point = cuon_tim(needle)
        if not point:
            print(f'KHÔNG thấy dù đã cuộn: {needle}')
            return 1
        adb('shell', 'input', 'tap', str(point[0]), str(point[1]))
        print(f'đã cuộn tới và bấm "{needle}" tại {point}')
        return 0

    if command in {'tap', 'tap-contains', 'find'}:
        needle = sys.argv[2]
        point = locate(root, needle, contains=command != 'tap')
        if not point:
            print(f'KHÔNG thấy: {needle}')
            return 1
        if command == 'find':
            print(f'thấy: {needle} tại {point}')
            return 0
        adb('shell', 'input', 'tap', str(point[0]), str(point[1]))
        print(f'đã bấm "{needle}" tại {point}')
        return 0

    if command == 'wait':
        needle = sys.argv[2]
        limit = float(sys.argv[3]) if len(sys.argv) > 3 else 30
        deadline = time.time() + limit
        while time.time() < deadline:
            root = hierarchy(retries=1)
            if root is not None and locate(root, needle, contains=True):
                print(f'đã thấy "{needle}" sau {limit - (deadline - time.time()):.0f}s')
                return 0
            time.sleep(2)
        print(f'HẾT GIỜ chờ "{needle}" ({limit:.0f}s)')
        return 1

    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
