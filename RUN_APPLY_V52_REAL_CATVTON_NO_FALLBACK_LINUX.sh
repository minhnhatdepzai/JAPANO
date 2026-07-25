#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

PROJECT_SERVER="$ROOT/server/index.mjs"
CATVTON_DIR="/home/nhat/jp/ai/CatVTON"
CATVTON_API="$CATVTON_DIR/japano_catvton_simple_web.py"

echo "=== JAPANO V52 REAL CATVTON CONNECTOR - NO FALLBACK PREVIEW ==="
echo "Mục tiêu: app JAPANO gọi CatVTON thật ở port 7861. Nếu CatVTON chưa chạy thì báo lỗi, KHÔNG tạo preview giả nữa."

if [ ! -f "$PROJECT_SERVER" ]; then
  echo "[ERROR] Không thấy server/index.mjs. Hãy copy zip này vào /home/nhat/Downloads/v37 rồi chạy."
  exit 1
fi

mkdir -p "$CATVTON_DIR"
cp -f "$ROOT/japano_catvton_simple_web.py" "$CATVTON_API"
echo "[OK] Đã copy CatVTON API: $CATVTON_API"

python3 - <<'PY'
from pathlib import Path
import time

server = Path('server/index.mjs')
s = server.read_text(encoding='utf-8')
backup = server.with_suffix('.mjs.bak-v52-real-catvton-%d' % int(time.time()))
backup.write_text(s, encoding='utf-8')

BLOCK = r'''
// ================= JAPANO V52 REAL CATVTON CONNECTOR START =================
// This route must be BEFORE V50. It disables fake Pillow preview for this endpoint.
// It calls the real CatVTON API at JAPANO_CATVTON_URL=http://127.0.0.1:7861.

async function v52FindProductByAnyIdSafe(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  try {
    if (typeof v49FindProductByAnyId === 'function') {
      const p = await v49FindProductByAnyId(key);
      if (p) return p;
    }
  } catch {}
  try {
    if (/^[a-f0-9]{24}$/i.test(key)) {
      const p = await Product.findById(key).lean();
      if (p) return p;
    }
  } catch {}
  try {
    const p = await Product.findOne({ $or: [{ id: key }, { sku: key }, { slug: key }, { name: key }] }).lean();
    if (p) return p;
  } catch {}
  return null;
}

function v52FirstImage(product = {}) {
  const p = product || {};
  if (Array.isArray(p.images) && p.images[0]) {
    const first = p.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || p.photo || '';
}

function v52DataUriToBuffer(data = '') {
  const text = String(data || '');
  const base64 = text.includes(',') ? text.split(',').pop() : text;
  return Buffer.from(base64 || '', 'base64');
}

function v52BufferToDataUri(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

async function v52DownloadImage(url, fallbackName = 'shop-image.jpg') {
  if (!url || !/^https?:\/\//i.test(String(url))) throw new Error(`Sản phẩm shop chưa có link ảnh hợp lệ: ${fallbackName}`);
  const fetched = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 30 * 1024 * 1024 });
  const mimeType = String(fetched.headers['content-type'] || 'image/jpeg').split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('Ảnh sản phẩm shop không hợp lệ.');
  return { buffer: Buffer.from(fetched.data), mimeType, sourceUrl: url };
}

function v52GuessClothType(p = {}) {
  const t = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
  if (/(đầm|dam|dress|overall|jumpsuit|váy liền|vay lien|set bộ|set bo|outfit)/i.test(t)) return 'overall';
  if (/(quần|quan|pants|jeans|short|skirt|chân váy|chan vay|lower|bottom)/i.test(t)) return 'lower';
  return 'upper';
}

function v52IsAccessorySafe(p = {}) {
  const t = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
  return ['accessory','accessories','phụ kiện','phu kien','dây chuyền','day chuyen','necklace','đồng hồ','dong ho','watch','túi','tui','bag','tote','kính','kinh','glasses','sunglasses','nón','non','hat','vòng','vong','bracelet','dù','du','umbrella','khăn','khan','scarf','headscarf','bông tai','bong tai','earrings','thắt lưng','that lung','belt','kẹp tóc','kep toc','hairclip'].some((x) => t.includes(x));
}

async function v52CallCatVTONReal({ personBuffer, personMime, clothBuffer, clothMime, clothType }) {
  const base = (process.env.JAPANO_CATVTON_URL || 'http://127.0.0.1:7861').replace(/\/+$/, '');
  const url = `${base}/tryon`;
  const form = new FormData();
  form.append('person', new Blob([personBuffer], { type: personMime || 'image/jpeg' }), 'person.jpg');
  form.append('cloth', new Blob([clothBuffer], { type: clothMime || 'image/jpeg' }), 'cloth.jpg');
  form.append('cloth_type', clothType || 'upper');
  form.append('steps', '60');
  form.append('cfg', '3.5');
  form.append('seed', '70');

  const resp = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(1000 * 60 * 12) });
  const contentType = resp.headers.get('content-type') || '';
  const arr = Buffer.from(await resp.arrayBuffer());
  if (!resp.ok) {
    const text = arr.toString('utf8').slice(0, 4000);
    throw new Error(`CatVTON API lỗi HTTP ${resp.status}: ${text}`);
  }
  if (!contentType.startsWith('image/')) {
    const text = arr.toString('utf8').slice(0, 4000);
    throw new Error(`CatVTON không trả ảnh. content-type=${contentType}. body=${text}`);
  }
  return { imageBase64: v52BufferToDataUri(arr, contentType.split(';')[0] || 'image/png'), contentType };
}

app.post('/api/v49/mobile/tryon-selected-product', async (req, res) => {
  console.log('[V52] /api/v49/mobile/tryon-selected-product REAL CATVTON route hit');
  try {
    const personImageBase64 = String(req.body?.personImageBase64 || '');
    if (!personImageBase64) throw new Error('Thiếu ảnh người dùng.');

    const mainProduct = await v52FindProductByAnyIdSafe(req.body?.mainProductId);
    if (!mainProduct) throw new Error('Không tìm thấy sản phẩm chính trong shop/database.');

    const productImage = v52FirstImage(mainProduct);
    if (!productImage) throw new Error('Sản phẩm chính chưa có ảnh để CatVTON thử đồ.');

    const accIds = Array.isArray(req.body?.accessoryProductIds) ? req.body.accessoryProductIds : [];
    const accessories = [];
    for (const id of accIds.slice(0, 5)) {
      const p = await v52FindProductByAnyIdSafe(id);
      if (p && v52IsAccessorySafe(p)) accessories.push(p);
    }

    const personMime = (personImageBase64.match(/^data:([^;]+);base64,/i)?.[1]) || 'image/jpeg';
    const personBuffer = v52DataUriToBuffer(personImageBase64);
    const garment = await v52DownloadImage(productImage, mainProduct.name || 'main-product');
    const clothType = v52GuessClothType(mainProduct);

    const catvton = await v52CallCatVTONReal({
      personBuffer,
      personMime,
      clothBuffer: garment.buffer,
      clothMime: garment.mimeType,
      clothType,
    });

    return res.json({
      ok: true,
      message: accessories.length
        ? 'CatVTON đã trả ảnh thử đồ thật cho sản phẩm chính. Lưu ý: CatVTON chỉ xử lý quần áo; phụ kiện cần bước inpainting riêng để gắn thật lên người.'
        : 'CatVTON đã trả ảnh thử đồ thật.',
      finalImageBase64: catvton.imageBase64,
      imageBase64: catvton.imageBase64,
      mainProduct,
      accessories,
      tips: {
        summary: `Sản phẩm chính: ${mainProduct?.name || 'sản phẩm shop'}.`,
        sizeAdvice: [`Size đã chọn/gợi ý: ${req.body?.selectedSize || req.body?.recommendedSize || 'chưa chọn'}`],
        accessoryAdvice: accessories.length
          ? [`Đã chọn phụ kiện: ${accessories.map((x) => x.name).join(', ')}. V52 không overlay giả; phụ kiện sẽ cần V53 inpainting để gắn thật.`]
          : ['Chưa chọn phụ kiện.'],
      },
      debug: {
        v52RealCatVTONRoute: true,
        noFallbackPreview: true,
        catvtonUrl: process.env.JAPANO_CATVTON_URL || 'http://127.0.0.1:7861',
        fixedTryOnParams: { steps: 60, cfg: 3.5, seed: 70 },
        clothType,
        productImage,
        accessoriesCount: accessories.length,
      },
    });
  } catch (e) {
    console.error('[V52] REAL CATVTON failed:', e?.stack || e?.message || e);
    return res.status(502).json({
      ok: false,
      message: `V52 CatVTON thật chưa chạy hoặc lỗi: ${e.message}. Không dùng preview giả nữa. Hãy chạy CatVTON API 7861 rồi bấm thử lại.`,
      debug: {
        v52RealCatVTONRoute: true,
        noFallbackPreview: true,
        catvtonUrl: process.env.JAPANO_CATVTON_URL || 'http://127.0.0.1:7861',
      },
    });
  }
});

// ================= JAPANO V52 REAL CATVTON CONNECTOR END =================
'''

if 'JAPANO V52 REAL CATVTON CONNECTOR START' in s:
    print('[OK] V52 route already exists')
else:
    markers = [
        '// ================= JAPANO V50 FORCE IMAGE OUTPUT ROUTES START =================',
        '// ================= JAPANO V49 SHOPEE TRYON UI ROUTES START =================',
        '// ================= JAPANO V48 FORCE TRYON FRONTEND ROUTES START =================',
    ]
    for m in markers:
        if m in s:
            s = s.replace(m, BLOCK + '\n' + m, 1)
            print('[OK] Inserted V52 route before', m)
            break
    else:
        raise SystemExit('[ERROR] Không thấy marker V50/V49 để chèn route. Gửi server/index.mjs để kiểm tra.')

server.write_text(s, encoding='utf-8')
print('[OK] Patched', server)
print('[OK] Backup:', backup)
PY

echo
echo "=== Check thứ tự route: V52 phải nằm TRƯỚC V50 ==="
python3 - <<'PY'
from pathlib import Path
s = Path('server/index.mjs').read_text(encoding='utf-8')
for key in ['JAPANO V52 REAL CATVTON CONNECTOR START','JAPANO V50 FORCE IMAGE OUTPUT ROUTES START','JAPANO V49 SHOPEE TRYON UI ROUTES START']:
    print(key, s.find(key))
if s.find('JAPANO V52 REAL CATVTON CONNECTOR START') < s.find('JAPANO V50 FORCE IMAGE OUTPUT ROUTES START'):
    print('[OK] V52 đứng trước V50, app sẽ không lấy fallback preview nữa.')
else:
    print('[WARN] V52 chưa đứng trước V50, cần gửi server/index.mjs để sửa tay.')
PY

echo
echo "=== XONG V52 ==="
echo "Terminal 1 chạy CatVTON API thật:"
echo "cd /home/nhat/jp/ai/CatVTON"
echo "source .venv/bin/activate"
echo "GRADIO_ANALYTICS_ENABLED=False CUDA_VISIBLE_DEVICES=0 python japano_catvton_simple_web.py"
echo
echo "Terminal 2 chạy backend JAPANO:"
echo "cd /home/nhat/Downloads/v37"
echo "source .venv/bin/activate"
echo "export PYTHON_BIN=\"\$PWD/.venv/bin/python\""
echo "export JAPANO_CATVTON_URL=\"http://127.0.0.1:7861\""
echo "export JAPANO_AI_GATEWAY_URL=\"http://127.0.0.1:8001\""
echo "npm run start-server"
