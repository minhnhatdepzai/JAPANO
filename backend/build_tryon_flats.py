"""Tạo ảnh reference sạch (*_tryon-flat.png) cho catalog JAPANO.

Hầu hết ảnh sản phẩm là ảnh lookbook (người mẫu + phụ kiện + nền), không phải
ảnh phẳng cô lập trang phục. FASHN VTON 1.5 nhận ảnh gốc này làm "cloth" thì
hiểu nhầm da/tóc/phụ kiện/nền thành một phần trang phục -> mặc sai, đặc biệt
với áo len/cardigan (ảnh cắt gần, có dây túi) và kimono/yukata (người cầm quạt,
hậu cảnh nhà gỗ). Kimono-hong là sản phẩm DUY NHẤT có sẵn ảnh ghost-mannequin
tốt; script này dùng chính bộ tách trang phục SCHP đã có trong CatVTON (proven,
đang chạy trong catvton_service.py) để tự tách trang phục khỏi người mẫu cho
toàn bộ sản phẩm còn lại, chọn trong 4 ảnh mỗi sản phẩm ảnh cho vùng trang phục
lớn nhất (đủ ống tay/gấu áo nhất) làm reference.

Chạy 1 lần (batch, không phải service sống):
  ~/jp/ai/CatVTON/.venv/bin/python backend/build_tryon_flats.py [--force] [--approve] [slug...]

Mặc định script chỉ tạo *_tryon-candidate.png để người vận hành xem lại. Chỉ
dùng --approve sau khi đã kiểm tra ảnh không còn mặt, da, tay/chân, phụ kiện hay
nền; backend cũng chỉ dùng slug nằm trong JAPANO_APPROVED_TRYON_FLATS.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BACKEND_DIR.parent / 'mobile' / 'assets' / 'products'
SKIP_CATEGORIES = {'phu-kien'}


def cloth_type_for(name, cat):
    # Phải khớp 100% với clothTypeFor() trong backend/server.js.
    text = f'{name} {cat}'.lower()
    if re.search(r'(quần|quan|chân váy|chan vay|lower)', text):
        return 'lower'
    if re.search(r'(kimono|yukata|đầm|dam|dress|cosplay|outfit|overall|đồng phục|dong phuc|uniform|bộ đồ|bo do)', text):
        return 'overall'
    return 'upper'


def load_products():
    script = (
        "const {PRODUCT_BASE}=require('./seed');"
        "console.log(JSON.stringify(PRODUCT_BASE.map(p=>({slug:p[0],name:p[1],cat:p[2]}))));"
    )
    raw = subprocess.check_output(['node', '-e', script], cwd=BACKEND_DIR)
    return json.loads(raw)


MAX_COVERAGE_RATIO = 0.80  # mask phủ gần hết khung 768x1024 = SCHP lỗi, lấy luôn nền/prop chứ không phải trang phục


def region_score(output_path, source_path, canvas_area):
    if Path(output_path) == Path(source_path):
        return 0
    with Image.open(output_path) as image:
        area = image.width * image.height
    if area > canvas_area * MAX_COVERAGE_RATIO:
        return 0
    return area


def main():
    argv = sys.argv[1:]
    force = '--force' in argv
    approve = '--approve' in argv
    only = {value for value in argv if not value.startswith('--')}

    products = [p for p in load_products() if p['cat'] not in SKIP_CATEGORIES]
    if only:
        products = [p for p in products if p['slug'] in only]

    import catvton_service as svc  # nặng: load toàn bộ pipeline CatVTON + SCHP một lần cho cả batch

    target_size = (int(svc.catvton_app.args.width), int(svc.catvton_app.args.height))
    canvas_area = target_size[0] * target_size[1]
    ok, skipped, failed = [], [], []
    for product in products:
        slug = product['slug']
        suffix = 'tryon-flat' if approve else 'tryon-candidate'
        flat_path = ASSETS_DIR / f'{slug}_{suffix}.png'
        if flat_path.exists() and not force:
            print(f'· {slug}: đã có _{suffix}, bỏ qua (dùng --force để tạo lại)')
            skipped.append(slug)
            continue
        candidates = sorted(ASSETS_DIR.glob(f'{slug}_[0-9]*.jpg'))
        if not candidates:
            print(f'✗ {slug}: không có ảnh nguồn')
            failed.append(slug)
            continue
        cloth_type = cloth_type_for(product['name'], product['cat'])
        best_path, best_score = None, 0
        for candidate in candidates:
            try:
                prepared = svc.prepare_catalog_cloth(candidate, cloth_type, target_size)
            except Exception as exc:
                print(f'  {candidate.name}: lỗi trích xuất ({exc})')
                continue
            score = region_score(prepared, candidate, canvas_area)
            print(f'  {candidate.name}: vùng trang phục={score}px² (cloth_type={cloth_type})')
            if score > best_score:
                best_path, best_score = prepared, score
        if best_path is None:
            print(f'✗ {slug}: không tách được trang phục rõ ràng từ {len(candidates)} ảnh')
            failed.append(slug)
            continue
        Image.open(best_path).convert('RGB').save(flat_path)
        print(f'✓ {slug}: lưu {flat_path.name} (nguồn {Path(best_path).name.split("_")[0]}, {best_score}px²)')
        ok.append(slug)

    print(f'\nXong: {len(ok)} tạo mới, {len(skipped)} đã có sẵn, {len(failed)} thất bại.')
    if not approve and ok:
        print('Các file mới chỉ là candidate. Hãy xem thủ công trước khi chạy lại với --approve và thêm slug vào JAPANO_APPROVED_TRYON_FLATS.')
    if failed:
        print('Thất bại:', ', '.join(failed))


if __name__ == '__main__':
    main()
