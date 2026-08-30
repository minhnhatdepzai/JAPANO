# Danh mục collection MongoDB — 2026-08-29

Atlas «japano» · snapshot 2026-08-29T01:32:56 · **29 collection**, 2122 document.

Phân lớp theo `.claude/skills/japano-mongodb-erd/SKILL.md`. Không có URI hay credential trong tài liệu này.

| Collection | Doc | dataSize | storage | index | idx | Doc mới nhất | Lớp |
|---|---:|---:|---:|---:|---:|---|---|
| `interactions` | 671 | 120,862 | 118,784 | 81,920 | 1 | 2026-08-15 | G — log tăng nhanh |
| `product_variants` | 497 | 89,273 | 98,304 | 274,432 | 5 | — | A — nghiệp vụ lõi |
| `order_items` | 154 | 43,617 | 53,248 | 147,456 | 4 | — | A — nghiệp vụ lõi |
| `product_media` | 151 | 31,008 | 45,056 | 110,592 | 3 | — | H — chỉ URL + metadata |
| `orders` | 94 | 67,494 | 69,632 | 147,456 | 4 | 2026-08-11 | A — nghiệp vụ lõi |
| `payments` | 94 | 44,450 | 53,248 | 147,456 | 4 | 2026-08-11 | B — sổ chứng từ |
| `review_reactions` | 88 | 18,696 | 36,864 | 110,592 | 3 | 2026-08-01 | A — nghiệp vụ lõi |
| `products` | 71 | 75,026 | 69,632 | 147,456 | 4 | 2026-08-26 | A — nghiệp vụ lõi |
| `chats` | 68 | 22,441 | 45,056 | 36,864 | 1 | 2026-08-13 | G — log tăng nhanh |
| `notifications` | 46 | 13,904 | 45,056 | 36,864 | 1 | 2026-08-13 | G — log tăng nhanh |
| `users` | 36 | 10,319 | 36,864 | 110,592 | 3 | — | A — nghiệp vụ lõi |
| `reviews` | 31 | 17,915 | 45,056 | 184,320 | 5 | 2026-08-07 | A — nghiệp vụ lõi |
| `wishlist_items` | 13 | 2,143 | 36,864 | 110,592 | 3 | 2026-08-10 | A — nghiệp vụ lõi |
| `search_logs` | 13 | 2,287 | 36,864 | 36,864 | 1 | 2026-08-13 | G — log tăng nhanh |
| `profiles` | 12 | 3,294 | 36,864 | 73,728 | 2 | 2026-08-10 | A — nghiệp vụ lõi |
| `addresses` | 11 | 4,165 | 36,864 | 110,592 | 3 | 2026-08-10 | A — nghiệp vụ lõi |
| `return_requests` | 8 | 7,409 | 36,864 | 184,320 | 5 | 2026-08-07 | B — sổ chứng từ |
| `goals` | 8 | 23,058 | 45,056 | 36,864 | 1 | 2026-08-10 | A — nghiệp vụ lõi |
| `flagcards` | 7 | 11,912 | 45,056 | 36,864 | 1 | — | A — nghiệp vụ lõi |
| `settings` | 6 | 1,459 | 36,864 | 36,864 | 1 | — | C — cấu hình (đã nhận banners + discount_rules) |
| `moderation_samples` | 6 | 1,460 | 36,864 | 36,864 | 1 | 2026-08-13 | A — nghiệp vụ lõi |
| `japan_spot_suggestions` | 5 | 1,997 | 36,864 | 36,864 | 1 | 2026-08-13 | A — nghiệp vụ lõi |
| `japan_spot_reviews` | 5 | 2,173 | 36,864 | 36,864 | 1 | 2026-08-09 | A — nghiệp vụ lõi |
| `categories` | 5 | 416 | 36,864 | 73,728 | 2 | — | A — nghiệp vụ lõi |
| `voucher_redemptions` | 5 | 1,182 | 36,864 | 184,320 | 5 | — | B — sổ chứng từ |
| `cart_items` | 5 | 1,281 | 36,864 | 110,592 | 3 | 2026-08-13 | G — trạng thái tạm |
| `push_tokens` | 4 | 990 | 36,864 | 110,592 | 3 | 2026-08-13 | A — nghiệp vụ lõi |
| `flagcard_collections` | 4 | 1,564 | 36,864 | 36,864 | 1 | 2026-08-04 | A — nghiệp vụ lõi |
| `vouchers` | 4 | 876 | 36,864 | 110,592 | 3 | 2026-08-07 | A — nghiệp vụ lõi |

## Đã gộp hoặc bỏ trong migration 2026-08-29

| Collection cũ | Doc | Đi đâu |
|---|---:|---|
| `product_details` | 71 | nhúng vào `products` |
| `banners` | 3 | `settings/_id=banners` |
| `discount_rules` | 3 | `settings/_id=discount_rules` |
| `vip_memberships` | 6 | suy ra từ `orders` bằng `reconcileVipState` |
| `ai_descriptions` | 8 | cache RAM trong `routes/catalog.js` |

Backup: `backend/data/migration-backups/2026-08-28T21-50-28-528Z__*` (gzip, quyền 0600, kèm manifest SHA-256).
Rollback: `node scripts/restore_lean_backup.js 2026-08-28T21-50-28-528Z --restore`.

Chi tiết sự cố mất dữ liệu trong lúc migration: `MONGODB_STORAGE_AUDIT_2026-08-29.md`.
