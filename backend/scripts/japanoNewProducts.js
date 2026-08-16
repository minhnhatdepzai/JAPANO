// ĐỊNH NGHĨA GỐC của các sản phẩm Nhật Bản thêm vào catalog.
//
// Đây là nguồn sự thật duy nhất. Trước đây các sản phẩm này chỉ tồn tại trong
// một script dùng-một-lần ở thư mục tạm, nên khi db.json bị ghi đè (xem
// activateFileFallback trong lib/store.js) thì không còn cách nào dựng lại
// ngoài gõ tay. Giữ ở đây thì chạy lại buildJapanoProducts.js là khôi phục được.
//
// Ảnh KHÔNG khai ở đây: chúng được đọc từ mobile/assets/products/IMAGE-CREDITS.json,
// vốn đã ghi sẵn tác giả và giấy phép của từng tấm.
const path = require('path');
const fs = require('fs');

const CREDITS_FILE = path.join(__dirname, '..', '..', 'mobile', 'assets', 'products', 'IMAGE-CREDITS.json');

const APPAREL = ['S', 'M', 'L', 'XL', 'XXL'];
const ONE_SIZE = ['M'];

const DEFINITIONS = [
  {
    slug: 'hakama-nu', name: 'Hakama nữ vải dày', kanji: '袴', cat: 'ao-truyen-thong', sku: 'HAKAMA',
    price: 1450000, old: 1790000, colorHex: '#3A3A44',
    colors: [['Sumi', '#1A1410'], ['Ai', '#243244'], ['Ebicha', '#6E3B3B']], sizes: APPAREL,
    tags: ['lễ tốt nghiệp', 'trang trọng', 'truyền thống'],
    desc: 'Hakama nữ xếp ly vải dày, dáng váy liền cạp cao — trang phục dự lễ tốt nghiệp và nghi thức truyền thống của Nhật Bản.',
    story: 'Hakama bắt nguồn từ trang phục của giới võ sĩ, ngày nay là hình ảnh quen thuộc trong lễ tốt nghiệp đại học Nhật. Nếp ly sâu giữ dáng đứng và tạo đường đi thanh thoát.',
  },
  {
    slug: 'hakama-do', name: 'Hakama đỏ lễ phục', kanji: '緋袴', cat: 'ao-truyen-thong', sku: 'HAKAMD',
    price: 1350000, old: 1650000, colorHex: '#A33A2F',
    colors: [['Shu', '#A33A2F'], ['Sumi', '#1A1410'], ['Ai', '#243244']], sizes: APPAREL,
    tags: ['lễ phục', 'đền chùa', 'truyền thống'],
    desc: 'Hakama đỏ xếp ly dáng dài, cạp cao thắt bản rộng — kiểu hibakama quen thuộc trong lễ phục đền Thần đạo và các dịp trang trọng.',
    story: 'Hibakama (緋袴) màu đỏ son là trang phục thân dưới của miko tại các đền Thần đạo. Nếp ly sâu giữ dáng đứng, tà rộng tạo đường đi thanh thoát khi bước.',
  },
  {
    slug: 'chan-vay-xep-ly', name: 'Chân váy xếp ly midi', kanji: 'プリーツ', cat: 'trang-phuc', sku: 'PLEAT',
    price: 620000, old: 780000, colorHex: '#243244',
    colors: [['Ai', '#243244'], ['Sumi', '#1A1410'], ['Kem', '#E8E0D0']], sizes: APPAREL,
    tags: ['xếp ly', 'đi làm', 'phối kimono'],
    desc: 'Chân váy xếp ly dáng midi, cạp chun ôm nhẹ, nếp ly giữ phom khi chuyển động — phối được cả với áo sơ mi lẫn áo Haori.',
    story: 'Nếp ly là kỹ thuật xử lý vải quen thuộc trong trang phục Nhật, từ hakama tới đồng phục học sinh: vải phẳng nhưng vẫn tạo được khối và chuyển động khi bước đi.',
  },
  {
    slug: 'happi-le-hoi', name: 'Áo Happi lễ hội', kanji: '法被', cat: 'haori', sku: 'HAPPI',
    price: 690000, old: 850000, colorHex: '#243244',
    colors: [['Ai', '#243244'], ['Shu', '#A33A2F'], ['Sumi', '#1A1410']], sizes: APPAREL,
    tags: ['lễ hội', 'matsuri', 'cotton'],
    desc: 'Áo khoác Happi cotton dáng thẳng, tay lửng, in gia huy sau lưng — kiểu áo đồng đội của các đoàn rước trong lễ hội matsuri.',
    story: 'Happi từng là áo đồng phục của thợ và người hầu thời Edo, in gia huy chủ nhà sau lưng. Ngày nay nó là biểu tượng của không khí matsuri mùa hè.',
  },
  {
    slug: 'samue-thien', name: 'Bộ Samue thiền', kanji: '作務衣', cat: 'trang-phuc', sku: 'SAMUE',
    price: 980000, old: 1190000, colorHex: '#4A5A64',
    colors: [['Ai', '#243244'], ['Matcha', '#6B7255'], ['Sumi', '#1A1410']], sizes: APPAREL,
    tags: ['thiền', 'thoải mái', 'mặc nhà'],
    desc: 'Bộ Samue hai mảnh áo và quần, vải cotton dệt thoáng, cạp chun — nguyên bản là đồ lao tác của tăng lữ Thiền tông.',
    story: 'Samue là trang phục các nhà sư mặc khi làm việc trong chùa (samu). Đường cắt rộng để cử động thoải mái, nay được ưa dùng làm đồ mặc nhà và đồ thủ công.',
  },
  {
    slug: 'obi-lua', name: 'Đai Obi lụa dệt hoa', kanji: '帯', cat: 'phu-kien', sku: 'OBI',
    price: 1290000, old: 1590000, colorHex: '#B08D3C',
    colors: [['Kin', '#B08D3C'], ['Shu', '#A33A2F'], ['Sumi', '#1A1410']], sizes: ONE_SIZE,
    tags: ['kimono', 'lụa', 'thủ công'],
    desc: 'Đai Obi lụa dệt hoa văn kim tuyến, bản rộng, dùng thắt cho kimono và yukata. Một chiếc obi quyết định phần lớn dáng vẻ của cả bộ.',
    story: 'Obi không chỉ để giữ áo: cách thắt nút sau lưng nói lên dịp mặc và tuổi tác người mặc. Hoa văn dệt kim tuyến vốn dành cho những dịp trang trọng nhất.',
  },
  {
    slug: 'tabi-chia-ngon', name: 'Tất Tabi chia ngón', kanji: '足袋', cat: 'phu-kien', sku: 'TABI',
    price: 150000, old: null, colorHex: '#FFFFFF',
    colors: [['Trắng', '#FFFFFF'], ['Sumi', '#1A1410'], ['Ai', '#243244']], sizes: ['S', 'M', 'L', 'XL'],
    tags: ['truyền thống', 'đi kèm guốc', 'cotton'],
    desc: 'Tất Tabi cotton chia ngón cái, cài móc bên hông — thiết kế để đi cùng guốc Geta và dép Zōri quai xỏ ngón.',
    story: 'Tabi tách riêng ngón cái để luồn quai dép truyền thống. Hàng móc cài bên mắt cá cho phép ôm sát cổ chân mà không cần chun co giãn.',
  },
  {
    slug: 'furoshiki-vai', name: 'Khăn gói Furoshiki', kanji: '風呂敷', cat: 'phu-kien', sku: 'FUROSHIKI',
    price: 220000, old: 280000, colorHex: '#A33A2F',
    colors: [['Shu', '#A33A2F'], ['Ai', '#243244'], ['Sumi', '#1A1410']], sizes: ONE_SIZE,
    tags: ['thân thiện môi trường', 'gói quà', 'đa dụng'],
    desc: 'Khăn vuông Furoshiki dùng để gói quà, bọc hộp cơm hay xếp thành túi xách. Một tấm vải thay cho hàng chục chiếc túi nilon.',
    story: 'Furoshiki ra đời từ thói quen bọc quần áo khi đi tắm công cộng thời Edo. Cùng một tấm vải, đổi cách buộc là ra một công năng khác — bao bì không rác thải.',
  },
  {
    slug: 'sensu-quat-gap', name: 'Quạt giấy Nhật Bản', kanji: '扇子', cat: 'phu-kien', sku: 'SENSU',
    price: 190000, old: null, colorHex: '#D98A93',
    colors: [['Sakura', '#D98A93'], ['Ai', '#243244'], ['Kin', '#B08D3C']], sizes: ONE_SIZE,
    tags: ['mùa hè', 'thủ công', 'quà tặng'],
    desc: 'Quạt giấy nan tre, mặt giấy washi in hoa văn thủ công — vật bất ly thân trong mùa hè Nhật Bản và là món quà lưu niệm phổ biến.',
    story: 'Nan tre chẻ mỏng dán giấy washi là kỹ thuật hàng trăm năm tuổi. Quạt còn xuất hiện trong trà đạo và sân khấu Nō như một đạo cụ mang tính nghi lễ.',
  },
  {
    slug: 'kanzashi-trau-cai', name: 'Trâm cài tóc Kanzashi', kanji: '簪', cat: 'phu-kien', sku: 'KANZASHI',
    price: 340000, old: 420000, colorHex: '#D98A93',
    colors: [['Sakura', '#D98A93'], ['Shu', '#A33A2F'], ['Kin', '#B08D3C']], sizes: ONE_SIZE,
    tags: ['phụ kiện tóc', 'thủ công', 'lễ hội'],
    desc: 'Trâm cài tóc Kanzashi gấp cánh hoa từ lụa theo kỹ thuật tsumami, đính rủ tua — dùng cho tóc búi khi mặc kimono.',
    story: 'Tsumami-kanzashi được gấp từ những mảnh lụa vuông nhỏ, mỗi cánh hoa là một lần gấp bằng nhíp. Maiko ở Kyoto đổi mẫu kanzashi theo từng tháng trong năm.',
  },
];

function readCredits() {
  return JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
}

/** Dựng bản ghi sản phẩm đầy đủ từ định nghĩa + ảnh trong manifest. */
function buildProducts({ now = Date.now() } = {}) {
  const credits = readCredits();
  const products = [];
  const skipped = [];
  for (const [index, entry] of DEFINITIONS.entries()) {
    const files = (credits.products[entry.slug] || []).map((item) => `/assets/products/${item.file}`);
    // Backend từ chối xuất bản sản phẩm dưới 2 ảnh; bỏ qua ở đây luôn thay vì
    // tạo ra một bản ghi mà chính máy chủ sẽ không cho lên kệ.
    if (files.length < 2) { skipped.push({ slug: entry.slug, images: files.length }); continue; }
    const variants = [];
    for (const [colorName, colorHex] of entry.colors) {
      for (const size of entry.sizes) {
        variants.push({
          colorName, colorHex, size,
          sku: `${entry.sku}-${colorName.slice(0, 2).toUpperCase()}-${size}`,
          stock: 6 + ((index * 7 + colorName.length * 3 + size.length * 5) % 14),
        });
      }
    }
    products.push({
      id: `p-jp-${entry.slug}`,
      slug: entry.slug, name: entry.name, kanji: entry.kanji, sku: entry.sku,
      cat: entry.cat, category: entry.cat, brand: 'JAPANO',
      price: entry.price, old: entry.old, sale: null,
      discountPercent: entry.old ? Math.round((1 - entry.price / entry.old) * 100) : 0,
      status: 'published', colorHex: entry.colorHex,
      rating: 0, sold: 0,
      tags: entry.tags, visualTags: entry.tags,
      desc: entry.desc, story: entry.story,
      image: files[0], images: files, videos: [],
      variants,
      createdAt: now,
    });
  }
  return { products, skipped };
}

module.exports = { DEFINITIONS, buildProducts, readCredits, CREDITS_FILE };
