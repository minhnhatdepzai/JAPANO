// So sánh truy hồi sản phẩm: tìm theo TỪ KHOÁ và tìm theo NGỮ NGHĨA.
//
// Báo cáo có khẳng định tìm kiếm ngữ nghĩa giúp truy hồi được cả những truy vấn
// không trùng từ khoá. Kịch bản này kiểm chứng khẳng định đó bằng số liệu trên
// một bộ truy vấn gán nhãn thủ công, thay vì nói suông.
//
// Baseline từ khoá dựng lại đúng cách so khớp mà một cửa hàng thường dùng:
// chuẩn hoá bỏ dấu, tách từ, tính điểm theo số từ khoá trùng trên tên, danh mục
// và thẻ của sản phẩm.
//
// Cách dùng: node backend/scripts/benchmark-semantic-search.js
// Yêu cầu: embedding_service.py đang chạy (JAPANO_EMBEDDING_URL).
const fs = require('fs');
const path = require('path');
const { cosineSimilarity, productText } = require('../lib/embeddings');
const { EMBEDDING_URL } = require('../lib/serviceUrls');

// Gọi thẳng dịch vụ nhúng: đây là kịch bản đo độc lập, không nên phụ thuộc vào
// lớp cache trong tiến trình máy chủ (cache sẽ làm sai lệch phép đo thời gian).
async function embedTexts(texts) {
  const res = await fetch(`${EMBEDDING_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) throw new Error(`Embedding service HTTP ${res.status}`);
  const data = await res.json();
  return data.embeddings;
}

const ROOT = path.join(__dirname, '..', '..');
const DATASET = path.join(ROOT, 'tests', 'ai', 'semantic_search_dataset.json');
const OUT = path.join(ROOT, 'docs', 'project_evidence', 'ai_benchmarks', 'semantic_search.json');
const K = 5;

function deaccent(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function tokens(text) {
  return deaccent(text).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/** Baseline: đếm số từ khoá của truy vấn xuất hiện trong tên, danh mục và thẻ. */
function keywordRank(query, products) {
  const qs = tokens(query);
  return products
    .map((product) => {
      const hay = tokens(productText(product));
      const set = new Set(hay);
      let score = 0;
      for (const term of qs) {
        if (set.has(term)) score += 2;
        else if (hay.some((word) => word.startsWith(term) || term.startsWith(word))) score += 1;
      }
      return { slug: product.slug, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.slug);
}

function semanticRank(queryVector, productVectors) {
  return productVectors
    .map((row) => ({ slug: row.slug, score: cosineSimilarity(queryVector, row.vector) }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.slug);
}

function metrics(ranked, relevant, k) {
  const rel = new Set(relevant);
  const topK = ranked.slice(0, k);
  const hit1 = ranked.length && rel.has(ranked[0]) ? 1 : 0;
  const hitK = topK.some((slug) => rel.has(slug)) ? 1 : 0;
  const found = topK.filter((slug) => rel.has(slug)).length;
  const precision = found / k;
  const recall = relevant.length ? found / relevant.length : 0;
  let rr = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    if (rel.has(ranked[i])) { rr = 1 / (i + 1); break; }
  }
  return { hit1, hitK, precision, recall, rr };
}

function summarise(rows) {
  const n = rows.length || 1;
  const avg = (key) => Number((rows.reduce((sum, r) => sum + r[key], 0) / n).toFixed(4));
  return {
    queries: rows.length,
    hitRate1: avg('hit1'),
    [`hitRate${K}`]: avg('hitK'),
    [`precision${K}`]: avg('precision'),
    [`recall${K}`]: avg('recall'),
    mrr: avg('rr'),
  };
}

(async () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'db.json'), 'utf8'));
  const products = (db.products || []).filter((p) => p.slug);
  console.log(`  ${products.length} sản phẩm · ${dataset.queries.length} truy vấn · K=${K}`);

  const t0 = Date.now();
  const productVecs = await embedTexts(products.map(productText));
  const embedMs = Date.now() - t0;
  if (!productVecs || !productVecs.length) {
    console.error('  ✗ Không lấy được vector — embedding_service.py có đang chạy không?');
    process.exit(1);
  }
  const productVectors = products.map((p, i) => ({ slug: p.slug, vector: productVecs[i] }));

  const t1 = Date.now();
  const queryVecs = await embedTexts(dataset.queries.map((q) => q.query));
  const queryMs = Date.now() - t1;

  const kwRows = [];
  const semRows = [];
  const perQuery = [];
  for (let i = 0; i < dataset.queries.length; i += 1) {
    const { query, relevantProductIds } = dataset.queries[i];
    const kwRanked = keywordRank(query, products);
    const semRanked = semanticRank(queryVecs[i], productVectors);
    const kw = metrics(kwRanked, relevantProductIds, K);
    const sem = metrics(semRanked, relevantProductIds, K);
    kwRows.push(kw);
    semRows.push(sem);
    perQuery.push({
      query,
      relevant: relevantProductIds,
      keywordTop: kwRanked.slice(0, K),
      semanticTop: semRanked.slice(0, K),
      keywordHitK: kw.hitK,
      semanticHitK: sem.hitK,
    });
  }

  const keyword = summarise(kwRows);
  const semantic = summarise(semRows);
  const noKeywordMatch = perQuery.filter((r) => r.keywordTop.length === 0).length;

  console.log(`\n  ${'chỉ số'.padEnd(14)} ${'từ khoá'.padStart(10)} ${'ngữ nghĩa'.padStart(11)}`);
  for (const key of ['hitRate1', `hitRate${K}`, `precision${K}`, `recall${K}`, 'mrr']) {
    console.log(`  ${key.padEnd(14)} ${String(keyword[key]).padStart(10)} ${String(semantic[key]).padStart(11)}`);
  }
  console.log(`\n  truy vấn không có từ khoá nào khớp: ${noKeywordMatch}/${dataset.queries.length}`);
  console.log(`  thời gian nhúng ${products.length} sản phẩm: ${embedMs} ms`);
  console.log(`  thời gian nhúng ${dataset.queries.length} truy vấn: ${queryMs} ms`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: process.env.JAPANO_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    k: K,
    products: products.length,
    limitation: dataset.limitation,
    embedProductsMs: embedMs,
    embedQueriesMs: queryMs,
    queriesWithNoKeywordMatch: noKeywordMatch,
    keyword,
    semantic,
    perQuery,
  }, null, 2));
  console.log('\n  → đã ghi', OUT);
})();
