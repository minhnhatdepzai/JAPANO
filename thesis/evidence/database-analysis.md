# Evidence: Database and Data Persistence Model

Status: verified directly against `backend/lib/store.js`, `backend/seed.js`, `backend/lib/mongo.js`, the live `backend/data/db.json`, and the 5 SQL/DBML files at the repo root. A prior draft report claimed a fully normalized MongoDB/Mongoose schema (separate `Users`, `Products`, `ProductVariants`, `Cart`, `Orders`, `OrderItems`, `Payments` collections). **This claim is false.** The verified reality is documented below.

## 1. Primary persistence mechanism: a single JSON file, atomic writes

- `backend/lib/store.js:62-84` (`createStore`): `write(state)` normalizes the state, writes to a temp file `${resolved}.${pid}.tmp`, then `fs.renameSync`s it into place (atomic write), then fires off an async Mongo mirror (non-blocking). `read()` parses the file; on missing/corrupt file it seeds fresh state and writes it.
- File path resolution: `backend/server.js:49-50` — `DATA_DIR = path.join(__dirname, 'data')`, `DB_FILE = process.env.JAPANO_DATA_FILE || path.join(DATA_DIR, 'db.json')`. So the file is `backend/data/db.json` unless overridden by env var (`.env.example` documents `JAPANO_DATA_FILE`).
- Confirmed on disk: `backend/data/db.json` exists, **363,130 bytes**, last modified 2026-07-24. Its top-level keys are an **exact match** (all 34 keys, same names) to `emptyState()` in `backend/seed.js:85-122` — direct proof it is that JS object literally serialized to disk.

## 2. MongoDB is an optional single-document mirror, not per-entity storage

`backend/lib/store.js:7-12` (code comment, own words): *"MongoDB, when `MONGODB_URI` is configured, becomes a shared durable store … This is a 'mirror' of the existing state as ONE single document — keeping the sync read/write/update API every route already uses, without rewriting to per-collection queries (a much bigger refactor, left for later)."*

- `store.js:13-14`: `MONGO_COLLECTION = 'app_state'`, `MONGO_DOC_ID = 'main'`.
- `store.js:30-39` (`persistToMongoAsync`): `db.collection('app_state').replaceOne({_id:'main'}, {_id:'main', ...state, _syncedAt: Date.now()}, {upsert:true})` — replaces one whole document with the entire current state blob, async, fire-and-forget, errors only logged.
- `store.js:149-162` (`hydrateFromMongoIfNewer`): runs once at boot before the server listens (`server.js:299-303`); only overwrites the local file if Mongo's blob is strictly newer (by max `createdAt` heuristic), guarding against an empty/stale Mongo wiping local data.
- `backend/lib/mongo.js` (39 lines, full file): uses `const { MongoClient } = require('mongodb')` — the **official raw MongoDB driver**, not an ODM. Exposes only `getDb()`, `mongoEnabled()`, `mongoHealth()`.
- `backend/package.json` dependencies include `mongodb` but **not** `mongoose`.

## 3. Zero Mongoose usage anywhere in the repository (verified)

- `grep -rn "mongoose.Schema\|mongoose\.model\|new Schema("` across the whole repo (excluding `node_modules`): 0 matches.
- Case-insensitive `grep -rlI -i "mongoose"` across the entire repo including `package-lock.json`: 0 matches.
- `backend/node_modules` has no `mongoose`/`sqlite`/`mysql`/`pg` package directories.

**Likely source of the false "Mongoose models" claim:** `backend/models/` exists and contains exactly one file — `yolov8n-pose.pt` (6.8 MB), a PyTorch/Ultralytics YOLOv8 pose-estimation checkpoint used by the Python try-on pipeline (see `README.md:186`, `backend/pose_reposer.py`). It has nothing to do with data models; a prior pass likely saw a directory literally named `models/` and fabricated "Mongoose models" from the name alone without opening it.

## 4. Two narrow, real per-collection Mongo usages exist (precise exception to #2)

1. **`backend/routes/japanSpots.js:34-163`** — community Japan-spot reviews/suggestions. When Mongo is enabled, reads/writes go to two genuinely separate real collections: `db.collection('japanSpotReviews')` and `db.collection('japanSpotSuggestions')` (still via the raw driver, no schema). Falls back to the same-named arrays inside the JSON blob when Mongo is off (`japanSpots.js:30-33` comment, lines 44-45/82-86 fallback code).
2. **`backend/routes/catalog.js:23`** — read-only `db.collection('products').find({})`, used only to overlay Cloudinary image URLs onto product data (lines 24-29, 45, 48); price/variants/stock/status still come from the JSON blob. Populated by a separate manual script, `backend/scripts/syncProductsToCloud.js`, which upserts only a partial cache (`slug, name, cat, price, images[Cloudinary URLs], updatedAt` — not a full product record). `catalog.js:15` comment: *"MongoDB chỉ giữ URL/id, không giữ dữ liệu ảnh"* ("MongoDB only holds the URL/id, not the image data").
3. **`backend/scripts/syncStateToMongo.js`** (48 lines) — a standalone, manually-run script (confirmed not invoked anywhere in `server.js`, any route, or any `package.json` script) that *would* explode each top-level array of `db.json` into its own real Mongo collection if a developer runs it by hand. Not part of the running server's behavior.

## 5. `backend/seed.js` state shape — all 34 top-level keys

```
seeded, schemaVersion, shop, integrations, categories, products, orders, payments,
returnRequests, carts, reviews, reviewReactions, moderationSamples, users, addresses,
wishlists, notifications, vouchers, flagcards, flagcardCollections, vipMemberships,
flagcardConfig, voucherRedemptions, banners, interactions, searchLogs, pushTokens,
profiles, chats, tryonHistory, goals, aiDescriptions, japanSpotReviews, japanSpotSuggestions
```
(`backend/seed.js:85-122`, cross-verified identical against the live `db.json`'s actual keys.)

### Product record shape (`seed.js:146-173`, real admin-write path `backend/routes/catalog.js:111-145`)
```
id, slug, name, kanji, sku, cat, category, brand, price, old, sale, discountPercent,
status, colorHex, rating, sold, tags[], visualTags[], desc, story, image, images[],
videos[], variants[] (colorName, colorHex, size, sku, stock), createdAt,
ownerId (set on admin-managed products, catalog.js:133), updatedAt (catalog.js:140)
```
`publicProduct()` (`catalog.js:39-60`) recomputes `rating`/`reviewCount`/`sold` at read time from `state.reviews`/`state.orders` rather than trusting stored values.

### Order record shape (real construction, `backend/routes/orders.js:149-179`)
```
id, code, userId, clientRequestId, customer{id,name,phone}, address, addressDetails,
items[](productId, slug, name, colorName, colorHex, size, qty, price), subtotal,
discount, voucherDiscount, paymentDiscount, vipDiscount, vipPromotion, paymentPromotion,
discountCode, total, ship, payment{method,provider,status,txn,currency}, status,
createdAt, history[]({s, at}), source, (optional) voucherRedemption
```

### User record shape (real registration, `backend/routes/auth.js:46-51`)
```
id, name, email, role, status, orders(count), spent, tryons, vip, joinedAt,
passwordHash (bcrypt, added on real registration — auth.js:48)
```
Note: seed/demo users in `seed.js` have no `passwordHash` field at all — only genuinely self-registered users do.

## 6. The 5 SQL/DBML files at repo root are design/export artifacts, never wired to the running app

| File | Generator | Nature |
|---|---|---|
| `japano_erd.dbml`, `japano_erd.sql`, `japano_erd_sqlite.sql` | `backend/scripts/exportMysqlErd.js` (reads live `backend/data/db.json`, line 10) | **Auto-generated documentation export** of the actual JSON shape as 44 `CREATE TABLE` statements + real data as `INSERT`s. The file itself says so: `japano_erd.dbml:26` — *"Metadata của object app_state; không phải bảng SQL vật lý của runtime"* ("metadata of the app_state object; NOT a physical SQL table of the runtime"). |
| `japano_schema_v2.sql`, `japano_schema_v2_sqlite.sql` | `backend/scripts/buildErdV2.js` (hand-authored table DSL, confirmed zero `db.json` reads) | A **hand-designed, hypothetical normalized redesign** (47 `CREATE TABLE` statements: `product_variants`, `product_images`, `order_items`, `order_status_history`, `refunds`, `inventory_movements`, etc.), explicitly described in its own generator's comment as fixing "11 groups of reviewed design flaws" versus the JSON shape — a real design artifact, but never connected to a running database. |

Confirmed no backend code imports, executes, or connects to any of these 5 files: no SQL driver dependency exists (`sqlite|postgres|pg|mysql` absent from `backend/package.json` and `node_modules`); the only repo references to these filenames are the two generator scripts (which *write* them) and `README.md:518-523` under a section titled "ERD và schema tham khảo" (ERD and schema reference).

## Honest summary for thesis use

- **What actually runs:** `backend/data/db.json` (atomic-write JSON file) is the sole source of truth read/written by every request the live server handles. MongoDB, when configured, mirrors the entire state as one document (`app_state`/`main`) for durability across restarts/multiple machines — it is not a normalized database and uses no ODM.
- **What is design work, honestly presented as such:** the team produced a genuine, fairly detailed *normalized relational schema design* (`japano_schema_v2.sql` and its SQLite variant) as a separate design artifact — this is legitimate material for a thesis's "database design" chapter, but it must be presented as a **design/analysis deliverable**, not as the technology the deployed system runs on.
- **What must not be claimed:** that MongoDB/Mongoose is the primary database, that Users/Products/Orders/Payments exist as separate normalized Mongo collections in the running system, or that the SQL schema files are connected to a live database.
