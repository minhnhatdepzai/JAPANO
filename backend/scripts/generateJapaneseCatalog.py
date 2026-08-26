"""Sinh ảnh flat-lay và metadata cho bộ sản phẩm Nhật Bản của JAPANO.

    systemctl --user stop japano-fashn
    python3 backend/scripts/generateJapaneseCatalog.py
    systemctl --user start japano-fashn

Ảnh được sinh bằng chính FLUX.2 Klein đang chạy trên máy — không tải ảnh từ
internet, không hotlink, không scrape mạng xã hội. Mọi ảnh đều là FLAT-LAY:
chỉ có trang phục trên nền trắng, KHÔNG có người và KHÔNG có ma-nơ-canh. Nhờ vậy
bộ ảnh sản phẩm không chứa hình ảnh cơ thể người nào.

Metadata đi kèm khai báo `garmentType` và `coverageProfile` để pipeline thử đồ
biết vùng nào hở là đúng thiết kế và vùng nào bắt buộc phải kín
(xem backend/lib/garmentCoverage.js).
"""

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTS_DIR = ROOT / 'mobile' / 'assets' / 'products'
CATALOG_JSON = ROOT / 'backend' / 'data' / 'japanese-products.json'
CREDITS = PRODUCTS_DIR / 'IMAGE-CREDITS.json'
FLUX_HOME = os.getenv('JAPANO_FLUX_REPOSE_HOME', '/home/nhat/jp/ai/FLUX.2-klein-4B')

FLAT_LAY_STYLE = (
    'laid flat on a pure white seamless background, no person, no mannequin, no body, '
    'centred, soft even studio lighting, sharp fabric texture, top-down e-commerce product photograph'
)

# (slug, tên tiếng Việt, kanji, garmentType, cat, giá, mô tả ảnh, tags)
CATALOG = [
    ('yukata-hoa-anh-dao', 'Yukata hoa anh đào', '浴衣', 'yukata', 'ao-truyen-thong', 1290000,
     'a folded Japanese yukata summer robe with pink cherry blossom pattern on indigo cotton',
     ['truyền thống', 'nhật', 'lễ hội', 'mùa hè']),
    ('yukata-xanh-indigo', 'Yukata xanh chàm', '藍染浴衣', 'yukata', 'ao-truyen-thong', 1190000,
     'a folded Japanese yukata robe in deep indigo blue with simple white geometric komon pattern',
     ['truyền thống', 'nhật', 'tối giản']),
    ('kimono-furisode-do', 'Kimono Furisode tay dài', '振袖', 'kimono', 'ao-truyen-thong', 4890000,
     'a luxurious Japanese furisode kimono with very long hanging sleeves, deep red silk with '
     'gold chrysanthemum and crane motifs',
     ['truyền thống', 'nhật', 'lễ hội', 'cao cấp']),
    ('kimono-tomesode-den', 'Kimono Tomesode đen', '留袖', 'kimono', 'ao-truyen-thong', 5290000,
     'a formal Japanese tomesode kimono in black silk with gold and silver pine motifs along the hem only',
     ['truyền thống', 'nhật', 'thanh lịch', 'cao cấp']),
    ('haori-seigaiha', 'Haori họa tiết Seigaiha', '羽織', 'haori', 'haori', 1490000,
     'a short Japanese haori jacket with blue and white seigaiha overlapping wave pattern',
     ['truyền thống', 'nhật', 'khoác ngoài']),
    ('haori-song-nami', 'Haori họa tiết sóng Nami', '波羽織', 'haori', 'haori', 1590000,
     'a short Japanese haori jacket in charcoal with large white ocean wave nami pattern',
     ['truyền thống', 'nhật', 'khoác ngoài']),
    ('hakama-nu-tim', 'Hakama nữ màu tím', '袴', 'hakama', 'ao-truyen-thong', 1690000,
     'a pleated Japanese hakama wide trouser skirt in deep purple with crisp vertical pleats',
     ['truyền thống', 'nhật', 'học đường']),
    ('jinbei-mua-he', 'Jinbei mùa hè', '甚平', 'jinbei', 'ao-truyen-thong', 890000,
     'a Japanese jinbei summer set, short-sleeve top and matching shorts in light navy cotton with '
     'small white pattern, both pieces laid side by side',
     ['truyền thống', 'nhật', 'mùa hè', 'thoải mái']),
    ('samue-vai-bong', 'Samue vải bông', '作務衣', 'samue', 'ao-truyen-thong', 1090000,
     'a Japanese samue work set, plain charcoal grey cotton jacket and trousers laid side by side',
     ['truyền thống', 'nhật', 'tối giản']),
    ('noragi-denim', 'Noragi denim', '野良着', 'noragi', 'haori', 1390000,
     'a Japanese noragi work jacket in raw indigo denim with visible sashiko stitching',
     ['nhật', 'streetwear', 'khoác ngoài']),
    ('happi-matsuri', 'Happi lễ hội Matsuri', '法被', 'happi', 'ao-truyen-thong', 790000,
     'a Japanese happi festival coat in red and white with bold black kanji-style graphic band',
     ['truyền thống', 'nhật', 'lễ hội']),
    ('obi-vang-kim', 'Đai Obi vàng kim', '帯', 'tops', 'phu-kien', 690000,
     'a long Japanese obi sash belt in gold brocade with woven floral texture, neatly rolled and laid flat',
     ['truyền thống', 'nhật', 'phụ kiện']),
    # --- Nhật hiện đại ------------------------------------------------------
    ('vay-lien-sakura', 'Váy liền thân hoa anh đào', '桜ワンピース', 'one-pieces', 'trang-phuc', 1190000,
     'a modern sleeveless midi dress in soft pink with delicate cherry blossom print',
     ['nhật', 'thanh lịch', 'nữ tính']),
    ('vay-xep-ly-nhat', 'Chân váy ngắn xếp ly', 'プリーツスカート', 'short_skirt', 'trang-phuc', 690000,
     'a short pleated mini skirt in navy blue with crisp knife pleats',
     ['nhật', 'học đường', 'streetwear']),
    ('crop-top-seigaiha', 'Crop top họa tiết Seigaiha', 'クロップトップ', 'crop_top', 'trang-phuc', 590000,
     'a cropped short t-shirt in white with blue seigaiha wave pattern print, short hem',
     ['nhật', 'streetwear', 'mùa hè']),
    ('ao-sat-nach-song', 'Áo sát nách họa tiết sóng', 'ノースリーブ', 'sleeveless_top', 'trang-phuc', 490000,
     'a sleeveless tank top in cream with indigo Japanese wave pattern along the hem',
     ['nhật', 'mùa hè', 'thoải mái']),
    ('quan-short-hoa-van', 'Quần short hoa văn Nhật', 'ショートパンツ', 'shorts', 'trang-phuc', 590000,
     'a pair of casual cotton shorts in sand beige with small indigo Japanese asanoha pattern',
     ['nhật', 'mùa hè', 'thoải mái']),
    ('do-boi-mot-manh-song', 'Áo tắm một mảnh họa tiết sóng', 'ワンピース水着', 'one_piece_swimsuit',
     'trang-phuc', 890000,
     'a one-piece womens swimsuit in navy with white Japanese wave pattern, full front coverage, '
     'modest cut, sports style',
     ['nhật', 'mùa hè', 'đồ bơi']),
    ('bikini-hoa-anh-dao', 'Bikini hai mảnh hoa anh đào', 'ビキニ', 'bikini_two_piece', 'trang-phuc', 790000,
     'a two-piece womens swimwear set, bandeau-style top and high-waist bottom, pink cherry blossom '
     'print on white, both pieces laid side by side, modest sports cut',
     ['nhật', 'mùa hè', 'đồ bơi']),
    # --- Bổ sung để catalog công khai đạt đúng 70 sản phẩm ------------------
    ('kimono-homongi-tra', 'Kimono Hōmongi xanh trà', '訪問着', 'kimono', 'ao-truyen-thong', 3890000,
     'an elegant Japanese homongi visiting kimono in muted tea green silk, continuous seasonal flower '
     'motifs flowing across the shoulder and hem seams',
     ['truyền thống', 'nhật', 'thanh lịch', 'trà đạo', 'dự tiệc']),
    ('kimono-iromuji-matcha', 'Kimono Iromuji màu matcha', '色無地', 'kimono', 'ao-truyen-thong', 3290000,
     'a refined solid-color Japanese iromuji kimono in matcha green rinzu silk with a subtle woven texture',
     ['truyền thống', 'nhật', 'tối giản', 'trà đạo']),
    ('kimono-komon-asanoha', 'Kimono Komon họa tiết Asanoha', '小紋', 'kimono', 'ao-truyen-thong', 2790000,
     'a casual Japanese komon kimono in warm ivory with a small repeating indigo asanoha hemp-leaf pattern',
     ['truyền thống', 'nhật', 'đời thường', 'asanoha']),
    ('uchikake-hac-trang', 'Uchikake hạc trắng cát tường', '打掛', 'kimono', 'ao-truyen-thong', 6890000,
     'an ornate Japanese bridal uchikake over-kimono in vermilion red brocade with paired white cranes, '
     'gold pine branches and plum blossoms, long padded trailing hem',
     ['truyền thống', 'nhật', 'cưới hỏi', 'hạc', 'cao cấp']),
    ('yukata-phao-hoa', 'Yukata họa tiết pháo hoa', '花火浴衣', 'yukata', 'ao-truyen-thong', 1250000,
     'a lightweight Japanese summer yukata in deep navy cotton with colorful small fireworks pattern',
     ['truyền thống', 'nhật', 'lễ hội', 'mùa hè', 'pháo hoa']),
    ('yukata-hoa-asagao', 'Yukata hoa Asagao', '朝顔浴衣', 'yukata', 'ao-truyen-thong', 1190000,
     'a fresh white and pale blue Japanese cotton yukata with indigo morning-glory flower and vine motifs',
     ['truyền thống', 'nhật', 'lễ hội', 'mùa hè', 'hoa']),
    ('haori-sashiko-cham', 'Haori Sashiko xanh chàm', '刺し子羽織', 'haori', 'haori', 1790000,
     'a modern Japanese indigo haori jacket with visible white geometric sashiko running stitches',
     ['nhật', 'sashiko', 'xanh chàm', 'khoác ngoài', 'thủ công']),
    ('hanten-mua-dong', 'Áo Hanten chần bông mùa đông', '半纏', 'haori', 'haori', 1390000,
     'a padded Japanese hanten winter jacket in rust red cotton with black collar and subtle woven pattern',
     ['truyền thống', 'nhật', 'mùa đông', 'khoác ngoài', 'ấm áp']),
    ('noragi-boro-chap-va', 'Noragi Boro chắp vá', '襤褸野良着', 'noragi', 'haori', 1890000,
     'a Japanese noragi work jacket made from tasteful patchworked indigo boro textiles with sashiko repairs',
     ['nhật', 'boro', 'sashiko', 'xanh chàm', 'streetwear']),
    ('hakama-nam-xanh-cham', 'Hakama nam xanh chàm', '男袴', 'hakama', 'ao-truyen-thong', 1750000,
     'a formal Japanese mens umanori hakama in dark indigo, divided wide trousers with seven crisp pleats',
     ['truyền thống', 'nhật', 'nam', 'trang trọng']),
    ('jinbei-asanoha', 'Jinbei họa tiết Asanoha', '麻の葉甚平', 'jinbei', 'ao-truyen-thong', 950000,
     'a Japanese jinbei summer set with short-sleeve wrap top and shorts in blue cotton asanoha pattern, '
     'both pieces laid side by side',
     ['truyền thống', 'nhật', 'mùa hè', 'asanoha', 'thoải mái']),
    ('samue-xanh-cham', 'Samue xanh chàm tối giản', '藍作務衣', 'samue', 'ao-truyen-thong', 1190000,
     'a minimalist Japanese samue workwear set, indigo cotton wrap jacket and relaxed trousers laid side by side',
     ['truyền thống', 'nhật', 'xanh chàm', 'tối giản', 'thoải mái']),
    ('happi-awa-odori', 'Happi lễ hội Awa Odori', '阿波踊り法被', 'happi', 'ao-truyen-thong', 850000,
     'a vivid Japanese festival happi coat in indigo and white with bold geometric dance-festival motifs and red trim',
     ['truyền thống', 'nhật', 'lễ hội', 'awa odori', 'xanh chàm']),
    ('vay-quan-kimono', 'Váy quấn tay Kimono', '着物スリーブワンピース', 'one-pieces', 'trang-phuc', 1290000,
     'a modern wrap midi dress with wide kimono-inspired sleeves, navy crepe fabric and a subtle gold obi-style waist tie',
     ['nhật', 'hiện đại', 'thanh lịch', 'công sở', 'dự tiệc']),
    ('ao-blouse-tay-kimono', 'Áo blouse tay Kimono', '着物袖ブラウス', 'tops', 'trang-phuc', 690000,
     'a modern ivory blouse with relaxed three-quarter kimono sleeves and a small indigo seigaiha trim at the cuffs',
     ['nhật', 'hiện đại', 'thanh lịch', 'công sở', 'tối giản']),
    ('quan-culottes-sashiko', 'Quần culottes Sashiko', '刺し子キュロット', 'bottoms', 'trang-phuc', 790000,
     'wide-leg cropped culotte trousers in deep indigo cotton with restrained white sashiko stitching near the pockets',
     ['nhật', 'hiện đại', 'sashiko', 'xanh chàm', 'streetwear']),
    ('michiyuki-do-man', 'Áo khoác Michiyuki đỏ mận', '道行コート', 'haori', 'haori', 1690000,
     'a traditional Japanese michiyuki over-kimono coat in deep plum red silk, square neckline, concealed front '
     'fastening and a subtle woven geometric texture',
     ['truyền thống', 'nhật', 'michiyuki', 'khoác ngoài', 'thanh lịch']),
]

COLOR_HEX = {
    'yukata-hoa-anh-dao': '#1F3A6E', 'yukata-xanh-indigo': '#22417A', 'kimono-furisode-do': '#9B1B30',
    'kimono-tomesode-den': '#1A1A1A', 'haori-seigaiha': '#2E5C8A', 'haori-song-nami': '#3A3F44',
    'hakama-nu-tim': '#5B4B8A', 'jinbei-mua-he': '#2C4A6B', 'samue-vai-bong': '#4A4A4A',
    'noragi-denim': '#2B4162', 'happi-matsuri': '#C0392B', 'obi-vang-kim': '#C9A227',
    'vay-lien-sakura': '#F2B8C6', 'vay-xep-ly-nhat': '#22315B', 'crop-top-seigaiha': '#F5F7FA',
    'ao-sat-nach-song': '#EFE6D5', 'quan-short-hoa-van': '#D8C9A8', 'do-boi-mot-manh-song': '#1E3A5F',
    'bikini-hoa-anh-dao': '#F7D9E3',
    'kimono-homongi-tra': '#71806A', 'kimono-iromuji-matcha': '#7A8B58',
    'kimono-komon-asanoha': '#E9E0CF', 'uchikake-hac-trang': '#A51C30',
    'yukata-phao-hoa': '#192F5D', 'yukata-hoa-asagao': '#DDECF2',
    'haori-sashiko-cham': '#27496D', 'hanten-mua-dong': '#A64B3C',
    'noragi-boro-chap-va': '#263E55', 'hakama-nam-xanh-cham': '#20344B',
    'jinbei-asanoha': '#416B8A', 'samue-xanh-cham': '#304C63',
    'happi-awa-odori': '#27577A', 'vay-quan-kimono': '#23395B',
    'ao-blouse-tay-kimono': '#EEE9DE', 'quan-culottes-sashiko': '#294763',
    'michiyuki-do-man': '#713846',
}
SIZES = ['S', 'M', 'L', 'XL', 'XXL']

# Nguồn thông tin văn hoá dùng để kiểm chứng mô tả; ảnh sản phẩm vẫn được sinh
# cục bộ và có provenance riêng trong IMAGE-CREDITS.json.
SOURCES = {
    'kimono': {
        'title': 'Kimono and Fashion: The Beauty of Kosode — Kyoto National Museum',
        'url': 'https://www.kyohaku.go.jp/old/eng/theme/floor1_4/past/1F-4_20220209.html',
    },
    'yukata': {
        'title': 'Yukata: Traditional Garment for Summer — Web Japan',
        'url': 'https://web-japan.org/trends/11_fashion/fas120820.html',
    },
    'textile': {
        'title': 'Japanese Fabrics and the Evolution of the Kimono — Government of Japan',
        'url': 'https://www.gov-online.go.jp/eng/publicity/book/hlj/html/202009/202009_01_en.html',
    },
    'indigo': {
        'title': 'Japanese Indigo Dyeing and Sashiko — Government of Japan',
        'url': 'https://www.gov-online.go.jp/eng/publicity/book/hlj/html/202010/202010_11_en.html',
    },
    'occasion': {
        'title': 'Occasions for Wearing Kimono — Web Japan',
        'url': 'https://web-japan.org/kidsweb/virtual/kimono/kimono03.html',
    },
    'crane': {
        'title': 'Traditional Kimono Designs Featuring Cranes — Government of Japan',
        'url': 'https://www.gov-online.go.jp/eng/publicity/book/hlj/html/202312/202312_03_jp.html',
    },
}


def information_sources(slug, garment_type, tags):
    keys = ['textile']
    if garment_type == 'yukata':
        keys += ['yukata', 'occasion']
    elif garment_type in {'kimono', 'haori', 'hakama', 'jinbei', 'samue', 'noragi', 'happi'}:
        keys += ['kimono', 'occasion']
    joined = ' '.join([slug, *tags]).lower()
    if any(token in joined for token in ('chàm', 'sashiko', 'boro', 'indigo')):
        keys.append('indigo')
    if 'hạc' in joined:
        keys.append('crane')
    return [SOURCES[key] for key in dict.fromkeys(keys)]


def build_metadata():
    """Metadata sản phẩm — coverageProfile do lib/garmentCoverage.js suy ra từ garmentType."""
    products = []
    for index, (slug, name, kanji, garment_type, cat, price, _prompt, tags) in enumerate(CATALOG):
        adult_only = garment_type in {'bikini_two_piece', 'bikini_top', 'bikini_bottom',
                                      'one_piece_swimsuit', 'crop_top'}
        products.append({
            'id': f'jp{index + 1}',
            'slug': slug,
            'name': name,
            'kanji': kanji,
            'sku': f'JP{index + 1:03d}',
            'brand': 'JAPANO',
            'price': price,
            'old': None,
            'sale': None,
            'status': 'published',
            'cat': cat,
            'category': cat,
            'garmentType': garment_type,
            'adultOnlyTryOn': adult_only,
            'tearAllowed': False,
            'colorHex': COLOR_HEX.get(slug, '#333333'),
            'tags': tags,
            'visualTags': tags[:2],
            'rating': 4.6,
            'sold': 0,
            'desc': f'{name} ({kanji}) — thiết kế theo tinh thần thời trang Nhật Bản, chất liệu thoáng và dễ phối.',
            'story': f'{name} lấy cảm hứng từ hoạ tiết và phom dáng truyền thống Nhật Bản.',
            'informationSources': information_sources(slug, garment_type, tags),
            'sizes': SIZES,
            'variants': [{'size': size, 'color': 'Mặc định', 'stock': 12} for size in SIZES],
            # URL thật do backend/server.js phục vụ. Chuỗi trần `slug_1` từng
            # bị app ghép thành `/slug_1` và trả 404 dù file có trên đĩa.
            'images': [f'/assets/products/{slug}_1.jpg'],
            'tryonFlat': f'/assets/products/{slug}_tryon-flat.png',
            'videos': [],
            'imageSource': 'generated-locally-flux2-klein',
        })
    return products


def generate_images(products, force=False):
    import torch
    from diffusers import Flux2KleinPipeline

    pipe = Flux2KleinPipeline.from_pretrained(FLUX_HOME, torch_dtype=torch.bfloat16)
    pipe.enable_sequential_cpu_offload()
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    made = 0
    for index, (entry, product) in enumerate(zip(CATALOG, products)):
        slug, name, _kanji, _type, _cat, _price, description, _tags = entry
        flat_path = PRODUCTS_DIR / f'{slug}_tryon-flat.png'
        catalog_path = PRODUCTS_DIR / f'{slug}_1.jpg'
        if flat_path.exists() and catalog_path.exists() and not force:
            print(f'  [bỏ qua] {slug}')
            continue
        prompt = f'Professional e-commerce flat-lay product photograph of {description}, {FLAT_LAY_STYLE}'
        started = time.time()
        image = pipe(
            prompt=prompt, width=768, height=1024, num_inference_steps=4, guidance_scale=1.0,
            generator=torch.Generator(device='cuda').manual_seed(1000 + index * 7),
        ).images[0].convert('RGB')
        image.save(flat_path)
        image.save(catalog_path, quality=92)
        made += 1
        print(f'  [ok] {slug} ({time.time() - started:.0f}s)')
    return made


def write_credits(products):
    data = {}
    if CREDITS.exists():
        try:
            data = json.loads(CREDITS.read_text(encoding='utf-8'))
        except Exception:
            data = {}
    data.setdefault('products', {})
    for product in products:
        data['products'][product['slug']] = {
            'source': 'Sinh cục bộ bằng FLUX.2 Klein 4B trên máy của dự án',
            'license': 'Ảnh do dự án tạo ra, không lấy từ internet, không hotlink',
            'contains': 'flat-lay trang phục trên nền trắng — không có người, không có ma-nơ-canh',
            'generatedAt': time.strftime('%Y-%m-%d'),
        }
    CREDITS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    force = '--force' in sys.argv
    products = build_metadata()
    CATALOG_JSON.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_JSON.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Metadata: {CATALOG_JSON} ({len(products)} sản phẩm)')
    if '--metadata-only' not in sys.argv:
        made = generate_images(products, force=force)
        print(f'Đã sinh {made} bộ ảnh')
    write_credits(products)
    print(f'Credits: {CREDITS}')


if __name__ == '__main__':
    main()
