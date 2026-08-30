const test = require('node:test');
const assert = require('node:assert/strict');

const { persistStateToCollections } = require('../lib/mongoCollections');

/**
 * Mongo giả có ĐÚNG một hành vi thật sự quan trọng: một unique index.
 *
 * Nó ghi lại thứ tự thao tác và ném E11000 khi có hai document khác `_id` cùng
 * khoá {productId, colorName, size} — giống hệt uq_product_variants_selection
 * trên Atlas.
 */
function fakeDbWithUniqueIndex(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, [...v]]));
  const operations = [];
  const keyOf = (doc) => `${doc.productId}|${doc.colorName ?? null}|${doc.size}`;

  return {
    operations,
    dump: (name) => store.get(name) || [],
    collection: (name) => {
      if (!store.has(name)) store.set(name, []);
      const rows = () => store.get(name);
      return {
        deleteMany: async (filter) => {
          operations.push({ name, op: 'deleteMany' });
          const keep = filter?._id?.$nin;
          store.set(name, keep ? rows().filter((r) => keep.includes(r._id)) : []);
        },
        bulkWrite: async (ops) => {
          operations.push({ name, op: 'bulkWrite' });
          for (const entry of ops) {
            const doc = entry.replaceOne.replacement;
            if (name === 'product_variants') {
              const clash = rows().find((r) => r._id !== doc._id && keyOf(r) === keyOf(doc));
              if (clash) {
                const error = new Error(`E11000 duplicate key error collection: japano.${name} index: uq_product_variants_selection dup key: { productId: "${doc.productId}", colorName: null, size: "${doc.size}" }`);
                error.code = 11000;
                throw error;
              }
            }
            const index = rows().findIndex((r) => r._id === doc._id);
            if (index >= 0) rows()[index] = doc; else rows().push(doc);
          }
        },
      };
    },
  };
}

function stateWithVariant(variantId, sku) {
  return {
    products: [{
      id: 'jp1', slug: 'jp1', name: 'Kimono', categoryId: 'ao-truyen-thong', price: 100,
      variants: [{ ...(variantId ? { id: variantId } : {}), sku, size: 'S', colorName: 'Mặc định', stock: 3 }],
    }],
    categories: [{ id: 'ao-truyen-thong', name: 'Áo truyền thống' }],
    orders: [], users: [], payments: [], vouchers: [], voucherRedemptions: [],
  };
}

// Lỗi thật: Atlas giữ biến thể dưới `_id` cũ `variant-jp1-0`, còn serializer nay
// sinh `variant-jp1-JP001-DEF-S`. Hai `_id` khác nhau, CÙNG khoá unique. Upsert
// trước rồi mới xoá thì bản mới đụng bản cũ — thứ đằng nào cũng bị xoá ngay sau
// đó — và E11000 làm hỏng cả lượt ghi, khiến backend treo lúc khởi động.
test('đổi quy ước _id không được làm hỏng lượt ghi', async () => {
  const db = fakeDbWithUniqueIndex({
    product_variants: [{ _id: 'variant-jp1-0', id: 'variant-jp1-0', productId: 'jp1', size: 'S', colorName: 'Mặc định', position: 0 }],
  });
  await persistStateToCollections(db, stateWithVariant(null, 'JP001-DEF-S'));

  const rows = db.dump('product_variants');
  assert.equal(rows.length, 1, 'phải còn đúng một biến thể');
  assert.equal(rows[0]._id, 'variant-jp1-JP001-DEF-S', 'biến thể phải mang _id mới');
});

test('xoá document thừa phải chạy TRƯỚC upsert', async () => {
  const db = fakeDbWithUniqueIndex({ product_variants: [] });
  await persistStateToCollections(db, stateWithVariant(null, 'JP001-DEF-S'));

  const variantOps = db.operations.filter((o) => o.name === 'product_variants').map((o) => o.op);
  assert.deepEqual(variantOps, ['deleteMany', 'bulkWrite'],
    `thứ tự sai: ${variantOps.join(' → ')} — upsert trước sẽ đụng chính document sắp bị xoá`);
});

test('ghi hai lần liên tiếp cho cùng kết quả (idempotent)', async () => {
  const db = fakeDbWithUniqueIndex({ product_variants: [] });
  const state = stateWithVariant(null, 'JP001-DEF-S');
  await persistStateToCollections(db, state);
  const first = JSON.stringify(db.dump('product_variants'));
  await persistStateToCollections(db, state);
  assert.equal(JSON.stringify(db.dump('product_variants')), first);
});
