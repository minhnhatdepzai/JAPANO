#!/usr/bin/env python3
"""Sinh bộ tài liệu bảo vệ ERD JAPANO từ ERD logic và snapshot MongoDB đã audit.

Script chỉ ghi trong docs/erd-defense; không sửa source nghiệp vụ, database hay báo cáo.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "erd-defense"
DIAGRAMS = OUT / "diagrams"
SNAPSHOTS = OUT / "tools" / "snapshots"
EXTERNAL = Path("/home/nhat/japano-erd-defense")
LOCAL_ERD = SNAPSHOTS / "erd.json"
LOCAL_DB = SNAPSHOTS / "db_schema.json"
LOCAL_CATALOG = Path(__file__).with_name("defense_catalog.py")
ERD_PATH = LOCAL_ERD if LOCAL_ERD.exists() else EXTERNAL / "data" / "erd.json"
DB_PATH = LOCAL_DB if LOCAL_DB.exists() else EXTERNAL / "data" / "db_schema.json"

sys.path.insert(0, str(LOCAL_CATALOG.parent if LOCAL_CATALOG.exists() else EXTERNAL))
from defense_catalog import ENTITY_INFO, MAP, RELATION_DETAILS, TIER  # noqa: E402


ERD = json.loads(ERD_PATH.read_text(encoding="utf-8"))
DB = json.loads(DB_PATH.read_text(encoding="utf-8"))
ENTITIES = list(ERD["schema"])
RELATIONS = [tuple(row) for row in ERD["rel"]]
REL_DETAIL = {(child, parent): (fk, card, meaning, deletion)
              for child, parent, fk, card, meaning, deletion in RELATION_DETAILS}
SNAPSHOT_DATE = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M %Z")


MODULES = [
    {
        "id": "ERD-01", "slug": "product-catalog", "name": "Danh mục, sản phẩm và biến thể",
        "purpose": "Giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ.",
        "center": "Sản Phẩm",
        "tables": ["Danh Mục Sản Phẩm", "Sản Phẩm", "Chi Tiết Sản Phẩm", "Biến Thể Sản Phẩm", "Màu Sắc", "Kích Thước"],
        "shared": [],
        "flow": "Quản trị viên tạo danh mục → tạo sản phẩm → bổ sung chi tiết → tạo từng biến thể màu/cỡ → khách đọc catalog và tồn kho.",
        "why": "Đây là bounded context catalog và inventory; biến thể là nơi quy tắc tồn kho khác với mô tả sản phẩm.",
        "png": "01_san_pham_va_bien_the.png",
    },
    {
        "id": "ERD-02", "slug": "media-and-ai-content", "name": "Media và nội dung sản phẩm tạo bởi AI",
        "purpose": "Tách metadata ảnh/video, nội dung AI và content quảng bá khỏi lõi sản phẩm.",
        "center": "Sản Phẩm",
        "tables": ["Sản Phẩm", "Hình Ảnh", "Hình Ảnh Giao Diện Sản Phẩm", "Mô Tả Sản Phẩm Tạo Bởi AI", "Quảng Cáo"],
        "shared": ["Sản Phẩm"],
        "flow": "Admin tải media lên Cloudinary → MongoDB lưu URL/type/vị trí → sinh mô tả AI theo sản phẩm → duyệt nội dung để hiển thị.",
        "why": "Các artifact media/AI có vòng đời và cách kiểm duyệt khác dữ liệu giá, SKU và tồn kho.",
        "png": "02_hinh_anh_va_ai.png",
    },
    {
        "id": "ERD-03", "slug": "user-and-shopping", "name": "Người dùng và ý định mua sắm",
        "purpose": "Trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout.",
        "center": "Người Dùng",
        "tables": ["Người Dùng", "Hồ Sơ Người Dùng", "Địa Chỉ", "Thông Báo", "Chi Tiết Giỏ Hàng", "Danh Sách Sản Phẩm Yêu Thích", "Mục Tiêu Tiết Kiệm", "Sản Phẩm"],
        "shared": ["Sản Phẩm"],
        "flow": "Người dùng đăng nhập → hoàn thiện hồ sơ/địa chỉ → xem sản phẩm → lưu wishlist/giỏ/mục tiêu → nhận thông báo.",
        "why": "Các bản ghi cùng phụ thuộc user nhưng có vòng đời khác chứng từ đơn hàng.",
        "png": "03_nguoi_dung_va_mua_sam.png",
    },
    {
        "id": "ERD-04", "slug": "order-payment-return", "name": "Đơn hàng, thanh toán và trả hàng",
        "purpose": "Thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi.",
        "center": "Đơn Hàng",
        "tables": ["Người Dùng", "Sản Phẩm", "Đơn Hàng", "Chi Tiết Đơn Hàng", "Thanh Toán", "Yêu Cầu Trả Hàng", "Phiếu Giảm Giá", "Lượt Sử Dụng Phiếu"],
        "shared": ["Người Dùng", "Sản Phẩm", "Phiếu Giảm Giá", "Lượt Sử Dụng Phiếu"],
        "flow": "Khách checkout → tạo đơn và dòng hàng snapshot → tạo payment attempt → đối soát → nếu cần tạo return request và hoàn tiền theo item.",
        "why": "Đây là transaction core; cần nhìn liền mạch để giải thích giá lịch sử, idempotency và audit.",
        "png": "04_don_hang_thanh_toan_tra_hang.png",
    },
    {
        "id": "ERD-05", "slug": "promotion-and-loyalty", "name": "Khuyến mãi, VIP và Flagcard",
        "purpose": "Giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành.",
        "center": "Người Dùng",
        "tables": ["Người Dùng", "Đơn Hàng", "Sản Phẩm", "Phiếu Giảm Giá", "Lượt Sử Dụng Phiếu", "Quy Tắc Giảm Giá", "Thành Viên VIP", "Thẻ Địa Danh", "Bộ Sưu Tầm Thẻ Của Người Dùng"],
        "shared": ["Người Dùng", "Đơn Hàng", "Sản Phẩm"],
        "flow": "Đơn hoàn tất → tính hạng VIP/trao Flagcard → sinh hoặc áp voucher → ghi redemption gắn user và order.",
        "why": "Các bảng này cùng trả lời giảm giá đến từ đâu, đã dùng ở đơn nào và phần thưởng thuộc user nào.",
        "png": "05_khuyen_mai_va_vip.png",
    },
    {
        "id": "ERD-06", "slug": "review-and-moderation", "name": "Đánh giá và kiểm duyệt",
        "purpose": "Trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt.",
        "center": "Đánh Giá Sản Phẩm",
        "tables": ["Người Dùng", "Sản Phẩm", "Đơn Hàng", "Đánh Giá Sản Phẩm", "Tương Tác Đánh Giá", "Mẫu Kiểm Duyệt", "Đánh Giá Địa Điểm Nhật Bản"],
        "shared": ["Người Dùng", "Sản Phẩm", "Đơn Hàng"],
        "flow": "Người mua có đơn hợp lệ → tạo review → hệ thống/admin kiểm duyệt → user khác phản ứng helpful/not helpful.",
        "why": "Cụm này chứng minh nguồn review, chống phản ứng trùng và tách quyết định kiểm duyệt khỏi nội dung gốc.",
        "png": "06_danh_gia_va_kiem_duyet.png",
    },
    {
        "id": "ERD-07", "slug": "behavior-ai-and-operations", "name": "Hành vi, AI và vận hành nội dung",
        "purpose": "Giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành.",
        "center": "Người Dùng",
        "tables": ["Người Dùng", "Sản Phẩm", "Lịch Sử Tìm Kiếm", "Tin Nhắn", "Tương Tác Người Dùng", "Lịch Sử Thử Đồ", "Đánh Giá Địa Điểm Nhật Bản", "Cấu Hình Cửa Hàng", "Quảng Cáo"],
        "shared": ["Người Dùng", "Sản Phẩm", "Đánh Giá Địa Điểm Nhật Bản", "Quảng Cáo"],
        "flow": "Người dùng tìm/xem/chat/thử đồ → event gắn user và có thể gắn product → hệ thống dùng dữ liệu cho gợi ý, lịch sử và quản trị.",
        "why": "Đây là dữ liệu hành vi append-heavy và artifact AI; retention/index khác dữ liệu giao dịch.",
        "png": "07_ai_tuong_tac_va_nhat_ban.png",
    },
]

ENTITY_MODULE = {}
for module in MODULES:
    for entity in module["tables"]:
        ENTITY_MODULE.setdefault(entity, module["id"])


FLOWS = [
    {
        "id": "FLOW-01", "name": "Đăng ký, đăng nhập và hồ sơ", "actor": "Khách hàng",
        "trigger": "Người dùng tạo tài khoản hoặc đăng nhập rồi cập nhật hồ sơ/địa chỉ.",
        "path": "Người Dùng → Hồ Sơ Người Dùng → Địa Chỉ",
        "rank": 6, "value": "Giải thích identity, dữ liệu riêng tư và quan hệ 1:0..1/1:N.", "difficulty": "Dễ", "say": "Có",
        "steps": [
            ("Đăng ký/đăng nhập", "users", "CREATE/READ user; mật khẩu băm bcrypt, phiên JWT", "users.id"),
            ("Cập nhật hồ sơ", "profiles", "UPSERT số đo, phong cách, ngân sách", "profiles.userId → users.id"),
            ("Lưu địa chỉ", "addresses", "CREATE/UPDATE sổ địa chỉ", "addresses.userId → users.id"),
        ],
    },
    {
        "id": "FLOW-02", "name": "Khám phá sản phẩm tới giỏ hàng", "actor": "Khách hàng",
        "trigger": "Người dùng tìm sản phẩm, chọn màu/cỡ và thêm vào giỏ.",
        "path": "Danh Mục → Sản Phẩm → Biến Thể → Chi Tiết Giỏ Hàng",
        "rank": 3, "value": "Nối catalog với tồn kho và mapping giỏ có thuộc tính.", "difficulty": "Dễ", "say": "Có",
        "steps": [
            ("Duyệt/tìm", "categories, products, product_details", "READ catalog và mô tả", "products.categoryId → categories.id"),
            ("Chọn biến thể", "product_variants", "READ stock theo màu/cỡ/SKU", "product_variants.productId → products.id"),
            ("Thêm giỏ", "cart_items", "UPSERT quantity theo đúng lựa chọn", "userId → users.id; productId → products.id"),
        ],
    },
    {
        "id": "FLOW-03", "name": "Checkout, đơn hàng và thanh toán", "actor": "Khách hàng + cổng thanh toán",
        "trigger": "Người dùng xác nhận giỏ và chọn COD/Stripe/VNPay.",
        "path": "Giỏ → Biến Thể → Đơn Hàng → Chi Tiết Đơn Hàng → Thanh Toán",
        "rank": 1, "value": "Flow mạnh nhất để bảo vệ snapshot, giá server, tồn kho và idempotency.", "difficulty": "Khó", "say": "Bắt buộc",
        "steps": [
            ("Kiểm tra đầu vào", "cart_items, products, product_variants", "READ; server tính lại giá và kiểm tra stock", "productId và tổ hợp màu/cỡ"),
            ("Tạo chứng từ", "orders", "CREATE order, customer/address/discount snapshot; dùng clientRequestId", "orders.userId → users.id"),
            ("Tạo dòng hàng", "order_items", "CREATE qty/price/name/color/size snapshot", "orderId → orders.id; productId → products.id"),
            ("Thanh toán", "payments", "CREATE/UPDATE payment attempt, webhook/reconcile/refund", "orderId → orders.id; userId → users.id"),
        ],
    },
    {
        "id": "FLOW-04", "name": "Đổi trả và hoàn tiền theo sản phẩm", "actor": "Khách hàng + quản trị viên",
        "trigger": "Đơn đã giao, khách chọn các dòng cần trả và gửi bằng chứng.",
        "path": "Đơn Hàng → Chi Tiết Đơn Hàng → Yêu Cầu Trả Hàng → Thanh Toán",
        "rank": 2, "value": "Thể hiện state machine hậu mãi, item-level refund và audit.", "difficulty": "Khó", "say": "Có",
        "steps": [
            ("Xác minh điều kiện", "orders, order_items", "READ trạng thái, thời hạn, item còn được trả", "order_items.orderId → orders.id"),
            ("Tạo yêu cầu", "return_requests", "CREATE request, item list, ảnh và timeline", "orderId/userId/paymentId"),
            ("Duyệt và nhận hàng", "return_requests", "UPDATE trạng thái; chốt stockRestoredAt", "Giữ cùng request id"),
            ("Hoàn tiền", "payments", "UPDATE refunds/refundedAmount theo item đã duyệt", "return_requests.paymentId → payments.id"),
        ],
    },
    {
        "id": "FLOW-05", "name": "Đánh giá verified purchase", "actor": "Khách hàng + quản trị viên",
        "trigger": "Người mua đã hoàn tất đơn muốn đánh giá sản phẩm.",
        "path": "Đơn Hàng → Đánh Giá Sản Phẩm → Mẫu Kiểm Duyệt → Tương Tác Đánh Giá",
        "rank": 5, "value": "Giải thích ba FK của review và điểm yếu unique còn thiếu.", "difficulty": "Trung bình", "say": "Có",
        "steps": [
            ("Kiểm tra mua hàng", "orders, order_items", "READ đơn hoàn tất có chứa product", "orderId/userId/productId"),
            ("Tạo review", "reviews", "CREATE rating/content/status", "productId/userId/orderId"),
            ("Kiểm duyệt", "moderation_samples", "CREATE/UPDATE mẫu gắn review nguồn", "reviewId → reviews.id"),
            ("Phản ứng", "review_reactions", "UPSERT helpful/not_helpful", "reviewId/userId"),
        ],
    },
    {
        "id": "FLOW-06", "name": "Thử đồ AI và tạo lịch sử", "actor": "Khách hàng + GPU services",
        "trigger": "Người dùng chọn ảnh người và sản phẩm để thử đồ/tạo video.",
        "path": "Sản Phẩm → Lịch Sử Thử Đồ → Media kết quả",
        "rank": 4, "value": "Nối tính năng nổi bật của đồ án với dữ liệu thật mà không biến model thành bảng.", "difficulty": "Trung bình", "say": "Có",
        "steps": [
            ("Chọn nguồn", "products, product_media", "READ ảnh sản phẩm và metadata", "media.productId → products.id"),
            ("Suy luận", "FASHN/FLUX/One-to-All (service)", "Không ghi model vào ERD; service xử lý ngoài DB", "Không có FK"),
            ("Lưu lịch sử", "tryon_history", "CREATE user/product/result URL/engine/time", "userId → users.id; productId → products.id"),
        ],
    },
    {
        "id": "FLOW-07", "name": "Voucher, VIP và Flagcard", "actor": "Hệ thống + quản trị viên",
        "trigger": "Đơn hoàn tất hoặc admin cấp ưu đãi.",
        "path": "Đơn Hàng → Thành Viên VIP/Flagcard → Phiếu Giảm Giá → Lượt Sử Dụng Phiếu",
        "rank": 7, "value": "Thể hiện rule, assignment, redemption và reward history.", "difficulty": "Khó", "say": "Nếu còn thời gian",
        "steps": [
            ("Tính quyền lợi", "orders, vip_memberships, discount_rules", "READ doanh số; CREATE/UPDATE kỳ VIP", "membership.userId/ruleId"),
            ("Trao thẻ", "flagcards, flagcard_collections", "UPDATE cardIds/awards chống lặp trong app", "collection.userId; cardIds[]"),
            ("Áp voucher", "vouchers, voucher_redemptions", "READ rule; CREATE redemption gắn order", "voucherId/userId/orderId"),
        ],
    },
    {
        "id": "FLOW-08", "name": "Hành vi và gợi ý cá nhân hóa", "actor": "Khách hàng",
        "trigger": "Người dùng xem, tìm, yêu thích, chat hoặc đặt mục tiêu.",
        "path": "Người Dùng → Search/Interaction/Chat/Goal → Sản Phẩm → Gợi ý",
        "rank": 8, "value": "Giải thích event data và retention, nhưng ít giá trị giao dịch hơn checkout.", "difficulty": "Trung bình", "say": "Nếu được hỏi",
        "steps": [
            ("Ghi hành vi", "search_logs, interactions, chats", "APPEND query/event/message", "userId và productId nullable theo context"),
            ("Ghi mục tiêu", "goals", "CREATE/UPDATE số tiền mục tiêu và deposits", "userId/productId"),
            ("Tạo gợi ý", "products + signals", "READ dữ liệu thật; fallback nếu vector service tắt", "Không tạo thêm FK"),
        ],
    },
]


def write(name: str, content: str) -> None:
    (OUT / name).write_text(content.rstrip() + "\n", encoding="utf-8")


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def logical_rows(entity: str):
    values = ERD["schema"][entity]
    rows, marker = [], ""
    for value in values:
        if re.fullmatch(r"(?:PK|FK\d*)", value):
            marker = value
        else:
            rows.append((marker, value))
            marker = ""
    return rows


def logical_pk(entity: str) -> str:
    return next((field for marker, field in logical_rows(entity) if marker == "PK"), "⚠️ CẦN XÁC MINH")


def fk_details(entity: str):
    return [row for row in RELATION_DETAILS if row[0] == entity]


def index_summary(collection: str | None) -> str:
    if not collection or collection not in DB:
        return "Không có collection vật lý riêng"
    parts = []
    for idx in DB[collection]["indexes"]:
        if idx.get("name") == "_id_":
            continue
        keys = "+".join(idx.get("key", {}).keys()) or "_id"
        parts.append(keys + (" UNIQUE" if idx.get("unique") else ""))
    return ", ".join(parts) or "Chỉ `_id` mặc định"


def fields_summary(collection: str | None, limit: int = 10) -> str:
    if not collection or collection not in DB:
        return "—"
    fields = [name for name in DB[collection].get("fields", {}) if name != "_id"]
    return ", ".join(f"`{x}`" for x in fields[:limit]) + ("…" if len(fields) > limit else "")


def module_relations(module):
    table_set = set(module["tables"])
    return [r for r in RELATION_DETAILS if r[0] in table_set and r[1] in table_set]


def create_inventory():
    rows = [
        ("Báo cáo tốt nghiệp đã hiệu chỉnh", "`baocaototnghiep_JAPANO_FINAL_REVISED.pdf` (175 trang) và `.docx`", "Bài toán, actor, use case, kiến trúc, chương 4.2 ERD", "Cao cho ý định thiết kế; phải đối chiếu source"),
        ("ERD logic gốc", "`erd.drawio`", "36 thực thể, field logic, 50 cạnh", "Cao cho mô hình logic; không phải constraint MongoDB"),
        ("Snapshot ERD", "`tools/snapshots/erd.json`", "Parse tự động từ Draw.io", "Cao; kiểm tra đúng 36/50"),
        ("Snapshot MongoDB", "`tools/snapshots/db_schema.json`", "35 collection, count/index/field-presence", "Rất cao tại thời điểm snapshot; không chứa sample/secret"),
        ("Ánh xạ collection", "`backend/lib/mongoCollections.js`", "Serialize/hydrate, 35 collection, index, relationshipErrors", "Rất cao cho implementation"),
        ("Cơ chế state/persistence", "`backend/lib/store.js`, `backend/lib/mongo.js`", "In-memory mutation, debounce persist, fallback", "Rất cao"),
        ("API nghiệp vụ", "`backend/routes/*.js` (17 tệp)", "CRUD và workflow thật", "Rất cao"),
        ("Kiểm thử", "`backend/test/*.test.js`", "Concurrency, pricing, authz, refund, integrity", "Cao; bằng chứng hành vi trong phạm vi test"),
        ("Seed/fallback", "`backend/data/db.json`", "State demo và fallback", "Trung bình; không thay MongoDB hiện hành"),
        ("Audit trước", "`docs/project_audit/*.md`", "Facts, data dictionary, report-vs-code, risk", "Cao sau khi tái kiểm tra; là nguồn thứ cấp"),
        ("ERD defense hiện có", "`ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.*`, `ERD_DEFENSE_MATRIX.md`, `ERD_QUESTION_BANK.md`", "Thẻ học và câu hỏi đã audit", "Trung bình-cao; tái sử dụng có kiểm chứng"),
        ("SQL/DBML tham khảo", "`JAPANO/japano_erd.sql`, `.dbml`, `japano_schema_v2.sql`", "Bản biểu diễn quan hệ/phục vụ xuất sơ đồ", "Thấp hơn source MongoDB; không coi là migration runtime"),
    ]
    text = "# 00 — Source inventory\n\n"
    text += f"> Snapshot kiểm chứng: **{SNAPSHOT_DATE}**. Gói này không sửa source nghiệp vụ hoặc database.\n\n"
    text += "| Nguồn | File | Vai trò | Mức độ tin cậy |\n|---|---|---|---|\n"
    text += "\n".join(f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows)
    text += "\n\n## Thứ tự ưu tiên khi có mâu thuẫn\n\n"
    text += "`MongoDB/index hiện hành + source runtime` → `erd.drawio` → `báo cáo đã hiệu chỉnh` → `tài liệu sinh` → `SQL/DBML tham khảo`.\n\n"
    text += "- `[THỰC TẾ]`: có bằng chứng source/schema/snapshot.\n- `[SUY LUẬN]`: giải thích hợp lý nhưng chưa có constraint trực tiếp.\n- `[ĐỀ XUẤT]`: hướng cải tiến, chưa tồn tại.\n- `⚠️ CẦN XÁC MINH`: không đủ bằng chứng để kết luận.\n"
    write("00_SOURCE_INVENTORY.md", text)


def create_context():
    actors = [
        ("Khách chưa đăng nhập", "Duyệt/tìm sản phẩm, đăng ký/đăng nhập", "categories, products, search_logs"),
        ("Khách hàng", "Mua sắm, thanh toán, review, thử đồ, hậu mãi, loyalty", "users và các collection có userId"),
        ("Staff", "Đọc dữ liệu vận hành theo ngưỡng role", "orders, users, catalog"),
        ("Admin", "Quản lý sản phẩm, đơn, voucher, nội dung, moderation", "catalog, transaction, content"),
        ("Super admin", "Quản trị quyền cao nhất", "users.role/status và audit liên quan"),
        ("Stripe/VNPay", "Xác nhận và đối soát thanh toán", "payments, orders"),
        ("GPU/AI services", "Thử đồ, video, embedding, chat tùy cấu hình", "tryon_history, ai_descriptions, chats/interactions"),
    ]
    text = "# 01 — System context\n\n"
    text += "## Tổng quan hệ thống\n\n### Cách kỹ thuật\n\n"
    text += "[THỰC TẾ] JAPANO là modular monolith: mobile React Native/Expo và Web Admin gọi REST API Node.js/Express; runtime thao tác trên state trong bộ nhớ, MongoDB lưu 35 collection vật lý đã tách, Cloudinary giữ media và các dịch vụ AI cục bộ xử lý suy luận. ERD logic mô tả 36 thực thể và 50 quan hệ tham chiếu do tầng ứng dụng kiểm tra.\n\n"
    text += "### Cách nói trước hội đồng\n\n> JAPANO giải quyết trọn luồng mua thời trang Nhật Bản: khách khám phá, chọn biến thể, thử đồ, đặt hàng và xử lý hậu mãi; nhân viên vận hành trên Web Admin. ERD của nhóm không chỉ lưu sản phẩm và đơn hàng mà còn giữ được giá lịch sử, nguồn thanh toán, quyền lợi loyalty và dữ liệu AI gắn đúng người dùng/sản phẩm.\n\n"
    text += "## Actor\n\n| Actor | Vai trò/chức năng chính | Dữ liệu tác động |\n|---|---|---|\n"
    text += "\n".join(f"| {a} | {b} | {c} |" for a, b, c in actors)
    text += "\n\n## Các module nghiệp vụ\n\n"
    for m in MODULES:
        text += f"- **{m['id']} — {m['name']}**: {m['purpose']}\n"
    text += "\n## Các luồng nghiệp vụ chính\n\n"
    for f in FLOWS:
        text += f"- **{f['id']}**: {f['actor']} → {f['trigger']} → `{f['path']}` → {f['steps'][-1][2]}.\n"
    text += "\n## Mâu thuẫn báo cáo/source cần nhớ\n\n"
    text += "- Báo cáo trình bày **36 bảng/50 quan hệ ở mức logic**; source chạy **35 collection vật lý**. Đây không phải cùng một con số.\n"
    text += "- MongoDB không có FK server-side; các dây trên ERD là logical reference, kiểm tra bằng `relationshipErrors()`/`assertValid()`.\n"
    text += "- Hệ thống không dùng Mongoose và không có migration ORM; Node MongoDB driver cùng serializer là nguồn implementation.\n"
    text += "- Tính nguyên tử hiện tại đến từ một mutator đồng bộ trong một process, không phải MongoDB transaction.\n"
    write("01_SYSTEM_CONTEXT.md", text)


def create_database_inventory():
    inbound, outbound = Counter(), Counter()
    for child, parent in RELATIONS:
        outbound[child] += 1
        inbound[parent] += 1
    text = "# 02 — Database inventory\n\n"
    text += f"> [THỰC TẾ] Snapshot {SNAPSHOT_DATE}: **{len(DB)} collection vật lý · {sum(v['count'] for v in DB.values()):,} document · {len(ENTITIES)} thực thể logic · {len(RELATIONS)} quan hệ logic**.\n\n"
    text += "| Table/thực thể logic | Collection vật lý | Chức năng | PK logic | FK logic | Unique/index đáng chú ý | Quan hệ | Module |\n|---|---|---|---|---|---|---:|---|\n"
    for entity in ENTITIES:
        coll = MAP.get(entity)
        fks = fk_details(entity)
        fk_text = "; ".join(f"`{row[2]}` → {row[1]}" for row in fks) or "—"
        purpose = ENTITY_INFO[entity]["purpose"]
        degree = inbound[entity] + outbound[entity]
        text += f"| {entity} | `{coll}`" if coll else f"| {entity} | — (logic/nhúng)"
        text += f" | {esc(purpose)} | {logical_pk(entity)} | {esc(fk_text)} | {esc(index_summary(coll))} | {degree} | {ENTITY_MODULE.get(entity, 'Shared')} |\n"
    text += "\n## Collection vật lý chưa có thực thể riêng trên ERD\n\n"
    text += "| Collection | Count | Vai trò | Trạng thái |\n|---|---:|---|---|\n"
    for coll, role in [("push_tokens", "Token push theo user/device"), ("japan_spot_suggestions", "Hàng đợi gợi ý địa điểm")]:
        text += f"| `{coll}` | {DB.get(coll, {}).get('count', 0)} | {role} | ⚠️ ERD logic chưa mô hình hóa riêng |\n"
    text += "\n## Thống kê phân loại\n\n"
    text += "- **PK logic:** 36; ở MongoDB mọi document còn có `_id`.\n"
    text += "- **FK/relationship logic:** 50; không phải MongoDB foreign-key constraint.\n"
    text += "- **Junction/association:** `order_items`, `cart_items`, `wishlist_items`, `review_reactions`, `voucher_redemptions`, `flagcard_collections`.\n"
    text += "- **Master:** categories, products, product_details, product_variants, product_media, discount_rules, flagcards, settings.\n"
    text += "- **Transaction/ledger:** orders, order_items, payments, return_requests, voucher_redemptions.\n"
    text += "- **History/event/log:** interactions, search_logs, chats, tryon_history, notifications, moderation_samples.\n"
    text += "- **Bảng nhiều FK nhất:** `Yêu Cầu Trả Hàng`, `Lượt Sử Dụng Phiếu`, `Đánh Giá Sản Phẩm` (mỗi bảng 3 quan hệ outbound).\n"
    text += "- **Bảng được tham chiếu nhiều nhất:** `Người Dùng`, kế đến `Sản Phẩm`; xem bảng trọng lực trong `03_ERD_AUDIT.md`.\n"
    write("02_DATABASE_INVENTORY.md", text)


def create_erd_audit():
    inbound, outbound = Counter(), Counter()
    for child, parent in RELATIONS:
        outbound[child] += 1
        inbound[parent] += 1
    ranked = sorted(ENTITIES, key=lambda e: (inbound[e] + outbound[e], inbound[e]), reverse=True)
    text = "# 03 — ERD audit\n\n## Tổng quan\n\n"
    text += f"- Tổng thực thể logic: **{len(ENTITIES)}**.\n- Tổng relationship: **{len(RELATIONS)}**.\n- Collection vật lý: **{len(DB)}**.\n"
    text += "- Bảng trung tâm theo degree: **Người Dùng**, **Sản Phẩm**, sau đó **Đơn Hàng**.\n"
    text += "- Bridge/junction đáng nói: Chi Tiết Đơn Hàng, Giỏ Hàng, Wishlist, Reaction, Voucher Redemption, Flagcard Collection.\n\n"
    text += "## Trung tâm trọng lực của database\n\n| Rank | Table | Tổng quan hệ | Inbound | Outbound | Vai trò |\n|---:|---|---:|---:|---:|---|\n"
    for i, entity in enumerate(ranked[:10], 1):
        info = ENTITY_INFO[entity]
        text += f"| {i} | {entity} | {inbound[entity] + outbound[entity]} | {inbound[entity]} | {outbound[entity]} | {esc(info['purpose'])} |\n"
    text += "\n### Ảnh hưởng nếu loại bỏ các hub\n\n"
    for entity in ranked[:8]:
        info = ENTITY_INFO[entity]
        deps = sorted({a if b == entity else b for a, b in RELATIONS if entity in (a, b)})
        text += f"#### {entity}\n\n1. **Lưu gì:** {info['purpose']}\n2. **Tại sao tồn tại:** {info['opener']}\n3. **Bảng phụ thuộc/liên quan:** {', '.join(deps)}.\n4. **Workflow:** {info['scenario']}\n5. **Nếu bỏ:** {info['breaks']}\n\n"
    text += "## Những điểm ERD và database khớp nhau\n\n"
    text += "- [THỰC TẾ] Tên 36 thực thể và 50 cạnh parse lại được trực tiếp từ `erd.drawio`.\n"
    text += "- [THỰC TẾ] Các hub User/Product/Order khớp với field tham chiếu và route nghiệp vụ.\n"
    text += "- [THỰC TẾ] `order_items` là junction có dữ liệu riêng và historical snapshot; không phải duplicate vô nghĩa.\n"
    text += "- [THỰC TẾ] `product_variants` có unique `(productId,colorName,size)` và là đơn vị tồn kho.\n"
    text += "\n## Những điểm ERD và source/database khác nhau\n\n"
    text += "- **36 vs 35:** 36 thực thể logic, 35 collection vật lý. `Màu Sắc`, `Kích Thước`, `Hình Ảnh` không có collection 1–1; `push_tokens`, `japan_spot_suggestions` không có entity riêng.\n"
    text += "- **Hai thực thể ảnh:** runtime dùng `product_media`; `Hình Ảnh` là dấu vết logic cũ/trùng vai trò.\n"
    text += "- **Cardinality payment:** dữ liệu hiện có 94 order/94 payment không chứng minh 1:1; `payments.orderId` không unique, schema cho phép retry 1:N.\n"
    text += "- **FK:** MongoDB không áp đặt; integrity là application-level và có giới hạn fallback/multi-instance.\n"
    text += "- **Review:** source chưa có unique `(userId,productId)` trong khi wishlist đã có unique pair.\n"
    text += "\n## Những điểm cần xác minh\n\n"
    text += "- ⚠️ Chính sách retention/xóa ảnh thử đồ và dữ liệu hành vi chưa được định nghĩa đầy đủ.\n"
    text += "- ⚠️ Cascade trong tài liệu là business policy/đề xuất; source không có MongoDB cascade constraint.\n"
    text += "- ⚠️ Một số trường FK nullable phụ thuộc workflow; cần dùng validation schema nếu chuyển sang direct-per-collection writes.\n"
    text += "\n## ERD nhìn ở cấp kiến trúc nói lên điều gì?\n\n> [THỰC TẾ] Mật độ cạnh tập trung vào Người Dùng và Sản Phẩm cho thấy JAPANO lấy hành trình người dùng quanh catalog làm trục; Đơn Hàng là hub chứng từ nối product snapshot, payment, return, voucher và review. Các bảng event/AI nằm ở rìa vì chúng bổ sung cá nhân hóa, không quyết định tính đúng đắn của giao dịch.\n"
    write("03_ERD_AUDIT.md", text)


def create_modules():
    text = "# 04 — Phân cụm ERD theo nghiệp vụ\n\n> Một shared table được lặp ở nhiều ERD con để kể trọn luồng; việc lặp không tạo entity hoặc relationship mới.\n\n"
    for m in MODULES:
        text += f"# {m['id']} — {m['name']}\n\n## Mục đích\n\n{m['purpose']}\n\n"
        text += f"## Bảng trung tâm\n\n**{m['center']}** — {ENTITY_INFO[m['center']]['opener']}\n\n"
        text += "## Tables\n\n" + "\n".join(f"{i}. {e} (`{MAP[e]}`)" if MAP[e] else f"{i}. {e} (logic/nhúng)" for i, e in enumerate(m["tables"], 1)) + "\n\n"
        text += "## Relationships\n\n"
        for child, parent, fk, card, meaning, deletion in module_relations(m):
            text += f"- **{child} → {parent}** qua `{fk}` · {card}. {meaning}\n"
        if not module_relations(m):
            text += "- Không có cạnh FK nội bộ trên ERD; đây là các bảng vận hành độc lập.\n"
        text += f"\n## Business flow\n\n{m['flow']}\n\n"
        text += "## Shared tables\n\n" + (", ".join(m["shared"]) if m["shared"] else "Không có.") + "\n\n"
        text += "## Liên kết sang ERD khác\n\n"
        links = [other["id"] for other in MODULES if other is not m and set(m["tables"]) & set(other["tables"])]
        text += ", ".join(links) + ".\n\n"
        text += f"## Vì sao nên tách thành ERD riêng\n\n{m['why']}\n\n---\n\n"
    write("04_ERD_MODULES.md", text)


def mermaid_source(module):
    # Bộ bố cục ELK định tuyến cạnh vuông góc và tránh nhãn đè lên nhau; bộ mặc
    # định đặt nhãn ở trung điểm cạnh nên các sơ đồ nhiều cạnh bị chồng chữ.
    lines = [
        '%%{init: {"flowchart": {"defaultRenderer": "elk", "nodeSpacing": 60, "rankSpacing": 90}} }%%',
        "flowchart LR",
        f"  %% {module['id']} — {module['name']}",
    ]
    ids = {entity: f"E{i:02d}" for i, entity in enumerate(module["tables"], 1)}
    for entity in module["tables"]:
        coll = MAP[entity] or "logic/nhúng"
        rows = logical_rows(entity)[:4]
        details = "<br/>".join(f"{marker + ' ' if marker else ''}{field}" for marker, field in rows)
        lines.append(f'  {ids[entity]}["<b>{entity}</b><br/><small>{coll}</small><br/>{details}"]')
    for child, parent, fk, card, _, _ in module_relations(module):
        lines.append(f'  {ids[child]} -->|"{fk}<br/>{card}"| {ids[parent]}')
    for entity in module["shared"]:
        if entity in ids:
            lines.append(f"  class {ids[entity]} shared")
    lines += ["  classDef shared fill:#fff2cc,stroke:#bf9000,stroke-width:2px;",
              "  classDef default fill:#eaf3f8,stroke:#1f4e79,color:#172b4d;"]
    return "\n".join(lines) + "\n"


def create_diagrams():
    DIAGRAMS.mkdir(parents=True, exist_ok=True)
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    if ERD_PATH.resolve() != (SNAPSHOTS / "erd.json").resolve():
        shutil.copy2(ERD_PATH, SNAPSHOTS / "erd.json")
    if DB_PATH.resolve() != (SNAPSHOTS / "db_schema.json").resolve():
        shutil.copy2(DB_PATH, SNAPSHOTS / "db_schema.json")
    if not LOCAL_CATALOG.exists():
        shutil.copy2(EXTERNAL / "defense_catalog.py", LOCAL_CATALOG)
    shutil.copy2(ROOT / "erd.drawio", DIAGRAMS / "ERD-00-overview.drawio")
    visual = ROOT / "ERD_HINH_ANH_CHI_TIET"
    overview_candidates = list(visual.rglob("00_tong_the.png"))
    if overview_candidates:
        shutil.copy2(overview_candidates[0], DIAGRAMS / "ERD-00-overview.png")
    for module in MODULES:
        base = f"{module['id']}-{module['slug']}"
        (DIAGRAMS / f"{base}.mmd").write_text(mermaid_source(module), encoding="utf-8")
        candidates = list(visual.rglob(module["png"]))
        if candidates:
            shutil.copy2(candidates[0], DIAGRAMS / f"{base}.png")
    readme = "# Diagrams\n\n- `ERD-00-overview.drawio` là bản editable của ERD tổng; PNG là bản chiếu.\n- Mỗi ERD con có source Mermaid `.mmd` và PNG render/crop từ `erd.drawio` hiện hành.\n- Màu vàng trong Mermaid đánh dấu shared table. Không thêm cạnh ngoài 50 relationship gốc.\n\n"
    for m in MODULES:
        base = f"{m['id']}-{m['slug']}"
        readme += f"- [{m['id']} source]({base}.mmd) · [{m['id']} PNG]({base}.png) — {m['name']}\n"
    (DIAGRAMS / "README.md").write_text(readme, encoding="utf-8")


def create_presentation_map():
    rows = [
        ("1", "ERD-00", "Định vị 36 entity/50 quan hệ", "Người Dùng, Sản Phẩm, Đơn Hàng", "Ba hub", "Tách catalog trước"),
    ]
    for i, m in enumerate(MODULES, 2):
        rels = module_relations(m)
        rel_show = "; ".join(f"{c}→{p}" for c, p, *_ in rels[:2]) or "Không có FK nội bộ"
        next_label = MODULES[i - 1]["id"] if i - 1 < len(MODULES) else "End-to-end checkout"
        rows.append((str(i), m["id"], m["purpose"], m["center"], rel_show, f"Chuyển {next_label}"))
    rows.append(("9", "FLOW-03", "Kết toàn bài bằng luồng tiền–hàng", "User, Order, OrderItem, Payment", "User→Order→Item/Payment", "Tổng kết trade-off"))
    text = "# 05 — Bản đồ thuyết trình ERD\n\n| Thứ tự | Diagram | Mục tiêu | Bảng cần chỉ | Quan hệ cần chỉ | Chuyển sang phần sau |\n|---:|---|---|---|---|---|\n"
    text += "\n".join("| " + " | ".join(esc(x) for x in row) + " |" for row in rows)
    text += "\n\n## Quy tắc chỉ màn hình\n\n1. Chỉ actor/hub trước.\n2. Nói hành động.\n3. Chỉ record được tạo/đọc.\n4. Chỉ FK và business meaning.\n5. Chỉ bước kế tiếp; không đọc danh sách field.\n"
    write("05_PRESENTATION_MAP.md", text)


def create_data_flows():
    text = "# 06 — Đường dữ liệu end-to-end\n\n"
    for f in FLOWS:
        text += f"# {f['id']} — {f['name']}\n\n## Trigger\n\n{f['trigger']}\n\n## Actor\n\n{f['actor']}\n\n## Data path\n\n`{f['path']}`\n\n## Chi tiết\n\n"
        for i, (action, tables, effect, fks) in enumerate(f["steps"], 1):
            text += f"### Step {i} — {action}\n\n- **TABLE/READ-WRITE:** `{tables}`.\n- **Hành vi:** {effect}.\n- **FK sử dụng:** {fks}.\n\n"
        text += f"## Kết quả cuối\n\n{f['steps'][-1][2]}.\n\n## Tables liên quan\n\n`{f['path']}`.\n\n---\n\n"
    text += "# Xếp hạng flow để thuyết trình\n\n| Rank | Flow | Giá trị khi thuyết trình | Độ khó | Nên nói? |\n|---:|---|---|---|---|\n"
    for f in sorted(FLOWS, key=lambda x: x["rank"]):
        text += f"| {f['rank']} | {f['id']} — {f['name']} | {f['value']} | {f['difficulty']} | {f['say']} |\n"
    write("06_DATA_FLOWS.md", text)


def create_overview_script():
    text = "# 07 — Bài nói ERD tổng (45–60 giây)\n\n"
    text += "> [MỞ ERD TỔNG] ERD của JAPANO có 36 thực thể logic và 50 quan hệ, được chia thành bảy cụm nghiệp vụ. Hai điểm neo lớn nhất là Người Dùng và Sản Phẩm vì hầu hết hành vi mua sắm đều cần biết ai thực hiện và đang tác động lên sản phẩm nào. Đơn Hàng là trung tâm chứng từ: từ đây đi sang Chi Tiết Đơn Hàng để giữ từng dòng và giá lịch sử, sang Thanh Toán để đối soát tiền, và sang Yêu Cầu Trả Hàng để xử lý hậu mãi. Khi trình bày em không đọc 36 bảng, mà đi theo bảy nhánh: catalog–biến thể, media–AI, user–shopping, order–payment–return, promotion–loyalty, review–moderation và dữ liệu hành vi–AI. Sau cùng em nối lại bằng luồng checkout end-to-end.\n\n"
    text += "## Câu dự phòng nếu bị hỏi 36 bảng hay 35 collection\n\n> 36 là thực thể ở mô hình logic; implementation MongoDB có 35 collection vật lý. Màu, kích thước và một thực thể ảnh được nhúng/gộp, trong khi push token và japan spot suggestion là collection kỹ thuật chưa có entity riêng.\n"
    write("07_SCRIPT_OVERVIEW.md", text)


def module_script(m):
    rels = module_relations(m)
    first = rels[0] if rels else None
    second = rels[1] if len(rels) > 1 else first
    info = ENTITY_INFO[m["center"]]
    lines = [f"# {m['id']} — {m['name']}", "", "## Khi bắt đầu slide", "",
             f"> [MỞ {m['id']}] Ở cụm này em tập trung vào {m['purpose'].lower()} Bảng trung tâm là {m['center']}; {info['opener'].lower()}", ""]
    lines += [f"## Chỉ vào bảng {m['center']}", "", f"> [CHỈ {m['center'].upper()}] {info['purpose']} Nếu bỏ bảng này: {info['breaks']}", ""]
    if first:
        child, parent, fk, card, meaning, _ = first
        lines += [f"## Chỉ vào relationship {child} → {parent}", "", f"> [CHỈ DÂY] `{fk}` thể hiện {card.lower()}; {meaning.lower()} Đây là business meaning của dây, không phải MongoDB foreign-key constraint.", ""]
    lines += ["## Luồng dữ liệu", "", f"> {m['flow']}", "", "## Lý do thiết kế", "", f"> {m['why']} Điểm cần thừa nhận: {info['weakness']}", ""]
    if second:
        lines += ["## Câu chuyển sang ERD tiếp theo", "", f"> Sau khi đã thấy dữ liệu đi qua {second[0]} và {second[1]}, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.", ""]
    return "\n".join(lines)


def create_module_scripts():
    text = "# 08 — Bài nói cho từng ERD con\n\n> Mỗi phần 40–90 giây. Câu trong dấu `[]` là hành động trình chiếu.\n\n"
    text += "\n---\n\n".join(module_script(m) for m in MODULES)
    write("08_SCRIPT_MODULES.md", text)


def create_full_presentation():
    text = "# 09 — Bài thuyết trình ERD hoàn chỉnh\n\n# VERSION A — 5 PHÚT\n\n"
    text += "[MỞ ERD TỔNG]\n\n> ERD JAPANO có 36 thực thể logic, 50 quan hệ và được hiện thực thành 35 collection MongoDB. Em sẽ không đọc từng bảng mà đi theo luồng dữ liệu. Ba điểm neo là Người Dùng, Sản Phẩm và Đơn Hàng.\n\n"
    text += "[CHỈ USER] [CHỈ PRODUCT]\n\n> User và Product có degree cao nhất vì chúng nối danh tính với hầu hết hành vi mua sắm. Product tách Category, Detail, Variant và Media; trong đó Variant mới là đơn vị tồn kho theo màu–cỡ.\n\n"
    text += "[CHUYỂN ERD-01] [CHỈ PRODUCT → VARIANT]\n\n> Một product có nhiều variant. Unique `(productId,colorName,size)` ngăn cùng một lựa chọn bị tách thành hai kho. Màu và kích thước có trên ERD logic nhưng được nhúng vào variant ở MongoDB.\n\n"
    text += "[CHUYỂN ERD-04] [CHỈ USER → ORDER → ORDER ITEM]\n\n> Khi checkout, server tính lại giá và kiểm tra tồn kho. Order giữ snapshot khách, địa chỉ và tổng tiền; Order Item nối Order với Product, đồng thời chụp tên, màu, cỡ, số lượng và giá để catalog đổi sau này không làm sai chứng từ.\n\n"
    text += "[CHỈ ORDER → PAYMENT → RETURN]\n\n> Payment là attempt nên orderId không unique; một đơn có thể retry. Return Request tách riêng để lưu item, bằng chứng, timeline và payment cần hoàn. Idempotency được chốt bằng clientRequestId, wasPaid và stockRestoredAt, nhưng chưa phải transaction MongoDB nhiều document.\n\n"
    text += "[CHUYỂN ERD-06]\n\n> Review giữ ba FK tới user, product và order để chứng minh verified purchase. Điểm yếu thật là chưa có unique `(userId,productId)` ở MongoDB.\n\n"
    text += "[QUAY ERD TỔNG]\n\n> Tóm lại, thiết kế mạnh ở việc tách master, mapping và chứng từ snapshot. Giới hạn là FK/application integrity chỉ an toàn theo kiến trúc một process hiện tại; khi mở rộng nhiều backend phải dùng unique/atomic update/transaction ở MongoDB.\n\n"
    text += "# VERSION B — 8 PHÚT\n\n"
    text += "[MỞ ERD TỔNG]\n\n> ERD mô tả 36 thực thể logic và 50 quan hệ. MongoDB hiện có 35 collection vật lý; sự chênh lệch là do một số lookup được nhúng và hai collection kỹ thuật chưa được vẽ. Em chia sơ đồ theo bảy nghiệp vụ, rồi kết bằng checkout.\n\n"
    for m in MODULES:
        rels = module_relations(m)
        rel_text = ""
        if rels:
            c, p, fk, card, meaning, _ = rels[0]
            rel_text = f" [CHỈ {c} → {p}] `{fk}` biểu diễn {card.lower()}; {meaning.lower()}"
        text += f"[CHUYỂN {m['id']}] [CHỈ {m['center'].upper()}]\n\n> {m['purpose']} {ENTITY_INFO[m['center']]['opener']}{rel_text} {m['flow']}\n\n"
    text += "[MỞ FLOW-03] [CHỈ USER → ORDER → ORDER ITEM → PAYMENT]\n\n> Đây là flow em chọn để kết: actor xác nhận giỏ; server đọc product/variant, tính lại giá và tồn; tạo Order cùng Order Item snapshot; payment provider cập nhật Payment; nếu hậu mãi thì Return Request trỏ lại Order và Payment. Mỗi dây tồn tại để dữ liệu ở bước sau vẫn truy được nguồn và giữ đúng lịch sử.\n\n"
    text += "[QUAY ERD TỔNG]\n\n> Về trade-off, logical model khá chuẩn hóa, nhưng physical MongoDB chủ động denormalize snapshot và lookup đóng. Hệ thống có application-level referential integrity, chưa có FK/cascade/transaction server-side; đây là giới hạn cần xử lý khi production nhiều instance.\n"
    write("09_FULL_PRESENTATION.md", text)


def qa_block(question, good, short, bad):
    return f"### Giảng viên hỏi\n\n{question}\n\n### Câu trả lời tốt\n\n{good}\n\n### Câu trả lời ngắn nếu bị hỏi nhanh\n\n{short}\n\n### Không nên trả lời\n\n{bad}\n"


def create_qa():
    groups = {"LEVEL 1 — Nhận biết": [], "LEVEL 2 — Hiểu thiết kế": [], "LEVEL 3 — Phản biện kỹ thuật": [], "LEVEL 4 — Riêng trên JAPANO": []}
    basics = [
        ("PK logic của Người Dùng là gì?", "`Mã người dùng`; MongoDB còn có `_id`, còn `id` là domain/API identity ổn định.", "Mã người dùng; `_id` là khóa vật lý.", "Email là PK."),
        ("FK của `order_items` là gì?", "`orderId` trỏ Order và `productId` trỏ Product; dòng còn giữ snapshot.", "orderId và productId.", "Chỉ productId."),
        ("Bảng nào giữ tồn kho?", "`product_variants.stock`, vì tồn phụ thuộc tổ hợp màu–cỡ.", "Biến thể sản phẩm.", "products.stock."),
        ("Bảng nào nối review với người đã mua?", "`reviews.orderId` nối về order; code còn kiểm tra order hoàn tất và chứa product.", "reviews.orderId.", "Chỉ cần userId."),
        ("Bảng nào giữ lượt dùng voucher?", "`voucher_redemptions` gắn voucher, user và order.", "Lượt Sử Dụng Phiếu.", "Lưu counter trong voucher là đủ."),
        ("Media file nằm trong MongoDB không?", "Không; Cloudinary giữ file, `product_media` giữ URL/type/vị trí.", "Mongo chỉ giữ URL/metadata.", "Mongo lưu toàn bộ ảnh."),
        ("35 hay 36?", "36 thực thể logic, 35 collection vật lý; hai lớp khác nhau.", "36 logic, 35 physical.", "Cả hai đều là số bảng vật lý."),
        ("MongoDB có FK không?", "Không có constraint FK server-side; source kiểm tra logical reference bằng relationshipErrors/assertValid.", "Không; app kiểm tra.", "Có 50 FK thật trong MongoDB."),
        ("Payment nối bảng nào?", "Nối Order qua orderId và User qua userId.", "Order và User.", "Chỉ Order."),
        ("Return Request nối gì?", "Nối Order, User và Payment; paymentId có thể nullable cho COD.", "Order, User, Payment.", "Luôn bắt buộc paymentId."),
    ]
    for q, good, short, bad in basics:
        groups["LEVEL 1 — Nhận biết"].append((q, good, short, bad))
    design = [
        ("Vì sao tách Order Item?", "Vì Order–Product là N:N có qty/price riêng và cần snapshot lịch sử.", "Junction có thuộc tính và snapshot.", "Vì SQL bắt buộc."),
        ("Vì sao không gộp Profile vào User?", "Identity/auth có vòng đời và quyền truy cập khác dữ liệu cá nhân hóa; profile là 0..1.", "Tách auth khỏi dữ liệu cá nhân hóa.", "Để có nhiều bảng hơn."),
        ("Vì sao Payment không đặt unique orderId?", "Một order có thể có nhiều attempt/retry; dữ liệu 94/94 không quyết định cardinality.", "Cho phép payment retry.", "Vì quên thêm index."),
        ("Vì sao địa chỉ vừa ở addresses vừa snapshot trong order?", "Address book là state hiện tại; order phải đóng băng nơi giao tại thời điểm mua.", "Sổ địa chỉ khác chứng từ.", "Duplicate vô nghĩa."),
        ("Vì sao màu/size không có collection?", "Tập giá trị hiện đóng/đọc cùng variant nên physical MongoDB nhúng; ERD vẫn biểu diễn lookup logic.", "Lookup logic được nhúng.", "Database bị thiếu bảng."),
        ("Vì sao reaction là entity?", "Quan hệ user–review có thuộc tính value và unique pair; counter không chỉ ra ai đã vote.", "Bridge có thuộc tính.", "Để tăng normal form."),
        ("Vì sao lưu price trong order_items?", "Đây là snapshot chứng từ, bảo toàn giá lúc mua khi catalog đổi.", "Giữ giá lịch sử.", "Không cần, join product là đủ."),
        ("Vì sao Banner không có FK?", "Nó là content vận hành độc lập trong ERD hiện tại; link/asset là dữ liệu, không có parent business entity đã xác minh.", "Content độc lập.", "Mọi bảng đều phải có FK."),
        ("Vì sao AI model không phải table?", "Model là service/runtime component; chỉ artifact cần lưu như ai_descriptions/tryon_history mới là entity.", "Service không phải dữ liệu nghiệp vụ.", "ERD không hỗ trợ AI."),
        ("Vì sao logical normalization khác physical MongoDB?", "Logical ERD giải thích thực thể/quan hệ; physical design chọn embed/snapshot theo vòng đời và read pattern.", "Hai lớp có mục tiêu khác.", "MongoDB không cần thiết kế."),
    ]
    groups["LEVEL 2 — Hiểu thiết kế"].extend(design)
    technical = [
        ("Có transaction MongoDB không?", "Không thấy startSession/withTransaction. Atomicity hiện tại dựa trên synchronous mutator trong một process; multi-instance phải đổi.", "Không; chỉ an toàn trong một process.", "Có vì update chạy cùng lúc."),
        ("Hai backend cùng đăng ký một email thì sao?", "App check có race; users.email hiện không unique. Production phải thêm unique index sau khi dọn dữ liệu.", "Có race; cần unique email.", "Code đã check nên tuyệt đối an toàn."),
        ("Hai khách mua món cuối cùng thì sao?", "Một process đã được test đúng; nhiều process cần atomic conditional decrement hoặc transaction MongoDB.", "Một process ổn, multi-instance chưa.", "JavaScript luôn chống được race."),
        ("Cascade được thực thi ở đâu?", "Không có Mongo cascade. Các mô tả cascade/restrict là policy ứng dụng; phải cài trong workflow và integrity check.", "Ở tầng ứng dụng, không ở Mongo.", "ERD tự cascade."),
        ("Index càng nhiều càng tốt?", "Không; runtime đọc state trong memory, index chủ yếu bảo đảm unique hoặc hỗ trợ query trực tiếp. Mỗi index làm tăng chi phí ghi.", "Chỉ thêm theo query/constraint.", "Có, thêm hết FK."),
        ("Review duplicate bị chặn tuyệt đối chưa?", "Chưa; app recheck nhưng Mongo thiếu unique `(userId,productId)`, nên multi-instance vẫn có race.", "Chưa; thiếu unique pair.", "Đã có orderId nên không thể trùng."),
        ("db.json có phải high availability?", "Không; là fallback demo, không tự merge ngược khi Mongo trở lại và có cửa sổ mất dữ liệu.", "Không, chỉ fallback cục bộ.", "Có hai database nên HA."),
        ("Một process chết trước flush 40ms thì sao?", "Thay đổi đã trả về có thể chưa persist; mức mất không nên khẳng định tuyệt đối một write vì debounce có thể gom nhiều update.", "Có cửa sổ mất write chưa flush.", "Không thể mất dữ liệu."),
        ("Soft delete ở đâu?", "Product dùng status archive/hidden/draft; chứng từ không hard-delete. Chưa có deletedAt thống nhất toàn schema.", "Theo status, chưa đồng nhất.", "Tất cả đều có deletedAt."),
        ("Có đạt 3NF tuyệt đối không?", "Logical model tách nhiều entity, nhưng snapshot/order, rating/sold và media arrays là denormalization có chủ đích/đánh đổi.", "Không tuyệt đối; có denormalization chủ đích.", "Có MongoDB nên không cần normal form."),
    ]
    groups["LEVEL 3 — Phản biện kỹ thuật"].extend(technical)
    dangerous = sorted(ENTITIES, key=lambda e: (TIER[e] != "S", TIER[e] != "A", e))[:18]
    for entity in dangerous:
        info = ENTITY_INFO[entity]
        groups["LEVEL 4 — Riêng trên JAPANO"].append((
            info["question"],
            f"[THỰC TẾ] {info['opener']} {info['scenario']} Điểm yếu: {info['weakness']} [ĐỀ XUẤT] {info['extension']}",
            info["opener"],
            "Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.",
        ))
    text = "# 10 — Bộ câu hỏi phản biện database\n\n> Tổng cộng **48 câu**. Công thức trả lời: kết luận → bằng chứng source/schema → giới hạn → hướng cải tiến.\n\n"
    n = 0
    for level, questions in groups.items():
        text += f"# {level}\n\n"
        for q, good, short, bad in questions:
            n += 1
            text += f"## Q{n:02d}\n\n" + qa_block(q, good, short, bad) + "\n"
    write("10_DEFENSE_QA.md", text)


def create_review():
    text = "# 11 — Database design review\n\n"
    review_rows = [
        ("1NF", "Phần lớn field scalar; arrays/object tồn tại theo document design", "Không tuyên bố relational 1NF tuyệt đối cho document nhúng"),
        ("2NF", "Junction có định danh riêng và thuộc tính phụ thuộc mapping", "Không có composite PK vật lý; uniqueness dùng compound index ở một số bảng"),
        ("3NF", "Master data tách category/product/detail/rule", "Snapshot order/payment và rating/sold là denormalization có chủ đích"),
        ("Junction", "order_items, cart_items, wishlist_items, reactions, redemptions", "Flagcard N:N dùng array thay junction collection"),
        ("Duplicate", "Order/item/payment snapshot bảo toàn lịch sử", "orders.items và order_items cần một source of truth rõ khi refactor"),
        ("Unique", "Variant/cart/wishlist/reaction/redemption có compound unique", "users.email, reviews(userId,productId), orders clientRequestId còn thiếu DB unique"),
        ("Nullable FK", "paymentId ở return cho COD; chat product context có thể thiếu", "Nên dùng schema validator theo workflow"),
        ("Index", "Có index theo id/FK/compound ở collection trọng yếu", "Runtime đọc memory nên không thêm hàng loạt index vô căn cứ"),
        ("Cascade", "Business workflow có clear/archive/restrict", "MongoDB không có cascade constraint"),
        ("Soft delete", "Product/status và transaction history được giữ", "Chưa có deletedAt/retention nhất quán"),
        ("Audit", "order history, refunds, return timeline, moderation sample", "Mảng history trong document chưa phải immutable audit log"),
        ("Transaction integrity", "Synchronous mutator + assertValid; tests một process", "Không transaction MongoDB, không an toàn multi-instance"),
    ]
    text += "| Hạng mục | Hiện trạng [THỰC TẾ] | Điểm có thể bị hỏi |\n|---|---|---|\n"
    text += "\n".join(f"| {a} | {b} | {c} |" for a, b, c in review_rows)
    text += "\n\n## Điểm có thể bị hội đồng hỏi\n\n"
    risks = [
        ("Email chưa unique ở database", "Trong một process app check trước khi insert; production nhiều instance phải dọn duplicate rồi thêm unique index."),
        ("Không dùng MongoDB transaction", "Phạm vi đồ án dùng state một process và có test concurrency; production cần direct collection writes/atomic condition/transaction."),
        ("Hai entity ảnh nhưng một collection", "Thừa nhận dấu vết logic cũ; runtime thống nhất ở product_media và nên gộp entity trong phiên bản sau."),
        ("Review chưa có unique pair", "Application recheck chưa phải lớp cuối; cần composite unique `(userId,productId)` theo rule hiện tại."),
        ("Fallback JSON", "Là phương án trình diễn, không phải HA; không auto-merge khi Mongo phục hồi."),
        ("Snapshot trùng dữ liệu", "Đây là immutable business snapshot, không phải anomaly; order cũ không được đổi theo catalog/user hiện tại."),
    ]
    for title, answer in risks:
        text += f"### {title}\n\n> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. {answer}\n\n"
    write("11_DATABASE_REVIEW.md", text)


def create_cheatsheet():
    inbound, outbound = Counter(), Counter()
    for c, p in RELATIONS:
        outbound[c] += 1; inbound[p] += 1
    top = sorted(ENTITIES, key=lambda e: inbound[e] + outbound[e], reverse=True)[:10]
    text = "# 12 — ERD Defense Cheatsheet\n\n# 10 TABLE PHẢI NHỚ\n\n| Table | Nhớ một câu |\n|---|---|\n"
    for entity in top:
        text += f"| {entity} | {esc(ENTITY_INFO[entity]['opener'])} |\n"
    text += "\n# 10 RELATIONSHIP PHẢI NHỚ\n\n| A | B | Quan hệ | Ý nghĩa |\n|---|---|---|---|\n"
    important = [0, 2, 7, 8, 9, 11, 13, 37, 39, 41]
    for idx in important:
        c, p, fk, card, meaning, _ = RELATION_DETAILS[idx]
        text += f"| {c} | {p} | {card} qua `{fk}` | {meaning} |\n"
    text += "\n# 8 FLOW PHẢI NHỚ\n\n"
    for f in sorted(FLOWS, key=lambda x: x["rank"]):
        text += f"{f['rank']}. **{f['name']}** — `{f['path']}`.\n"
    text += "\n# 10 CÂU PHẢN BIỆN NGUY HIỂM\n\n"
    dangers = [
        "35 hay 36?", "Có transaction MongoDB không?", "Hai backend cùng mua món cuối cùng?",
        "Vì sao lưu price/name/address hai nơi?", "Payment 94/94 có phải 1:1?",
        "MongoDB không có FK thì 50 dây là gì?", "Email/review duplicate chặn ở lớp nào?",
        "db.json có phải HA?", "Hai bảng ảnh có trùng không?", "Cascade/delete xử lý thế nào?",
    ]
    for i, item in enumerate(dangers, 1):
        text += f"{i}. {item}\n"
    text += "\n# 5 ĐIỂM THIẾT KẾ CẦN GIẢI THÍCH\n\n"
    for item in ["Logical 36 vs physical 35", "Variant là đơn vị kho", "Order Item là junction + snapshot", "Payment là attempt 1:N", "Integrity ở app, giới hạn một process"]:
        text += f"- **{item}**.\n"
    text += "\n# Nếu chỉ còn 5 phút trước khi bảo vệ thì học gì?\n\n1. Đọc `07_SCRIPT_OVERVIEW.md`.\n2. Học VERSION A trong `09_FULL_PRESENTATION.md`.\n3. Thuộc FLOW-03 checkout và FLOW-04 return.\n4. Thuộc 10 câu nguy hiểm phía trên.\n5. Nhớ câu trung thực: *source hiện tại chưa có transaction/constraint đó; production em đề xuất...*\n"
    write("12_CHEATSHEET.md", text)


def create_defense_map():
    text = "# 13 — ERD DEFENSE MAP\n\n## ① ERD TỔNG\n\n**Nói:**\n> 36 thực thể logic, 50 quan hệ; User và Product là hub, Order là trung tâm chứng từ.\n\n**Chỉ:** User · Product · Order\n\n↓\n\n"
    symbols = ["②", "③", "④", "⑤", "⑥", "⑦", "⑧"]
    for symbol, m in zip(symbols, MODULES):
        rels = module_relations(m)
        first = rels[0] if rels else None
        text += f"## {symbol} {m['id']} — {m['name']}\n\n**Nói:**\n> {ENTITY_INFO[m['center']]['opener']} {m['flow']}\n\n**Chỉ:**\n- {m['center']}\n"
        if first:
            text += f"- {first[0]} → {first[1]} qua `{first[2]}`\n"
        text += "\n↓\n\n"
    text += "## ⑨ END-TO-END CHECKOUT\n\n**Nói:**\n> User tạo Order; Order Item giữ dòng hàng và giá lịch sử; Payment giữ attempt và đối soát; Return Request giữ hậu mãi.\n\n**Chỉ:** User → Order → Order Item/Product → Payment → Return Request\n\n↓\n\n## ⑩ KẾT\n\n> Điểm mạnh là tách đúng master–mapping–transaction–history. Giới hạn là integrity hiện ở application và một process; production nhiều instance phải đưa unique, atomic update và transaction xuống MongoDB.\n"
    write("13_ERD_DEFENSE_MAP.md", text)


def create_readme():
    text = "# ERD Defense Package — JAPANO\n\n"
    text += f"> Sinh từ source/ERD và snapshot MongoDB kiểm tra ngày **{SNAPSHOT_DATE}**.\n\n"
    text += "## Đọc theo thứ tự\n\n1. [System context](01_SYSTEM_CONTEXT.md)\n2. [ERD audit](03_ERD_AUDIT.md)\n3. [ERD modules](04_ERD_MODULES.md)\n4. [Presentation map](05_PRESENTATION_MAP.md)\n5. [Full presentation](09_FULL_PRESENTATION.md)\n6. [Cheatsheet](12_CHEATSHEET.md)\n7. [Defense Q&A](10_DEFENSE_QA.md)\n\n"
    text += "## Toàn bộ tài liệu\n\n"
    files = [
        "00_SOURCE_INVENTORY.md", "01_SYSTEM_CONTEXT.md", "02_DATABASE_INVENTORY.md", "03_ERD_AUDIT.md",
        "04_ERD_MODULES.md", "05_PRESENTATION_MAP.md", "06_DATA_FLOWS.md", "07_SCRIPT_OVERVIEW.md",
        "08_SCRIPT_MODULES.md", "09_FULL_PRESENTATION.md", "10_DEFENSE_QA.md", "11_DATABASE_REVIEW.md",
        "12_CHEATSHEET.md", "13_ERD_DEFENSE_MAP.md",
    ]
    for f in files:
        text += f"- [{f}]({f})\n"
    text += "\n## Diagrams\n\n- [ERD tổng editable](diagrams/ERD-00-overview.drawio) · [PNG](diagrams/ERD-00-overview.png)\n"
    for m in MODULES:
        base = f"diagrams/{m['id']}-{m['slug']}"
        text += f"- {m['id']} — [{m['name']}]({base}.mmd) · [PNG]({base}.png)\n"
    text += "\n## Nếu chỉ muốn luyện thuyết trình\n\n1. `13_ERD_DEFENSE_MAP.md`\n2. `09_FULL_PRESENTATION.md`\n3. `12_CHEATSHEET.md`\n\n## Nếu muốn học để trả lời phản biện\n\n1. `02_DATABASE_INVENTORY.md`\n2. `03_ERD_AUDIT.md`\n3. `11_DATABASE_REVIEW.md`\n4. `10_DEFENSE_QA.md`\n\n## Tái sinh gói\n\n```bash\npython3 docs/erd-defense/tools/build_erd_defense.py\n```\n\nScript chỉ ghi trong `docs/erd-defense/`. Muốn cập nhật snapshot live, chạy các công cụ read-only đã ghi trong `00_SOURCE_INVENTORY.md` trước.\n"
    write("README.md", text)


def validate():
    required = [f"{i:02d}_{name}.md" for i, name in []]  # documentation marker
    expected = [
        "00_SOURCE_INVENTORY.md", "01_SYSTEM_CONTEXT.md", "02_DATABASE_INVENTORY.md", "03_ERD_AUDIT.md",
        "04_ERD_MODULES.md", "05_PRESENTATION_MAP.md", "06_DATA_FLOWS.md", "07_SCRIPT_OVERVIEW.md",
        "08_SCRIPT_MODULES.md", "09_FULL_PRESENTATION.md", "10_DEFENSE_QA.md", "11_DATABASE_REVIEW.md",
        "12_CHEATSHEET.md", "13_ERD_DEFENSE_MAP.md", "README.md",
    ]
    missing = [name for name in expected if not (OUT / name).is_file()]
    assert not missing, missing
    assert len(ENTITIES) == 36 and len(RELATIONS) == 50 and len(DB) == 35
    qa = (OUT / "10_DEFENSE_QA.md").read_text(encoding="utf-8")
    assert len(re.findall(r"^## Q\d+", qa, re.M)) >= 40
    for m in MODULES:
        base = DIAGRAMS / f"{m['id']}-{m['slug']}"
        assert base.with_suffix(".mmd").is_file()
        assert base.with_suffix(".png").is_file()
    manifest = {
        "snapshot": SNAPSHOT_DATE,
        "logicalEntities": len(ENTITIES), "logicalRelationships": len(RELATIONS),
        "physicalCollections": len(DB), "documents": sum(v["count"] for v in DB.values()),
        "modules": len(MODULES), "flows": len(FLOWS),
        "qaQuestions": len(re.findall(r"^## Q\d+", qa, re.M)),
        "validation": "PASS",
    }
    (OUT / "tools" / "validation_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    create_inventory()
    create_context()
    create_database_inventory()
    create_erd_audit()
    create_modules()
    create_diagrams()
    create_presentation_map()
    create_data_flows()
    create_overview_script()
    create_module_scripts()
    create_full_presentation()
    create_qa()
    create_review()
    create_cheatsheet()
    create_defense_map()
    create_readme()
    validate()


if __name__ == "__main__":
    main()
