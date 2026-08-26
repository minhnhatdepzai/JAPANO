# ERD Defense Package — JAPANO

> Sinh từ source/ERD và snapshot MongoDB kiểm tra ngày **20/08/2026 22:33 +07**.

## Đọc theo thứ tự

1. [System context](01_SYSTEM_CONTEXT.md)
2. [ERD audit](03_ERD_AUDIT.md)
3. [ERD modules](04_ERD_MODULES.md)
4. [Presentation map](05_PRESENTATION_MAP.md)
5. [Full presentation](09_FULL_PRESENTATION.md)
6. [Cheatsheet](12_CHEATSHEET.md)
7. [Defense Q&A](10_DEFENSE_QA.md)

## Toàn bộ tài liệu

- [00_SOURCE_INVENTORY.md](00_SOURCE_INVENTORY.md)
- [01_SYSTEM_CONTEXT.md](01_SYSTEM_CONTEXT.md)
- [02_DATABASE_INVENTORY.md](02_DATABASE_INVENTORY.md)
- [03_ERD_AUDIT.md](03_ERD_AUDIT.md)
- [04_ERD_MODULES.md](04_ERD_MODULES.md)
- [05_PRESENTATION_MAP.md](05_PRESENTATION_MAP.md)
- [06_DATA_FLOWS.md](06_DATA_FLOWS.md)
- [07_SCRIPT_OVERVIEW.md](07_SCRIPT_OVERVIEW.md)
- [08_SCRIPT_MODULES.md](08_SCRIPT_MODULES.md)
- [09_FULL_PRESENTATION.md](09_FULL_PRESENTATION.md)
- [10_DEFENSE_QA.md](10_DEFENSE_QA.md)
- [11_DATABASE_REVIEW.md](11_DATABASE_REVIEW.md)
- [12_CHEATSHEET.md](12_CHEATSHEET.md)
- [13_ERD_DEFENSE_MAP.md](13_ERD_DEFENSE_MAP.md)

## Diagrams

- [ERD tổng editable](diagrams/ERD-00-overview.drawio) · [PNG](diagrams/ERD-00-overview.png)
- ERD-01 — [Danh mục, sản phẩm và biến thể](diagrams/ERD-01-product-catalog.mmd) · [PNG](diagrams/ERD-01-product-catalog.png)
- ERD-02 — [Media và nội dung sản phẩm tạo bởi AI](diagrams/ERD-02-media-and-ai-content.mmd) · [PNG](diagrams/ERD-02-media-and-ai-content.png)
- ERD-03 — [Người dùng và ý định mua sắm](diagrams/ERD-03-user-and-shopping.mmd) · [PNG](diagrams/ERD-03-user-and-shopping.png)
- ERD-04 — [Đơn hàng, thanh toán và trả hàng](diagrams/ERD-04-order-payment-return.mmd) · [PNG](diagrams/ERD-04-order-payment-return.png)
- ERD-05 — [Khuyến mãi, VIP và Flagcard](diagrams/ERD-05-promotion-and-loyalty.mmd) · [PNG](diagrams/ERD-05-promotion-and-loyalty.png)
- ERD-06 — [Đánh giá và kiểm duyệt](diagrams/ERD-06-review-and-moderation.mmd) · [PNG](diagrams/ERD-06-review-and-moderation.png)
- ERD-07 — [Hành vi, AI và vận hành nội dung](diagrams/ERD-07-behavior-ai-and-operations.mmd) · [PNG](diagrams/ERD-07-behavior-ai-and-operations.png)

## Nếu chỉ muốn luyện thuyết trình

1. `13_ERD_DEFENSE_MAP.md`
2. `09_FULL_PRESENTATION.md`
3. `12_CHEATSHEET.md`

## Nếu muốn học để trả lời phản biện

1. `02_DATABASE_INVENTORY.md`
2. `03_ERD_AUDIT.md`
3. `11_DATABASE_REVIEW.md`
4. `10_DEFENSE_QA.md`

## Tái sinh gói

```bash
python3 docs/erd-defense/tools/build_erd_defense.py
```

Script chỉ ghi trong `docs/erd-defense/`. Muốn cập nhật snapshot live, chạy các công cụ read-only đã ghi trong `00_SOURCE_INVENTORY.md` trước.
