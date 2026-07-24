#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== JAPANO V53 PRODUCT REVIEWS + ADMIN ORDER QUICK ACTIONS ==="

echo "[1/5] Patch backend routes..."
python3 - <<'PY'
from pathlib import Path
import time
server = Path('server/index.mjs')
block = Path('japano_v53/server_routes_v53_reviews_orders_block.mjs')
if not server.exists():
    raise SystemExit('Không thấy server/index.mjs. Hãy chạy trong /home/rd/Downloads/v37')
if not block.exists():
    raise SystemExit('Thiếu japano_v53/server_routes_v53_reviews_orders_block.mjs')
text = server.read_text(encoding='utf-8')
if 'JAPANO V53 PRODUCT REVIEWS + ORDER QUICK ACTIONS START' not in text:
    bak = server.with_suffix('.mjs.bak-v53-%d' % int(time.time()))
    bak.write_text(text, encoding='utf-8')
    b = block.read_text(encoding='utf-8')
    needle = 'function getLanApiUrls()'
    if needle in text:
        text = text.replace(needle, b + '\n\n' + needle, 1)
    else:
        text += '\n\n' + b
    server.write_text(text, encoding='utf-8')
    print('[OK] Đã thêm backend V53. Backup:', bak)
else:
    print('[OK] Backend đã có V53.')
PY

echo "[2/5] Patch lib/api.ts..."
python3 - <<'PY'
from pathlib import Path
import time
p = Path('lib/api.ts')
if not p.exists():
    print('[WARN] Không thấy lib/api.ts, bỏ qua.')
    raise SystemExit(0)
s = p.read_text(encoding='utf-8')
if 'updateAdminOrderStatus' not in s:
    bak = p.with_suffix('.ts.bak-v53-%d' % int(time.time()))
    bak.write_text(s, encoding='utf-8')
    s = s.replace(
        "  getAdminOrders: (adminId: string) => request(`/api/admin/orders?adminId=${encodeURIComponent(adminId)}`),",
        "  getAdminOrders: (adminId: string) => request(`/api/admin/orders?adminId=${encodeURIComponent(adminId)}`),\n"
        "  updateAdminOrderStatus: (adminId: string, orderId: string, status: string, note = '') => request(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify({ adminId, status, note }) }),\n"
        "  adminQuickOrderSuccess: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/success`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),\n"
        "  adminQuickOrderCancel: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),"
    )
    marker = "  createOrder: (body: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),"
    if marker in s:
        s = s.replace(
            marker,
            marker + "\n"
            "  getProductReviews: (productId: string, userId = '') => request(`/api/products/${encodeURIComponent(productId)}/reviews?userId=${encodeURIComponent(userId)}`),\n"
            "  getReviewEligibility: (productId: string, userId: string) => request(`/api/products/${encodeURIComponent(productId)}/review-eligibility?userId=${encodeURIComponent(userId)}`),\n"
            "  createProductReview: (productId: string, body: any) => request(`/api/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: JSON.stringify(body) }),"
        )
    p.write_text(s, encoding='utf-8')
    print('[OK] Đã patch lib/api.ts. Backup:', bak)
else:
    print('[OK] lib/api.ts đã có V53 methods.')
PY

echo "[3/5] Replace Shopee product detail with review UI..."
python3 - <<'PYDETAIL'
from pathlib import Path
import shutil, time
src = Path('app/product-detail-v49-shopee.tsx')
pack = Path('japano_v53/product-detail-v49-shopee.tsx')
if not pack.exists():
    raise SystemExit('Thiếu japano_v53/product-detail-v49-shopee.tsx trong gói patch.')
if src.exists():
    old_text = src.read_text(encoding='utf-8', errors='ignore')
    if 'JAPANO V53 PRODUCT REVIEW UI' not in old_text:
        bak = src.with_suffix('.tsx.bak-v53-%d' % int(time.time()))
        shutil.copy2(src, bak)
        print('[OK] Backup product detail:', bak)
src.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(pack, src)
print('[OK] product-detail-v49-shopee.tsx đã có review UI.')
PYDETAIL

echo "[4/5] Patch admin quick buttons..."
python3 - <<'PY'
from pathlib import Path
import re, time
p = Path('app/admin.tsx')
if not p.exists():
    print('[WARN] Không thấy app/admin.tsx, bỏ qua admin UI.')
    raise SystemExit(0)
s = p.read_text(encoding='utf-8')
changed = False
if 'quickUpdateOrder' not in s:
    bak = p.with_suffix('.tsx.bak-v53-%d' % int(time.time()))
    bak.write_text(s, encoding='utf-8')
    helper = '''

  const quickUpdateOrder = async (order: any, nextStatus: "completed" | "cancelled") => {
    if (!user?.id) return;
    const orderId = String(order.id || order._id || "");
    if (!orderId) return Alert.alert("Thiếu mã đơn", "Không tìm thấy ID đơn hàng.");
    try {
      setActionId(`order-${nextStatus}-${orderId}`);
      const res = await api.updateAdminOrderStatus(user.id, orderId, nextStatus);
      Alert.alert(nextStatus === "completed" ? "Đã xác nhận" : "Đã hủy", res?.message || "Đã cập nhật đơn hàng.");
      await load();
    } catch (e: any) {
      Alert.alert("Không cập nhật được đơn", e?.message || "Kiểm tra backend.");
    } finally {
      setActionId(null);
    }
  };
'''
    needle = '''  const refresh = async () => {
    setRefreshing(true);
    await load().catch((e: any) => Alert.alert("Không tải lại được", e?.message || "Có lỗi xảy ra."));
    setRefreshing(false);
  };
'''
    if needle in s:
        s = s.replace(needle, needle + helper, 1)
        changed = True
    else:
        print('[WARN] Không tìm thấy vị trí chèn quickUpdateOrder.')

if 'Xác nhận thành công' not in s:
    old = '''                <Text numberOfLines={1} style={styles.paymentMeta}>User: {order.userId} • {order.paymentMethod || "COD"}</Text>
              </View>
            </View>
'''
    new = '''                <Text numberOfLines={1} style={styles.paymentMeta}>User: {order.userId} • {order.paymentMethod || "COD"}</Text>
                <View style={styles.adminOrderQuickRow}>
                  <Pressable disabled={actionId === `order-completed-${order.id}`} onPress={() => quickUpdateOrder(order, "completed")} style={styles.successBtn}>
                    <Text style={styles.successBtnText}>Xác nhận thành công</Text>
                  </Pressable>
                  <Pressable disabled={actionId === `order-cancelled-${order.id}`} onPress={() => quickUpdateOrder(order, "cancelled")} style={styles.dangerBtn}>
                    <Text style={styles.dangerBtnText}>Hủy nhanh</Text>
                  </Pressable>
                </View>
              </View>
            </View>
'''
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
    else:
        print('[WARN] Không tìm thấy block Recent Orders để chèn nút. Backend vẫn dùng được.')

if 'adminOrderQuickRow' not in s.split('StyleSheet.create',1)[-1]:
    insert = '''
  adminOrderQuickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  successBtn: { backgroundColor: ADMIN_GREEN, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  successBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
'''
    # chèn trước adminThumb nếu có, nếu không thì trước dấu đóng style cuối
    if '  adminThumb:' in s:
        s = s.replace('  adminThumb:', insert + '  adminThumb:', 1)
        changed = True
    else:
        s = re.sub(r'(\n\}\);\s*)$', insert + r'\1', s)
        changed = True

if changed:
    p.write_text(s, encoding='utf-8')
    print('[OK] Đã patch admin.tsx quick buttons.')
else:
    print('[OK] admin.tsx đã có hoặc không cần patch thêm.')
PY

echo "[5/5] Patch profile order item review button..."
python3 - <<'PY'
from pathlib import Path
import re, time
p = Path('app/(tabs)/profile.tsx')
if not p.exists():
    print('[WARN] Không thấy app/(tabs)/profile.tsx, bỏ qua profile UI.')
    raise SystemExit(0)
s = p.read_text(encoding='utf-8')
changed = False
if 'canReviewOrder' not in s:
    bak = p.with_suffix('.tsx.bak-v53-%d' % int(time.time()))
    bak.write_text(s, encoding='utf-8')
    old = '            const items = Array.isArray(order.items) ? order.items : [];\n'
    new = old + '            const canReviewOrder = /paid|completed|delivered|confirmed|success/i.test(`${order.status || ""} ${order.orderStatus || ""} ${order.paymentStatus || ""}`);\n'
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
    else:
        print('[WARN] Không tìm thấy vị trí khai báo items trong profile.')

if 'Đánh giá sản phẩm' not in s:
    old = '''                            {item.selectedSize || item.selectedColor ? (
                              <Text
                                style={[
                                  styles.orderMeta,
                                  { color: theme.muted },
                                ]}
                              >
                                Size: {item.selectedSize || "-"} · Màu:{" "}
                                {item.selectedColor || "-"}
                              </Text>
                            ) : null}
'''
    new = old + '''                            {canReviewOrder ? (
                              <Pressable
                                onPress={(event: any) => {
                                  event?.stopPropagation?.();
                                  const pid = String(item.id || item.productId || "");
                                  router.push({ pathname: "/product-detail-v49-shopee", params: { productId: pid, product: encodeURIComponent(JSON.stringify(item)), review: "1" } } as any);
                                }}
                                style={styles.reviewOrderBtn}
                              >
                                <Text style={styles.reviewOrderBtnText}>Đánh giá sản phẩm</Text>
                              </Pressable>
                            ) : null}
'''
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
    else:
        print('[WARN] Không tìm thấy block item size để chèn nút review trong profile.')

if 'reviewOrderBtn:' not in s:
    insert = '''
  reviewOrderBtn: { alignSelf: "flex-start", marginTop: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ec4899" },
  reviewOrderBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
'''
    s = re.sub(r'(\n\}\);\s*)$', insert + r'\1', s)
    changed = True

if changed:
    p.write_text(s, encoding='utf-8')
    print('[OK] Đã patch profile review button.')
else:
    print('[OK] profile đã có hoặc không cần patch thêm.')
PY

echo "=== DONE V53 ==="
echo "Restart backend và app Android để thấy review/order buttons."
