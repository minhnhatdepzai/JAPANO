# -*- coding: utf-8 -*-
"""
Sinh ERD JAPANO bám đúng MongoDB Atlas (db `japano`).

Một file .drawio nhiều trang:
  Trang 1  : Tổng thể 34 collection + 48 quan hệ (rút gọn: chỉ PK/FK)
  Trang 2-7: 6 cụm nghiệp vụ, mỗi bảng hiện ĐẦY ĐỦ trường thật của Mongo.

Nguồn sự thật: schema.json trích từ Atlas (union khoá của mọi document).
"""
import json, html, os, sys
from xml.sax.saxutils import escape

SCHEMA = json.load(open(os.path.join(os.path.dirname(__file__), 'erd_schema.json'), encoding='utf-8'))

# Trường kỹ thuật của bộ seed, không thuộc mô hình nghiệp vụ -> ẩn khỏi ERD.
HIDDEN = {'demoBatch', '_id'}   # _id trùng id ở 32/34 collection; chỉ hiện khi nó LÀ khoá chính

# ---------------------------------------------------------------- nhãn tiếng Việt
G = {
 # chung
 'id':'Mã định danh','_id':'Khoá chính MongoDB','userId':'Mã người dùng','productId':'Mã sản phẩm',
 'orderId':'Mã đơn hàng','createdAt':'Thời điểm tạo','updatedAt':'Thời điểm cập nhật','status':'Trạng thái',
 'code':'Mã tra cứu','active':'Đang bật','position':'Thứ tự hiển thị','order':'Thứ tự hiển thị',
 'type':'Loại','value':'Giá trị','name':'Tên','title':'Tiêu đề','source':'Nguồn ghi nhận','media':'Tệp đính kèm',
 'rating':'Điểm đánh giá','comment':'Nội dung bình luận','moderation':'Kết quả kiểm duyệt','userName':'Tên hiển thị',
 # categories / products
 'kanji':'Tên tiếng Nhật (Kanji)','slug':'Đường dẫn thân thiện','sku':'Mã hàng SKU','brand':'Thương hiệu',
 'price':'Giá bán','categoryId':'Mã danh mục','compareAtPrice':'Giá gạch ngang',
 'description':'Mô tả sản phẩm','story':'Câu chuyện sản phẩm','colorHex':'Mã màu Hex','tags':'Thẻ từ khoá',
 'visualTags':'Thẻ nhận diện hình ảnh','sold':'Số lượng đã bán',
 'colorName':'Tên màu','size':'Kích cỡ','stock':'Tồn kho',
 'url':'Đường dẫn tệp','isPrimary':'Ảnh đại diện',
 'generatedAt':'Thời điểm AI sinh',
 # users
 'email':'Địa chỉ email','role':'Vai trò','tryons':'Số lượt thử đồ','joinedAt':'Ngày tham gia',
 'passwordHash':'Mật khẩu đã băm','stripeCustomerId':'Mã khách trên Stripe','resetCodeHash':'Mã đặt lại đã băm',
 'resetCodeExpiresAt':'Hạn mã đặt lại','googleId':'Mã Google','authProviders':'Phương thức đăng nhập',
 'avatar':'Ảnh đại diện','resetCodeAttempts':'Số lần nhập mã sai',
 'gender':'Giới tính','preferredStyles':'Phong cách ưa thích','skinTone':'Tông da','occasion':'Dịp mặc',
 'budget':'Ngân sách','heightCm':'Chiều cao (cm)','weightKg':'Cân nặng (kg)','usualSize':'Size thường mặc',
 'phone':'Số điện thoại','street':'Số nhà, tên đường','wardCode':'Mã phường/xã','ward':'Phường/xã',
 'provinceCode':'Mã tỉnh/thành','province':'Tỉnh/thành','isDefault':'Địa chỉ mặc định',
 'token':'Mã thiết bị nhận thông báo','platform':'Nền tảng thiết bị',
 # cart / wishlist
 'color':'Màu đã chọn','quantity':'Số lượng',
 # orders
 'customer':'Thông tin người nhận','address':'Địa chỉ giao (dạng chữ)','addressDetails':'Địa chỉ giao (chi tiết)',
 'total':'Tổng phải trả','ship':'Phí vận chuyển','subtotal':'Tạm tính','discount':'Tổng giảm giá',
 'history':'Nhật ký trạng thái (nhúng)','voucherId':'Mã phiếu giảm giá','discountCode':'Mã giảm áp dụng',
 'flagcardAward':'Thẻ địa danh được thưởng','voucherDiscount':'Giảm từ phiếu','paymentDiscount':'Giảm theo hình thức trả',
 'paymentPromotion':'Ưu đãi theo cổng trả','clientRequestId':'Khoá chống đặt trùng','vipDiscount':'Giảm cho khách VIP',
 'vipPromotion':'Ưu đãi VIP áp dụng','returnStatus':'Trạng thái trả hàng','completedAt':'Thời điểm hoàn tất',
 'deliveredAt':'Thời điểm giao xong','autoCompleted':'Tự động hoàn tất','stockRestoredAt':'Thời điểm hoàn kho',
 'stockRestoredReason':'Lý do hoàn kho',
 'qty':'Số lượng đặt','productSlug':'Đường dẫn sản phẩm','productName':'Tên sản phẩm lúc mua',
 # payments
 'orderCode':'Mã đơn hàng (bản in)','provider':'Cổng thanh toán','method':'Hình thức thanh toán',
 'amount':'Số tiền','currency':'Đơn vị tiền','transactionCode':'Mã giao dịch','paymentIntentId':'Mã Payment Intent (Stripe)',
 'checkoutSessionId':'Mã phiên thanh toán','refundable':'Cho phép hoàn tiền','refunds':'Danh sách lần hoàn (nhúng)',
 'originalAmount':'Số tiền gốc','promotionCode':'Mã ưu đãi','amountSubtotal':'Tạm tính trước giảm',
 'paidAt':'Thời điểm trả tiền','chargeId':'Mã Charge (Stripe)','receiptUrl':'Đường dẫn biên lai',
 'paymentMethodType':'Loại phương tiện trả','card':'Thông tin thẻ đã lưu','refundedAmount':'Đã hoàn',
 'pendingRefundAmount':'Đang chờ hoàn','refundId':'Mã lệnh hoàn','refundedAt':'Thời điểm hoàn',
 'failureReason':'Lý do thất bại','intentStatus':'Trạng thái Payment Intent','nativeAttempt':'Số lần thử trên app',
 'vnpCreateDate':'VNPay — ngày tạo','vnpTransactionNo':'VNPay — số giao dịch','vnpBankCode':'VNPay — mã ngân hàng',
 'vnpCardType':'VNPay — loại thẻ','vnpPayDate':'VNPay — ngày thanh toán',
 # returns
 'paymentId':'Mã thanh toán','paymentCode':'Mã thanh toán (bản in)','reason':'Lý do','note':'Ghi chú của khách',
 'items':'Món trả (nhúng)','timeline':'Nhật ký xử lý (nhúng)','adminNote':'Ghi chú của quản trị',
 'refundStatus':'Trạng thái hoàn tiền','kind':'Loại yêu cầu (huỷ / trả)','photos':'Ảnh minh chứng',
 'codManualRefund':'Hoàn tiền COD thủ công','coversWholeOrder':'Trả toàn bộ đơn','refundBreakdown':'Chi tiết số tiền hoàn',
 'shipBackDeadline':'Hạn gửi trả hàng',
 # vouchers / vip
 'min':'Giá trị đơn tối thiểu','expiry':'Ngày hết hạn','limit':'Giới hạn lượt dùng','used':'Đã dùng',
 'appliesTo':'Phạm vi áp dụng','ownerUserId':'Chủ sở hữu phiếu','issuedBy':'Người cấp phiếu','issuedAt':'Thời điểm cấp',
 'redeemedAt':'Thời điểm sử dụng','scope':'Phạm vi','maxUnitsPerOrder':'Số món tối đa mỗi đơn',
 'qualificationType':'Điều kiện xét duyệt','qualificationValue':'Ngưỡng xét duyệt','validityDays':'Số ngày hiệu lực',
 'discountRuleId':'Mã quy tắc giảm giá','qualifyingPeriod':'Kỳ xét duyệt','qualifyingOrderIds':'Đơn hàng đủ điều kiện',
 'qualifiedSpend':'Tổng chi tiêu đạt chuẩn','startedAt':'Bắt đầu hiệu lực','expiresAt':'Hết hiệu lực',
 # reviews
 'reviewId':'Mã đánh giá','moderatedAt':'Thời điểm duyệt','label':'Nhãn học được',
 'normalizedText':'Văn bản đã chuẩn hoá','learnedPhrases':'Cụm từ đã học',
 'place':'Địa danh','prefecture':'Tỉnh (Nhật Bản)','suggestion':'Nội dung đề xuất','reward':'Phần thưởng',
 # behaviour / ai
 'metadata':'Dữ liệu kèm theo','query':'Từ khoá tìm kiếm','resultCount':'Số kết quả trả về',
 'message':'Nội dung tin nhắn','productIds':'Sản phẩm được nhắc tới','engine':'Mô hình xử lý',
 'intent':'Ý định nhận diện','confidence':'Độ tin cậy','modelTrace':'Vết suy luận của mô hình',
 'generationModel':'Mô hình sinh câu trả lời','latencyMs':'Độ trễ (ms)','fallbackReason':'Lý do dùng phương án dự phòng',
 'product':'Ảnh chụp sản phẩm lúc đặt mục tiêu','input':'Thông số người dùng nhập','plan':'Kế hoạch tiết kiệm',
 'fund':'Quỹ đã tích luỹ',
 # flagcards / ops
 'glyph':'Biểu tượng','accent':'Màu nhấn','japanese':'Tên tiếng Nhật','region':'Vùng',
 'summary':'Tóm tắt','formationHistory':'Lịch sử hình thành','legend':'Truyền thuyết','funFacts':'Điều thú vị',
 'checkins':'Lượt điểm danh','outfit':'Trang phục gợi ý','recommendedProductIds':'Sản phẩm gợi ý',
 'sourceUrl':'Nguồn tham khảo','cardIds':'Thẻ đã sưu tầm','awards':'Phần thưởng đã nhận',
 'body':'Nội dung thông báo','action':'Hành động khi bấm','reach':'Số người nhận','at':'Thời điểm gửi',
 'img':'Đường dẫn ảnh','link':'Liên kết đích',
 'mongo':'Bật MongoDB','cloudinary':'Bật Cloudinary','ai':'Bật dịch vụ AI','hotline':'Tổng đài',
 'shipFee':'Phí giao mặc định','cod':'Bật trả khi nhận','stripe':'Bật Stripe','vnpay':'Bật VNPay','logo':'Ảnh thương hiệu',
 'qualifyingOrderMin':'Giá trị đơn để nhận thẻ','requiredCards':'Số thẻ cần đủ','rewardPercent':'Phần trăm thưởng',
 'rewardVoucherMinOrder':'Đơn tối thiểu dùng phiếu thưởng','rewardValidityDays':'Số ngày hiệu lực phiếu thưởng',
}

VN = {
 'categories':'Danh Mục Sản Phẩm','products':'Sản Phẩm','product_details':'Chi Tiết Sản Phẩm',
 'product_variants':'Biến Thể Sản Phẩm','product_media':'Hình Ảnh Sản Phẩm','ai_descriptions':'Mô Tả Sinh Bởi AI',
 'users':'Người Dùng','profiles':'Hồ Sơ Vóc Dáng','addresses':'Địa Chỉ Giao Hàng','push_tokens':'Thiết Bị Nhận Thông Báo',
 'cart_items':'Chi Tiết Giỏ Hàng','wishlist_items':'Sản Phẩm Yêu Thích',
 'orders':'Đơn Hàng','order_items':'Chi Tiết Đơn Hàng','payments':'Thanh Toán','return_requests':'Yêu Cầu Trả Hàng',
 'vouchers':'Phiếu Giảm Giá','voucher_redemptions':'Lượt Sử Dụng Phiếu','discount_rules':'Quy Tắc Giảm Giá',
 'vip_memberships':'Thành Viên VIP','flagcards':'Thẻ Địa Danh','flagcard_collections':'Bộ Sưu Tầm Thẻ',
 'reviews':'Đánh Giá Sản Phẩm','review_reactions':'Tương Tác Đánh Giá','moderation_samples':'Mẫu Kiểm Duyệt',
 'japan_spot_reviews':'Đánh Giá Địa Điểm Nhật','japan_spot_suggestions':'Đề Xuất Địa Điểm Nhật',
 'interactions':'Tương Tác Người Dùng','search_logs':'Nhật Ký Tìm Kiếm','chats':'Hội Thoại Trợ Lý',
 'goals':'Mục Tiêu Tiết Kiệm','notifications':'Thông Báo','banners':'Quảng Cáo','settings':'Cấu Hình Cửa Hàng',
}

# PK thật sự của từng collection
PK = {c: 'id' for c in VN}
PK['product_details'] = 'productId'   # _id = productId, không có trường id
PK['settings'] = '_id'                # _id = 'shop' | 'integrations' | 'flagcardConfig'

# (bảng, trường) -> (bảng đích, kiểu quan hệ)
#   n1  = nhiều-một   11 = một-một   nm = nhiều-nhiều (mảng nhúng)
#   0   ở cuối = khoá ngoại được phép rỗng
REL = [
 ('products','categoryId','categories','n1',0),
 ('product_details','productId','products','11',0),
 ('product_variants','productId','products','n1',0),
 ('product_media','productId','products','n1',0),
 ('ai_descriptions','productId','products','11',0),
 ('profiles','userId','users','11',0),
 ('addresses','userId','users','n1',0),
 ('push_tokens','userId','users','n1',0),
 ('cart_items','userId','users','n1',0),
 ('cart_items','productId','products','n1',0),
 ('wishlist_items','userId','users','n1',0),
 ('wishlist_items','productId','products','n1',0),
 ('orders','userId','users','n1',0),
 ('orders','voucherId','vouchers','n1',1),
 ('order_items','orderId','orders','n1',0),
 ('order_items','productId','products','n1',0),
 ('payments','orderId','orders','11',0),
 ('payments','userId','users','n1',0),
 ('return_requests','orderId','orders','n1',0),
 ('return_requests','userId','users','n1',0),
 ('return_requests','paymentId','payments','n1',1),
 ('reviews','productId','products','n1',0),
 ('reviews','userId','users','n1',0),
 ('reviews','orderId','orders','n1',0),
 ('review_reactions','reviewId','reviews','n1',0),
 ('review_reactions','userId','users','n1',0),
 ('moderation_samples','reviewId','reviews','n1',1),
 ('japan_spot_reviews','userId','users','n1',0),
 ('japan_spot_suggestions','userId','users','n1',0),
 ('interactions','userId','users','n1',1),
 ('interactions','productId','products','n1',0),
 ('search_logs','userId','users','n1',0),
 ('chats','userId','users','n1',1),
 ('chats','productIds','products','nm',1),
 ('goals','userId','users','n1',0),
 ('goals','productId','products','n1',0),
 ('voucher_redemptions','voucherId','vouchers','n1',0),
 ('voucher_redemptions','userId','users','n1',0),
 ('voucher_redemptions','orderId','orders','11',0),
 ('vouchers','ownerUserId','users','n1',1),
 ('vouchers','issuedBy','users','n1',1),
 ('vip_memberships','userId','users','n1',0),
 ('vip_memberships','discountRuleId','discount_rules','n1',0),
 ('vip_memberships','qualifyingOrderIds','orders','nm',0),
 ('flagcard_collections','userId','users','11',0),
 ('flagcard_collections','cardIds','flagcards','nm',0),
 ('flagcards','recommendedProductIds','products','nm',0),
 ('notifications','userId','users','n1',1),
]

CLUSTERS = [
 ('Cụm 1 — Danh mục sản phẩm & nội dung',
  ['categories','products','product_details','product_variants','product_media','ai_descriptions'], []),
 ('Cụm 2 — Người dùng & giỏ hàng',
  ['users','profiles','addresses','push_tokens','cart_items','wishlist_items'], ['products']),
 ('Cụm 3 — Đơn hàng · Thanh toán · Trả hàng',
  ['orders','order_items','payments','return_requests'], ['users','products','vouchers']),
 ('Cụm 4 — Khuyến mãi · Khách VIP · Thẻ địa danh',
  ['vouchers','voucher_redemptions','discount_rules','vip_memberships','flagcards','flagcard_collections'],
  ['users','orders','products']),
 ('Cụm 5 — Đánh giá & Kiểm duyệt',
  ['reviews','review_reactions','moderation_samples','japan_spot_reviews','japan_spot_suggestions'],
  ['users','products','orders']),
 ('Cụm 6 — Hành vi · AI gợi ý · Vận hành',
  ['interactions','search_logs','chats','goals','notifications','banners','settings'], ['users','products']),
]

# ------------------------------------------------------------------ khung vẽ
W_FULL, KEYW_FULL, ROWH_FULL, HDR_FULL = 560, 104, 34, 48
W_MINI, KEYW_MINI, ROWH_MINI, HDR_MINI = 400,  84, 28, 40

def fk_map(table):
    """{trường: 'FKn'} theo đúng thứ tự xuất hiện."""
    out, n = {}, 0
    for (c, f, _t, _k, _n) in REL:
        if c == table:
            n += 1
            out[f] = f'FK{n}'
    return out

def ordered_fields(table, compact=False):
    pk, fks = PK[table], fk_map(table)
    keys = [k for k in SCHEMA[table]['keys'] if k not in HIDDEN or k == pk]
    if pk not in keys:
        keys = [pk] + keys
    head = [pk] + [k for k in keys if k in fks and k != pk]
    if compact:
        return head
    return head + [k for k in keys if k not in head]

def badge(table, field):
    pk, fks = PK[table], fk_map(table)
    if field == pk and field in fks: return 'PK, ' + fks[field]
    if field == pk: return 'PK'
    return fks.get(field, '')

def gloss(f):
    return G.get(f, '')

def label(table, field):
    g = gloss(field)
    return f'{field} — {g}' if g else field

def esc(s):
    return escape(str(s), {'"': '&quot;'})


def esc_ml(s):
    """Như esc() nhưng giữ xuống dòng (ô text của draw.io dùng html=1)."""
    return esc(s).replace('\n', '&lt;br&gt;')

# ------------------------------------------------------------------ sinh XML
def table_cells(table, x, y, fields, mini, note=''):
    W  = W_MINI if mini else W_FULL
    KW = KEYW_MINI if mini else KEYW_FULL
    RH = ROWH_MINI if mini else ROWH_FULL
    HH = HDR_MINI if mini else HDR_FULL
    fs_hdr, fs_key, fs_val = (15, 11, 12) if mini else (19, 14, 15)
    h = HH + RH * len(fields)
    tid = f't_{table}'
    head = f'{VN[table]} [{table}]'
    if note: head += f'  ·  {note}'
    out = [
      f'<mxCell id="{tid}" value="{esc(head)}" style="shape=table;startSize={HH};container=1;collapsible=0;'
      f'childLayout=tableLayout;fixedRows=1;rowLines=1;fontStyle=1;align=left;spacingLeft=10;resizeLast=1;html=1;'
      f'strokeColor=#000000;fillColor=#FFFFFF;fontColor=#111111;strokeWidth=1.6;swimlaneFillColor=#E8E8E8;'
      f'fontSize={fs_hdr};verticalAlign=middle;" vertex="1" parent="1">'
      f'<mxGeometry x="{x}" y="{y}" width="{W}" height="{h}" as="geometry"/></mxCell>'
    ]
    for i, f in enumerate(fields):
        rid = f'{tid}_r_{f}'
        b = badge(table, f)
        bold = ';fontStyle=1' if b else ''
        under = ';fontStyle=5' if b.startswith('PK') else bold
        out.append(
          f'<mxCell id="{rid}" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;'
          f'fillColor=#FFFFFF;collapsible=0;dropTarget=0;top=0;left=0;right=0;bottom=1;strokeColor=#000000;'
          f'strokeWidth=1.1;" vertex="1" parent="{tid}">'
          f'<mxGeometry y="{HH + i*RH}" width="{W}" height="{RH}" as="geometry"/></mxCell>')
        out.append(
          f'<mxCell id="{rid}_k" value="{esc(b)}" style="shape=partialRectangle;connectable=0;fillColor=#F4F4F4;'
          f'top=0;left=0;bottom=0;right=1;align=left;verticalAlign=middle;spacingLeft=8;fontStyle=1;'
          f'fontSize={fs_key};overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;strokeWidth=1.1;" '
          f'vertex="1" parent="{rid}"><mxGeometry width="{KW}" height="{RH}" as="geometry">'
          f'<mxRectangle width="{KW}" height="{RH}" as="alternateBounds"/></mxGeometry></mxCell>')
        out.append(
          f'<mxCell id="{rid}_v" value="{esc(label(table, f))}" style="shape=partialRectangle;connectable=0;'
          f'fillColor=#FFFFFF;top=0;left=0;bottom=0;right=0;align=left;verticalAlign=middle;spacingLeft=8'
          f'{under};fontSize={fs_val};overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;strokeWidth=1.1;" '
          f'vertex="1" parent="{rid}"><mxGeometry x="{KW}" width="{W-KW}" height="{RH}" as="geometry">'
          f'<mxRectangle width="{W-KW}" height="{RH}" as="alternateBounds"/></mxGeometry></mxCell>')
    return out, h

ARROW = {
 'n1': ('ERzeroToMany', 'ERmandOne'),
 '11': ('ERzeroToOne',  'ERmandOne'),
 'nm': ('ERzeroToMany', 'ERzeroToMany'),
}

def edge_cell(eid, src, dst, kind, nullable, sx, sy, ex, ey):
    a, b = ARROW[kind]
    if nullable:
        b = 'ERzeroToOne' if kind != 'nm' else b
    return (f'<mxCell id="{eid}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;'
            f'jettySize=14;html=1;exitPerimeter=0;entryPerimeter=0;strokeColor=#000000;strokeWidth=1.8;'
            f'startArrow={a};startFill=0;endArrow={b};endFill=0;'
            f'exitX={sx};exitY={sy};entryX={ex};entryY={ey};" edge="1" parent="1" '
            f'source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>')

def anchors(ax, aw, bx, bw):
    """Chọn cạnh thoát/vào theo vị trí ngang tương đối của hai bảng."""
    if ax + aw <= bx:       return (1, 0.5, 0, 0.5)
    if bx + bw <= ax:       return (0, 0.5, 1, 0.5)
    return (0.5, 1, 0.5, 0)

def measure(table, mini):
    flds = ordered_fields(table, compact=mini)
    HH = HDR_MINI if mini else HDR_FULL
    RH = ROWH_MINI if mini else ROWH_FULL
    W  = W_MINI if mini else W_FULL
    return flds, W, HH + RH * len(flds)


def build_page(pid, natives, foreigns, title):
    """Bố cục theo cột + định tuyến dây bằng toạ độ tường minh.

    Mỗi bảng được gán một cột. Dây KHÔNG bao giờ đi xuyên thân bảng: mọi đoạn
    dọc đều chạy trong khe giữa hai cột (mỗi dây một làn riêng), mọi đoạn ngang
    vượt nhiều cột đều vòng xuống lề dưới.
    """
    present = set(natives) | set(foreigns)
    fields = {t_: ordered_fields(t_, compact=(t_ in foreigns)) for t_ in present}
    rels = [r for r in REL if r[0] in present and r[2] in present and r[1] in fields[r[0]]]

    indeg = {}
    for (s_, f_, d_, k_, n_) in rels:
        indeg[d_] = indeg.get(d_, 0) + 1
    hubs = [t_ for t_ in (natives + foreigns) if indeg.get(t_, 0) >= 2]
    sats = [t_ for t_ in (natives + foreigns) if t_ not in hubs]

    size = {}
    for t_ in present:
        mini = t_ in foreigns
        HH = HDR_MINI if mini else HDR_FULL
        RH = ROWH_MINI if mini else ROWH_FULL
        W = W_MINI if mini else W_FULL
        size[t_] = (W, HH, RH, HH + RH * len(fields[t_]))

    # cân hai bên: vệ tinh chia đều theo chiều cao
    left, right, hl, hr = [], [], 0, 0
    for t_ in sorted(sats, key=lambda x: -size[x][3]):
        if hl <= hr: left.append(t_); hl += size[t_][3] + 90
        else:        right.append(t_); hr += size[t_][3] + 90
    seq = {t_: i for i, t_ in enumerate(natives + foreigns)}
    left.sort(key=lambda x: seq[x]); right.sort(key=lambda x: seq[x])

    # cột: [trái] [từng hub một cột] [phải]
    columns = ([left] if left else []) + [[h] for h in hubs] + ([right] if right else [])
    GAP, X0, TOP = 250, 240, 170
    colx, x = [], X0
    for col in columns:
        w = max(size[t_][0] for t_ in col)
        colx.append((x, w))
        x += w + GAP
    page_w = x - GAP + X0

    colh = [sum(size[t_][3] + 90 for t_ in col) - 90 for col in columns]
    tallest = max(colh) if colh else 1
    pos, colof = {}, {}
    for ci, col in enumerate(columns):
        cx, cw = colx[ci]
        y = TOP + (tallest - colh[ci]) // 2
        for t_ in col:
            pos[t_] = (cx, y, size[t_][0], size[t_][3])
            colof[t_] = ci
            y += size[t_][3] + 90

    cells = []
    for t_ in (natives + foreigns):
        x_, y_, w_, h_ = pos[t_]
        note = 'bảng trung tâm — xem trang riêng' if t_ in foreigns else ''
        c, _ = table_cells(t_, x_, y_, fields[t_], t_ in foreigns, note)
        cells += c

    def row_y(t_, field):
        _W, HH, RH, _h = size[t_]
        return pos[t_][1] + HH + (fields[t_].index(field) + 0.5) * RH

    gap_mid = [colx[i][0] + colx[i][1] + GAP / 2 for i in range(len(columns) - 1)]
    lane = {i: 0 for i in range(len(columns))}
    lane[-1] = 0          # lề trái
    bot_lane = 0
    max_lane_y = TOP + tallest
    y_bottom = TOP + tallest + 110

    def take(gi):
        lane[gi] = lane.get(gi, 0) + 1
        base = gap_mid[gi] if 0 <= gi < len(gap_mid) else X0 - 90
        return base + (lane[gi] - 1) * 34 - 60

    n = 0
    for (src, fld, dst, kind, nul) in rels:
        tpk = PK[dst]
        if tpk not in fields[dst]: continue
        n += 1
        ca, cb = colof[src], colof[dst]
        ya, yb = row_y(src, fld), row_y(dst, tpk)
        ax, _, aw, _ = pos[src]; bx, _, bw, _ = pos[dst]
        pts = []
        if ca == cb:                                   # cùng cột -> vòng ra lề bên trái cột
            gx = take(ca - 1)
            sx, sy, ex, ey = 0, 0.5, 0, 0.5
            pts = [(gx, ya), (gx, yb)]
        elif abs(ca - cb) == 1:                        # cột kề -> đi trong khe
            gi = min(ca, cb)
            gx = take(gi)
            if ca < cb: sx, sy, ex, ey = 1, 0.5, 0, 0.5
            else:       sx, sy, ex, ey = 0, 0.5, 1, 0.5
            pts = [(gx, ya), (gx, yb)]
        else:                                          # vượt nhiều cột -> luồn ngay dưới các cột ở giữa
            lo, hi = min(ca, cb), max(ca, cb)
            below = [pos[t2][1] + pos[t2][3] for ci2 in range(lo + 1, hi) for t2 in columns[ci2]]
            bot_lane += 1
            yb2 = (max(below) if below else TOP + tallest) + 60 + (bot_lane - 1) * 34
            max_lane_y = max(max_lane_y, yb2)
            gxa = take(ca if ca < cb else ca - 1)
            gxb = take(cb - 1 if ca < cb else cb)
            if ca < cb: sx, sy, ex, ey = 1, 0.5, 0, 0.5
            else:       sx, sy, ex, ey = 0, 0.5, 1, 0.5
            pts = [(gxa, ya), (gxa, yb2), (gxb, yb2), (gxb, yb)]
        arr = ''.join(f'<mxPoint x="{int(px)}" y="{int(py)}"/>' for px, py in pts)
        geo = f'<mxGeometry relative="1" as="geometry"><Array as="points">{arr}</Array></mxGeometry>'
        a, b = ARROW[kind]
        if nul and kind != 'nm': b = 'ERzeroToOne'
        cells.append(
            f'<mxCell id="{pid}_rel{n:02d}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;'
            f'orthogonalLoop=1;jettySize=16;html=1;exitPerimeter=0;entryPerimeter=0;strokeColor=#000000;'
            f'strokeWidth=1.8;startArrow={a};startFill=0;endArrow={b};endFill=0;'
            f'exitX={sx};exitY={sy};entryX={ex};entryY={ey};" edge="1" parent="1" '
            f'source="t_{src}_r_{fld}" target="t_{dst}_r_{tpk}">{geo}</mxCell>')

    docs = sum(SCHEMA[t_]['count'] for t_ in natives)
    sub = f'MongoDB Atlas · database japano · {len(natives)} collection · {n} quan hệ · {docs} document'
    content_bottom = max([pos[t_][1] + pos[t_][3] for t_ in pos] + [max_lane_y])
    page_h = content_bottom + 250
    head = (f'<mxCell id="{pid}_title" value="{esc(title)}" style="text;html=1;align=left;'
            f'verticalAlign=middle;fontSize=40;fontStyle=1;fontColor=#111111;" vertex="1" parent="1">'
            f'<mxGeometry x="60" y="30" width="2600" height="58" as="geometry"/></mxCell>')
    sb = (f'<mxCell id="{pid}_sub" value="{esc(sub)}" style="text;html=1;align=left;verticalAlign=middle;'
          f'fontSize=22;fontColor=#555555;" vertex="1" parent="1">'
          f'<mxGeometry x="60" y="92" width="2600" height="36" as="geometry"/></mxCell>')
    lg = (f'<mxCell id="{pid}_legend" value="{esc_ml(LEGEND)}" style="text;html=1;align=left;verticalAlign=top;'
          f'fontSize=18;fontColor=#333333;spacing=12;strokeColor=#999999;fillColor=#FAFAFA;'
          f'whiteSpace=wrap;" vertex="1" parent="1">'
          f'<mxGeometry x="60" y="{int(content_bottom + 70)}" width="1180" height="150" as="geometry"/></mxCell>')
    body = '\n        '.join([head, sb, lg] + cells)
    return (f'  <diagram id="{pid}" name="{esc(title.split(" — ")[0])}">\n'
            f'    <mxGraphModel dx="2400" dy="1600" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" '
            f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{int(page_w)}" pageHeight="{int(page_h)}" '
            f'background="#FFFFFF" math="0" shadow="0">\n      <root>\n'
            f'        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n        {body}\n'
            f'      </root>\n    </mxGraphModel>\n  </diagram>\n')


LEGEND = ('CHÚ GIẢI   ·   PK = khoá chính (gạch chân)   ·   FKn = khoá ngoại   ·   '
          'tên trường in đúng khoá thật trong MongoDB\n'
          'Ký hiệu chân quạ:  ─|◄ một-và-chỉ-một   ·   ─o◄ không-hoặc-một   ·   '
          '─o< không-hoặc-nhiều\n'
          'Trường kiểu mảng (vd cardIds, productIds) là quan hệ nhiều-nhiều nhúng ngay trong document, '
          'không có bảng trung gian.')


def build_map_page():
    """Trang 1 — bản đồ cụm.

    Hai cụm trung tâm (Người dùng, Sản phẩm) nằm ở cột giữa vì 25/29 quan hệ
    liên cụm đều trỏ vào chúng; bốn cụm còn lại kèm hai bên. Dây chỉ chạy trong
    khe giữa các cột nên không cắt qua hộp nào.
    """
    # (hàng, cột) cho từng cụm, chỉ số 0..5 = Cụm 1..6
    GRID = {2: (0, 0), 1: (0, 1), 3: (0, 2),
            4: (1, 0), 0: (1, 1), 5: (1, 2)}
    CW, GX, GY, X0, Y0 = 780, 260, 190, 90, 290
    HDR, ROW, FOOT = 66, 32, 52

    heights = {}
    for i, (_n, natives, _f) in enumerate(CLUSTERS):
        heights[i] = HDR + ROW * len(natives) + FOOT
    row_h = {r: max(heights[i] for i, (rr, _c) in GRID.items() if rr == r) for r in (0, 1)}

    box, cells = {}, []
    for i, (name, natives, _f) in enumerate(CLUSTERS):
        r, c = GRID[i]
        x = X0 + c * (CW + GX)
        y = Y0 + (0 if r == 0 else row_h[0] + GY)
        h = heights[i]
        box[i] = (x, y, CW, h)
        docs = sum(SCHEMA[t]['count'] for t in natives)
        hub = i in (0, 1)
        lines = ''.join(
            f'<div style="padding:4px 0"><b>{esc(t)}</b>'
            f'<span style="color:#666"> — {esc(VN[t])} · {SCHEMA[t]["count"]} doc</span></div>'
            for t in natives)
        val = (f'<div style="font-size:26px;font-weight:bold;padding-bottom:12px">{esc(name)}</div>'
               f'<div style="font-size:18px;line-height:1.45">{lines}</div>'
               f'<div style="font-size:16px;color:#666;padding-top:12px">'
               f'{len(natives)} collection · {docs} document'
               f'{" · CỤM TRUNG TÂM" if hub else ""}</div>')
        cells.append(
            f'<mxCell id="cl{i}" value="{esc(val)}" style="rounded=1;arcSize=3;whiteSpace=wrap;html=1;'
            f'align=left;verticalAlign=top;spacing=18;strokeColor=#000000;'
            f'strokeWidth={"3.4" if hub else "2"};fillColor={"#F2F2F2" if hub else "#FFFFFF"};'
            f'fontColor=#111111;" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{CW}" height="{h}" as="geometry"/></mxCell>')

    owner = {}
    for i, (_n, natives, _f) in enumerate(CLUSTERS):
        for t in natives: owner[t] = i
    pair = {}
    for (s_, f_, d_, k_, n_) in REL:
        a, b = owner[s_], owner[d_]
        if a == b: continue
        key = (min(a, b), max(a, b))
        pair[key] = pair.get(key, 0) + 1

    gap_x = {c: X0 + c * (CW + GX) + CW + GX / 2 for c in (0, 1)}   # khe giữa cột c và c+1
    lane = {0: 0, 1: 0}
    j = 0
    for (a, b), cnt in sorted(pair.items(), key=lambda kv: -kv[1]):
        ax, ay, aw, ah = box[a]; bx, by, bw, bh = box[b]
        ra, ca = GRID[a]; rb, cb = GRID[b]
        pts, sx, sy, ex, ey = [], None, None, None, None
        if ra == rb and abs(ca - cb) == 1:                    # cùng hàng, kề cột
            if ca < cb: sx, sy, ex, ey = 1, 0.5, 0, 0.5
            else:       sx, sy, ex, ey = 0, 0.5, 1, 0.5
        elif ca == cb and abs(ra - rb) == 1:                  # cùng cột, kề hàng
            if ra < rb: sx, sy, ex, ey = 0.5, 1, 0.5, 0
            else:       sx, sy, ex, ey = 0.5, 0, 0.5, 1
        elif ra != rb and abs(ca - cb) == 1:                  # chéo -> đi trong khe
            g = min(ca, cb)
            lane[g] += 1
            gx = gap_x[g] + (lane[g] - 1.5) * 44
            if ca < cb: sx, sy = 1, 0.72
            else:       sx, sy = 0, 0.72
            if cb < ca: ex, ey = 1, 0.28
            else:       ex, ey = 0, 0.28
            pts = [(gx, ay + ah * 0.72), (gx, by + bh * 0.28)]
        else:                                                 # cột 0 <-> cột 2: vòng lề trên
            top = Y0 - 110
            sx, sy, ex, ey = 0.5, 0, 0.5, 0
            pts = [(ax + aw / 2, top), (bx + bw / 2, top)]
        geo = '<mxGeometry relative="1" as="geometry"/>'
        if pts:
            arr = ''.join(f'<mxPoint x="{int(px)}" y="{int(py)}"/>' for px, py in pts)
            geo = (f'<mxGeometry relative="1" as="geometry"><Array as="points">{arr}</Array></mxGeometry>')
        cells.append(
            f'<mxCell id="map_e{j:02d}" value="{cnt}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;'
            f'strokeColor=#333333;strokeWidth={min(6.0, 1.6 + cnt * 0.7):.1f};endArrow=none;'
            f'fontSize=21;fontStyle=1;fontColor=#000000;labelBackgroundColor=#FFFFFF;'
            f'exitX={sx};exitY={sy};entryX={ex};entryY={ey};exitPerimeter=0;entryPerimeter=0;jettySize=20;" '
            f'edge="1" parent="1" source="cl{a}" target="cl{b}">{geo}</mxCell>')
        j += 1

    total_docs = sum(v['count'] for v in SCHEMA.values())
    cross = sum(pair.values())
    head = (f'<mxCell id="map_t" value="{esc("ERD JAPANO — Bản đồ 6 cụm nghiệp vụ")}" style="text;html=1;'
            f'align=left;verticalAlign=middle;fontSize=46;fontStyle=1;fontColor=#111111;" vertex="1" parent="1">'
            f'<mxGeometry x="90" y="30" width="2600" height="64" as="geometry"/></mxCell>')
    sb = (f'<mxCell id="map_s" value="{esc(f"MongoDB Atlas · database japano · {len(SCHEMA)} collection · {len(REL)} quan hệ · {total_docs} document")}" '
          f'style="text;html=1;align=left;verticalAlign=middle;fontSize=23;fontColor=#555555;" vertex="1" parent="1">'
          f'<mxGeometry x="90" y="98" width="2800" height="36" as="geometry"/></mxCell>')
    ph_ = Y0 + row_h[0] + GY + row_h[1] + 400
    note = (f'<mxCell id="map_n" value="{esc(f"Số trên mỗi đường = số khoá ngoại nối hai cụm ({cross} quan hệ liên cụm, {len(REL) - cross} quan hệ trong cụm). Độ dày đường tỉ lệ với số đó. Chi tiết từng trường xem các trang cụm phía sau.")}" '
            f'style="text;html=1;align=left;verticalAlign=top;fontSize=19;fontColor=#333333;spacing=10;'
            f'strokeColor=#999999;fillColor=#FAFAFA;whiteSpace=wrap;" vertex="1" parent="1">'
            f'<mxGeometry x="90" y="{ph_ - 340}" width="1480" height="290" as="geometry"/></mxCell>')
    design = (
        'GHI CHÚ THIẾT KẾ (trả lời góp ý)\n\n'
        '1. ERD này ánh xạ 1-1 với MongoDB Atlas: mỗi hộp là một collection có thật, '
        'mỗi dòng là một khoá có thật trong document.\n'
        '2. Màu sắc và kích cỡ KHÔNG phải collection riêng — chúng là trường nhúng '
        '(colorName, colorHex, size) trong product_variants và order_items.\n'
        '3. Quan hệ nhiều-nhiều dùng mảng nhúng (cardIds, productIds, qualifyingOrderIds, '
        'recommendedProductIds), đúng theo mô hình tài liệu, không có bảng trung gian.\n'
        '4. Bảng lịch sử: chỉ giữ những bảng có nơi đọc thật — interactions (nuôi máy gợi ý), '
        'chats (ngữ cảnh trợ lý), search_logs (thống kê từ khoá), moderation_samples '
        '(mẫu huấn luyện kiểm duyệt), voucher_redemptions (chứng từ). '
        'tryon_history đã bị loại bỏ vì trùng hoàn toàn với interactions type=tryon và không có mã nào đọc nó.\n'
        '5. orders.history[] và return_requests.timeline[] là MẢNG NHÚNG trong chính document, '
        'không phải bảng lịch sử riêng.')
    dn = (f'<mxCell id="map_d" value="{esc_ml(design)}" style="text;html=1;align=left;verticalAlign=top;'
          f'fontSize=19;fontColor=#111111;spacing=14;strokeColor=#000000;strokeWidth=2;fillColor=#FFFFFF;'
          f'whiteSpace=wrap;" vertex="1" parent="1">'
          f'<mxGeometry x="1660" y="{ph_ - 340}" width="1290" height="290" as="geometry"/></mxCell>')
    pw = X0 + 3 * CW + 2 * GX + 90
    body = '\n        '.join([head, sb, note, dn] + cells)
    return (f'  <diagram id="p0" name="00 — Bản đồ cụm">\n'
            f'    <mxGraphModel dx="2400" dy="1600" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" '
            f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{pw}" pageHeight="{ph_}" '
            f'background="#FFFFFF" math="0" shadow="0">\n      <root>\n'
            f'        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n        {body}\n'
            f'      </root>\n    </mxGraphModel>\n  </diagram>\n')


def main():
    pages = [build_map_page()]
    for i, (name, natives, foreigns) in enumerate(CLUSTERS, start=1):
        pages.append(build_page(f"p{i}", natives, foreigns, name))
    out = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<mxfile host="app.diagrams.net" agent="JAPANO ERD (MongoDB Atlas)" pages="%d">\n%s</mxfile>\n'
           % (len(pages), ''.join(pages)))
    dest = sys.argv[1] if len(sys.argv) > 1 else 'JAPANO_ERD_MongoDB.drawio'
    open(dest, 'w', encoding='utf-8').write(out)
    n_tab = sum(len(c[1]) for c in CLUSTERS)
    print(f'Đã ghi {dest} — {len(pages)} trang, {n_tab} collection, {len(REL)} quan hệ')


if __name__ == '__main__':
    main()
