#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== JAPANO V54 FRONTEND: REVIEW + SIZE/COLOR CHO MUA HÀNG & THỬ ĐỒ ==="

if [ ! -d app ]; then
  echo "[ERR] Không thấy thư mục app/. Hãy chạy trong /home/rd/Downloads/v37"
  exit 1
fi

mkdir -p app lib japano_v54

echo "[1/6] Patch backend review/admin routes nếu chưa có..."
python3 - <<'PY'
from pathlib import Path
import time
server = Path('server/index.mjs')
block = Path('japano_v54/server_routes_v53_reviews_orders_block.mjs')
if not server.exists():
    print('[WARN] Không thấy server/index.mjs, bỏ qua backend review routes.')
    raise SystemExit(0)
if not block.exists():
    print('[WARN] Thiếu backend block, bỏ qua.')
    raise SystemExit(0)
text = server.read_text(encoding='utf-8', errors='ignore')
if 'JAPANO V53 PRODUCT REVIEWS + ORDER QUICK ACTIONS START' not in text:
    bak = server.with_suffix('.mjs.bak-v54-%d' % int(time.time()))
    bak.write_text(text, encoding='utf-8')
    b = block.read_text(encoding='utf-8')
    needle = 'function getLanApiUrls()'
    if needle in text:
        text = text.replace(needle, b + '\n\n' + needle, 1)
    else:
        text += '\n\n' + b
    server.write_text(text, encoding='utf-8')
    print('[OK] Đã thêm backend review/admin routes. Backup:', bak)
else:
    print('[OK] Backend đã có V53 review/admin routes.')
PY

echo "[2/6] Patch lib/api.ts methods nếu có file..."
python3 - <<'PY'
from pathlib import Path
import time
p = Path('lib/api.ts')
if not p.exists():
    print('[WARN] Không thấy lib/api.ts, bỏ qua.')
    raise SystemExit(0)
s = p.read_text(encoding='utf-8', errors='ignore')
changed = False
if 'updateAdminOrderStatus' not in s and 'getAdminOrders' in s:
    bak = p.with_suffix('.ts.bak-v54-%d' % int(time.time()))
    bak.write_text(s, encoding='utf-8')
    s = s.replace(
        "  getAdminOrders: (adminId: string) => request(`/api/admin/orders?adminId=${encodeURIComponent(adminId)}`),",
        "  getAdminOrders: (adminId: string) => request(`/api/admin/orders?adminId=${encodeURIComponent(adminId)}`),\n"
        "  updateAdminOrderStatus: (adminId: string, orderId: string, status: string, note = '') => request(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify({ adminId, status, note }) }),\n"
        "  adminQuickOrderSuccess: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/success`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),\n"
        "  adminQuickOrderCancel: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),"
    )
    changed = True
if 'getProductReviews' not in s and "createOrder:" in s:
    marker = "  createOrder: (body: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),"
    if marker in s:
        if not changed:
            bak = p.with_suffix('.ts.bak-v54-%d' % int(time.time()))
            bak.write_text(s, encoding='utf-8')
        s = s.replace(
            marker,
            marker + "\n"
            "  getProductReviews: (productId: string, userId = '') => request(`/api/products/${encodeURIComponent(productId)}/reviews?userId=${encodeURIComponent(userId)}`),\n"
            "  getReviewEligibility: (productId: string, userId: string) => request(`/api/products/${encodeURIComponent(productId)}/review-eligibility?userId=${encodeURIComponent(userId)}`),\n"
            "  createProductReview: (productId: string, body: any) => request(`/api/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: JSON.stringify(body) }),"
        )
        changed = True
if changed:
    p.write_text(s, encoding='utf-8')
    print('[OK] Đã patch lib/api.ts')
else:
    print('[OK] lib/api.ts đã có hoặc không cần patch.')
PY

echo "[3/6] Replace product detail: review + chọn size/màu trước khi mua/thử..."
python3 - <<'PY'
from pathlib import Path
import shutil, time
src = Path('app/product-detail-v49-shopee.tsx')
pack = Path('japano_v54/product-detail-v49-shopee.tsx')
if not pack.exists():
    raise SystemExit('Thiếu japano_v54/product-detail-v49-shopee.tsx')
if src.exists():
    old = src.read_text(encoding='utf-8', errors='ignore')
    if 'JAPANO V54 FRONTEND REVIEW + SIZE COLOR SELECTORS' not in old:
        bak = src.with_suffix('.tsx.bak-v54-%d' % int(time.time()))
        shutil.copy2(src, bak)
        print('[OK] Backup product-detail:', bak)
src.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(pack, src)
print('[OK] Đã cập nhật app/product-detail-v49-shopee.tsx')
PY

echo "[4/6] Replace try-on screen: chọn size/màu trong trang thử đồ..."
python3 - <<'PY'
from pathlib import Path
import shutil, time
src = Path('app/thu-do-ai-v49-shop-flow.tsx')
pack = Path('japano_v54/thu-do-ai-v49-shop-flow.tsx')
if not pack.exists():
    raise SystemExit('Thiếu japano_v54/thu-do-ai-v49-shop-flow.tsx')
if src.exists():
    old = src.read_text(encoding='utf-8', errors='ignore')
    if 'JAPANO V54 TRYON SIZE COLOR SELECTORS' not in old:
        bak = src.with_suffix('.tsx.bak-v54-%d' % int(time.time()))
        shutil.copy2(src, bak)
        print('[OK] Backup try-on screen:', bak)
src.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(pack, src)
print('[OK] Đã cập nhật app/thu-do-ai-v49-shop-flow.tsx')
PY

echo "[5/6] Patch profile: nút đánh giá sau đơn thành công nếu tìm được file..."
python3 - <<'PY'
from pathlib import Path
import re, time
candidates = [Path('app/(tabs)/profile.tsx'), Path('app/profile.tsx'), Path('app/tai-khoan.tsx')]
p = next((x for x in candidates if x.exists()), None)
if not p:
    print('[WARN] Không thấy profile screen, bỏ qua nút review trong lịch sử đơn.')
    raise SystemExit(0)
s = p.read_text(encoding='utf-8', errors='ignore')
changed = False
if 'Đánh giá sản phẩm' not in s and 'router.push' in s:
    bak = p.with_suffix('.tsx.bak-v54-%d' % int(time.time()))
    bak.write_text(s, encoding='utf-8')
    # Cố gắng chèn style trước; UI profile mỗi bản khác nhau nên không ép quá mạnh để tránh hỏng compile.
    if 'reviewOrderBtn:' not in s:
        s = re.sub(r'(\n\}\);\s*)$', '\n  reviewOrderBtn: { alignSelf: "flex-start", marginTop: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ec4899" },\n  reviewOrderBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },\n' + r'\1', s)
        changed = True
    print('[WARN] Không chèn nút profile tự động để tránh hỏng UI cũ. Nút review đã có trong trang chi tiết sản phẩm.')
if changed:
    p.write_text(s, encoding='utf-8')
print('[OK] Profile bỏ qua/đã kiểm tra:', p)
PY

echo "[6/6] Kiểm tra chữ V54 trong file..."
grep -RIn "JAPANO V54\|Đánh giá sản phẩm\|Chọn màu sắc\|Đang chọn: Size" app/product-detail-v49-shopee.tsx app/thu-do-ai-v49-shop-flow.tsx | head -40 || true

echo "=== DONE V54 ==="
echo "Bây giờ restart backend + Expo Android."
