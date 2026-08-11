import { IMAGES } from '../assets/images';

export type Product = {
  slug: string; name: string; kanji: string; cat: string;
  price: number; old?: number|null; rating: number; sold: number; reviewCount?:number;
  images: any[]; imageKeys: string[];
  id?: string; status?: string; reason?: string;
  sizes?: string[]; colors?: Array<string | { name?: string; hex?: string }>;
  videos?: Array<string | { url:string; name?:string; type?:string }>;
  variants?: Array<{ colorName?: string; colorHex?: string; size?: string; sku?: string; stock?: number }>;
};

export const BUNDLED: Product[] = [
  { slug:'kimono-hong', name:'Kimono truyền thống Hồng', kanji:'着物', cat:'ao-truyen-thong', price:1890000, old:2290000, rating:0, sold:0, images:[IMAGES['kimono-hong_1'],IMAGES['kimono-hong_2'],IMAGES['kimono-hong_3'],IMAGES['kimono-hong_4']], imageKeys:['kimono-hong_1','kimono-hong_2','kimono-hong_3','kimono-hong_4'] },
  { slug:'yukata-xanh', name:'Yukata vải bông xanh đen', kanji:'浴衣', cat:'ao-truyen-thong', price:1290000, old:1590000, rating:0, sold:0, images:[IMAGES['yukata-xanh_1'],IMAGES['yukata-xanh_2'],IMAGES['yukata-xanh_3'],IMAGES['yukata-xanh_4']], imageKeys:['yukata-xanh_1','yukata-xanh_2','yukata-xanh_3','yukata-xanh_4'] },
  { slug:'haori-dang-dai', name:'Áo choàng Haori dáng dài', kanji:'羽織', cat:'haori', price:1350000, old:1690000, rating:0, sold:0, images:[IMAGES['haori-dang-dai_1'],IMAGES['haori-dang-dai_2'],IMAGES['haori-dang-dai_3'],IMAGES['haori-dang-dai_4']], imageKeys:['haori-dang-dai_1','haori-dang-dai_2','haori-dang-dai_3','haori-dang-dai_4'] },
  { slug:'cardigan-dai', name:'Áo len khoác dáng dài', kanji:'羽織', cat:'haori', price:890000, old:1090000, rating:0, sold:0, images:[IMAGES['cardigan-dai_1'],IMAGES['cardigan-dai_2'],IMAGES['cardigan-dai_3'],IMAGES['cardigan-dai_4']], imageKeys:['cardigan-dai_1','cardigan-dai_2','cardigan-dai_3','cardigan-dai_4'] },
  { slug:'blazer-kaki', name:'Áo khoác kaki dáng dài', kanji:'羽織', cat:'haori', price:990000, old:null, rating:0, sold:0, images:[IMAGES['blazer-kaki_1'],IMAGES['blazer-kaki_2'],IMAGES['blazer-kaki_3'],IMAGES['blazer-kaki_4']], imageKeys:['blazer-kaki_1','blazer-kaki_2','blazer-kaki_3','blazer-kaki_4'] },
  { slug:'ao-len-cardigan', name:'Áo len khoác dệt kim', kanji:'羽織', cat:'haori', price:650000, old:null, rating:0, sold:0, images:[IMAGES['ao-len-cardigan_1'],IMAGES['ao-len-cardigan_2'],IMAGES['ao-len-cardigan_3'],IMAGES['ao-len-cardigan_4']], imageKeys:['ao-len-cardigan_1','ao-len-cardigan_2','ao-len-cardigan_3','ao-len-cardigan_4'] },
  { slug:'khoac-nhat', name:'Áo khoác Nhật bản mùa', kanji:'羽織', cat:'haori', price:1150000, old:null, rating:0, sold:0, images:[IMAGES['khoac-nhat_1']], imageKeys:['khoac-nhat_1'] },
  { slug:'dong-phuc-thuy-thu', name:'Đồng phục thủy thủ nữ', kanji:'制服', cat:'trang-phuc', price:720000, old:null, rating:0, sold:0, images:[IMAGES['dong-phuc-thuy-thu_1'],IMAGES['dong-phuc-thuy-thu_2'],IMAGES['dong-phuc-thuy-thu_3'],IMAGES['dong-phuc-thuy-thu_4']], imageKeys:['dong-phuc-thuy-thu_1','dong-phuc-thuy-thu_2','dong-phuc-thuy-thu_3','dong-phuc-thuy-thu_4'] },
  { slug:'so-mi-trang', name:'Sơ mi trắng tay ngắn', kanji:'制服', cat:'trang-phuc', price:550000, old:null, rating:0, sold:0, images:[IMAGES['so-mi-trang_1'],IMAGES['so-mi-trang_2']], imageKeys:['so-mi-trang_1','so-mi-trang_2'] },
  { slug:'ao-len-co-lo', name:'Áo len cổ lọ dệt kim', kanji:'制服', cat:'trang-phuc', price:590000, old:null, rating:0, sold:0, images:[IMAGES['ao-len-co-lo_1'],IMAGES['ao-len-co-lo_2'],IMAGES['ao-len-co-lo_3'],IMAGES['ao-len-co-lo_4']], imageKeys:['ao-len-co-lo_1','ao-len-co-lo_2','ao-len-co-lo_3','ao-len-co-lo_4'] },
  { slug:'balo-vai', name:'Balo vải Nhật', kanji:'鞄', cat:'phu-kien', price:490000, old:null, rating:0, sold:0, images:[IMAGES['balo-vai_1'],IMAGES['balo-vai_2'],IMAGES['balo-vai_3'],IMAGES['balo-vai_4']], imageKeys:['balo-vai_1','balo-vai_2','balo-vai_3','balo-vai_4'] },
  { slug:'giay-dep', name:'Dép quai Nhật', kanji:'履物', cat:'phu-kien', price:390000, old:null, rating:0, sold:0, images:[IMAGES['giay-dep_1'],IMAGES['giay-dep_2'],IMAGES['giay-dep_3'],IMAGES['giay-dep_4']], imageKeys:['giay-dep_1','giay-dep_2','giay-dep_3','giay-dep_4'] },
  { slug:'mu-nhat', name:'Mũ bo Nhật', kanji:'帽子', cat:'phu-kien', price:280000, old:null, rating:0, sold:0, images:[IMAGES['mu-nhat_1'],IMAGES['mu-nhat_2'],IMAGES['mu-nhat_3'],IMAGES['mu-nhat_4']], imageKeys:['mu-nhat_1','mu-nhat_2','mu-nhat_3','mu-nhat_4'] },
  { slug:'du-nhat', name:'Dù Nhật bản', kanji:'傘', cat:'phu-kien', price:350000, old:null, rating:0, sold:0, images:[IMAGES['du-nhat_1'],IMAGES['du-nhat_2'],IMAGES['du-nhat_3'],IMAGES['du-nhat_4']], imageKeys:['du-nhat_1','du-nhat_2','du-nhat_3','du-nhat_4'] },
  { slug:'gang-tay', name:'Găng tay len', kanji:'手袋', cat:'phu-kien', price:180000, old:null, rating:0, sold:0, images:[IMAGES['gang-tay_1'],IMAGES['gang-tay_2'],IMAGES['gang-tay_3'],IMAGES['gang-tay_4']], imageKeys:['gang-tay_1','gang-tay_2','gang-tay_3','gang-tay_4'] },
  { slug:'vo-tat', name:'Vớ tất cổ cao', kanji:'靴下', cat:'phu-kien', price:90000, old:null, rating:0, sold:0, images:[IMAGES['vo-tat_1'],IMAGES['vo-tat_2'],IMAGES['vo-tat_3'],IMAGES['vo-tat_4']], imageKeys:['vo-tat_1','vo-tat_2','vo-tat_3','vo-tat_4'] },
  { slug:'kep-no', name:'Kẹp nơ tóc', kanji:'髪飾り', cat:'phu-kien', price:120000, old:null, rating:0, sold:0, images:[IMAGES['kep-no_1'],IMAGES['kep-no_2'],IMAGES['kep-no_3'],IMAGES['kep-no_4']], imageKeys:['kep-no_1','kep-no_2','kep-no_3','kep-no_4'] },
  { slug:'chup-tai', name:'Chụp tai nữ', kanji:'小物', cat:'phu-kien', price:250000, old:null, rating:0, sold:0, images:[IMAGES['chup-tai_1'],IMAGES['chup-tai_2'],IMAGES['chup-tai_3'],IMAGES['chup-tai_4']], imageKeys:['chup-tai_1','chup-tai_2','chup-tai_3','chup-tai_4'] },
  { slug:'guoc-geta', name:'Guốc gỗ Geta', kanji:'下駄', cat:'phu-kien', price:420000, old:null, rating:0, sold:0, images:[IMAGES['guoc-geta_1']], imageKeys:['guoc-geta_1'] },
  { slug:'kiem-go', name:'Kiếm gỗ Nhật bản', kanji:'木刀', cat:'phu-kien', price:320000, old:null, rating:0, sold:0, images:[IMAGES['kiem-go_1']], imageKeys:['kiem-go_1'] },
  { slug:'furina', name:'Trang phục hóa thân Furina', kanji:'コス', cat:'cosplay', price:980000, old:null, rating:0, sold:0, images:[IMAGES['furina_1'],IMAGES['furina_2'],IMAGES['furina_3'],IMAGES['furina_4']], imageKeys:['furina_1','furina_2','furina_3','furina_4'] },
  { slug:'yae-miko', name:'Trang phục hóa thân Yae Miko', kanji:'コス', cat:'cosplay', price:1050000, old:null, rating:0, sold:0, images:[IMAGES['yae-miko_1'],IMAGES['yae-miko_2'],IMAGES['yae-miko_3'],IMAGES['yae-miko_4']], imageKeys:['yae-miko_1','yae-miko_2','yae-miko_3','yae-miko_4'] },
  { slug:'yumeko', name:'Trang phục hóa thân Yumeko Jabami', kanji:'コス', cat:'cosplay', price:990000, old:null, rating:0, sold:0, images:[IMAGES['yumeko_1'],IMAGES['yumeko_2'],IMAGES['yumeko_3'],IMAGES['yumeko_4']], imageKeys:['yumeko_1','yumeko_2','yumeko_3','yumeko_4'] },
  { slug:'naruto', name:'Trang phục hóa thân Naruto', kanji:'コス', cat:'cosplay', price:850000, old:null, rating:0, sold:0, images:[IMAGES['naruto_1'],IMAGES['naruto_2'],IMAGES['naruto_3'],IMAGES['naruto_4']], imageKeys:['naruto_1','naruto_2','naruto_3','naruto_4'] },
];

export let PRODUCTS: Product[] = BUNDLED;
export function setCatalog(list:Product[]){ PRODUCTS = list; }

// Trả về số lượng tồn của biến thể (màu/size); null nghĩa là sản phẩm không theo dõi tồn kho (luôn còn hàng).
export function getVariantStock(product: Product, color?: string, size?: string): number | null {
  const variants = product.variants;
  if (!variants || !variants.length) return null;
  const colorName = color || String(variants[0]?.colorName || 'Mặc định');
  const sizeName = size || 'M';
  const forColor = variants.filter(v => String(v.colorName || 'Mặc định') === colorName);
  const source = forColor.length ? forColor : variants;
  return source
    .filter(v => String(v.size || 'M') === sizeName)
    .reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
}

export function isOutOfStock(product: Product, color?: string, size?: string): boolean {
  const stock = getVariantStock(product, color, size);
  return stock !== null && stock <= 0;
}

// --- Giá theo biến thể (màu + kích cỡ) --------------------------------------
// Phải khớp từng quy tắc với backend/lib/pricing.js, nếu không giá khách thấy
// sẽ khác giá máy chủ tính khi đặt hàng. `variant.price` là TUỲ CHỌN: thiếu
// hoặc <= 0 thì dùng giá chung của sản phẩm.
//
// Máy chủ vẫn là nơi quyết định cuối cùng — app hiển thị cho khách xem, còn
// routes/orders.js tự tính lại đơn giá khi tạo đơn.

function matchVariant(product: Product, color?: string, size?: string) {
  const variants = product.variants;
  if (!variants || !variants.length) return null;
  const colorName = color || 'Mặc định';
  const sizeName = size || 'M';
  return variants.find(v => String(v.colorName || 'Mặc định') === colorName && String(v.size || 'M') === sizeName)
    || variants.find(v => String(v.size || 'M') === sizeName)
    || null;
}

const ownPrice = (variant: any): number | null => {
  const price = Number(variant?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
};

/** Đơn giá thực tế cho một lựa chọn màu+size. */
export function variantPrice(product: Product, color?: string, size?: string): number {
  return ownPrice(matchVariant(product, color, size)) ?? Math.max(0, Number(product.price) || 0);
}

/** Giá gạch ngang tương ứng — chỉ giữ khi vẫn cao hơn giá đang bán. */
export function variantOldPrice(product: Product, color?: string, size?: string): number | null {
  const current = variantPrice(product, color, size);
  const old = Number(product.old || 0);
  return old > current ? old : null;
}

/** Khoảng giá của cả sản phẩm — để danh sách hiện "từ X" khi các biến thể lệch giá. */
export function priceRange(product: Product): { min:number; max:number; varies:boolean } {
  const base = Math.max(0, Number(product.price) || 0);
  const variants = product.variants;
  if (!variants || !variants.length) return { min: base, max: base, varies: false };
  const prices = variants.map(v => ownPrice(v) ?? base);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, varies: min !== max };
}

export const CATEGORIES = [
  { key:'all', label:'Tất cả', kanji:'' },
  { key:'ao-truyen-thong', label:'Áo truyền thống', kanji:'着物' },
  { key:'haori', label:'Áo khoác', kanji:'羽織' },
  { key:'trang-phuc', label:'Trang phục', kanji:'制服' },
  { key:'phu-kien', label:'Phụ kiện', kanji:'小物' },
  { key:'cosplay', label:'Trang phục hóa thân', kanji:'コス' },
];
export const CAT_LABEL: Record<string,string> = Object.fromEntries(CATEGORIES.map(c=>[c.key,c.label]));

export type Story = { kanji:string; title:string; text:string; ikiTitle:string; ikiText:string; craftText:string; tags:string[]; material:string; nhuom:string; giat:string; };
export const STORIES: Record<string, Story> = {
  'ao-truyen-thong': { kanji:'着物', title:'Kimono — linh hồn trang phục Nhật',
    text:'Kimono, nghĩa là “vật để mặc”, định hình từ thời Heian và hoàn thiện ở thời Edo. Mỗi họa tiết, màu nhuộm và cách thắt đai lưng đều mang ý nghĩa về mùa và địa vị. Yukata là phiên bản vải bông nhẹ dùng vào mùa hè và lễ hội.',
    ikiTitle:'Cách mặc thanh lịch', ikiText:'Giữ nếp phẳng, cổ áo chữ V gọn, thắt đai lưng vừa tay. Có thể cách tân bằng cách khoác ngoài áo trơn hiện đại để mặc thường ngày mà vẫn nền nã.',
    craftText:'Vải bông hoặc tơ được dệt kỹ, nhuộm thủ công tông trầm, càng mặc càng mềm và lên màu đẹp theo thời gian.',
    tags:['lễ hội','chụp ảnh','mùa hè'], material:'Vải bông hoặc tơ', nhuom:'Nhuộm thủ công', giat:'Giặt tay, phơi mát' },
  'haori': { kanji:'羽織', title:'Câu chuyện Haori',
    text:'Thời Edo (1603–1868), haori là áo khoác ngắn của võ sĩ và thương nhân, thể hiện địa vị qua chất vải và họa tiết kín đáo bên trong lớp lót.',
    ikiTitle:'Cách mặc thanh lịch', ikiText:'Khoác ngoài áo phông trơn cùng quần ống suông; buông hờ, không cài để phom áo rủ tự nhiên, thanh lịch và tiết chế.',
    craftText:'Vải đũi hoặc gai dệt thô, nhuộm chàm tông trầm. May viền kỹ, đường chỉ giấu, bền theo năm tháng.',
    tags:['đi làm','dạo phố','4 mùa'], material:'Vải đũi hoặc gai', nhuom:'Nhuộm chàm', giat:'Máy nhẹ, phơi mát' },
  'trang-phuc': { kanji:'制服', title:'Phong cách phố Nhật',
    text:'Từ đồng phục học đường tới phong cách đường phố Harajuku, thời trang Nhật hiện đại đề cao sự gọn gàng, lớp lang và chi tiết tinh tế.',
    ikiTitle:'Phối lớp tối giản', ikiText:'Phối áo trong trơn cùng áo khoác phom vừa; ưu tiên tông trung tính và thêm một điểm nhấn nhỏ.',
    craftText:'Chất liệu tencel/modal/len pha thoáng, đường may chắc, giữ phom sau nhiều lần giặt.',
    tags:['đi học','đi làm','hằng ngày'], material:'Vải sợi mềm pha len', nhuom:'Nhuộm bền màu', giat:'Máy nhẹ' },
  'phu-kien': { kanji:'小物', title:'Cái đẹp ở từng chi tiết',
    text:'Người Nhật tin rằng phụ kiện hoàn thiện một bộ đồ. Từ guốc gỗ, dù giấy tới balo vải — mỗi món là một nét văn hoá.',
    ikiTitle:'Điểm xuyết tiết chế', ikiText:'Chỉ thêm 1–2 phụ kiện làm điểm nhấn; chọn tông ăn nhập với trang phục chính.',
    craftText:'Làm thủ công tỉ mỉ, vật liệu tự nhiên (gỗ, vải, tre), ưu tiên độ bền và sự tử tế với người dùng.',
    tags:['điểm nhấn','đi chơi','quà tặng'], material:'Gỗ/vải/tre', nhuom:'Tự nhiên', giat:'Lau/giặt nhẹ' },
  'cosplay': { kanji:'コス', title:'Văn hóa hóa thân',
    text:'Hóa thân nhân vật là nét văn hoá đại chúng Nhật, chú trọng sự chỉn chu trong từng chi tiết trang phục.',
    ikiTitle:'Mẹo lên đồ', ikiText:'Chú ý tỉ lệ, phụ kiện đặc trưng nhân vật và phom dáng; kết hợp công cụ thử đồ thông minh để xem trước.',
    craftText:'Chất liệu đa dạng theo nhân vật, may đo kỹ để lên dáng và thoải mái khi diễn.',
    tags:['sự kiện','chụp ảnh','lễ hội'], material:'Đa chất liệu', nhuom:'In hoa văn hoặc nhuộm', giat:'Theo hướng dẫn' },
};
export const storyFor = (cat:string):Story => STORIES[cat] || STORIES['haori'];
