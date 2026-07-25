export type Product = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  discountLabel?: string;
  image: string;
  images?: string[];
  sizes?: string[];
  dimensions?: string;
  colors?: string[];
  fit?: string;
  story: string;
  description: string;
  badge?: string;
  visualTags?: string[];
  styleUseCase?: string;
};

export type SubCategory = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export type Category = {
  id: string;
  name: string;
  subtitle: string;
  image: any;
  subcategories: SubCategory[];
};

const remote = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const galleryFallbackIds = [
  "photo-1528360983277-13d401cdc186",
  "photo-1485968579580-b6d095142e6e",
  "photo-1516257984-b1b4d707412e",
  "photo-1524504388940-b1c1722653e1",
  "photo-1548883354-7622d03aca27",
  "photo-1548036328-c9fa89d128fa",
  "photo-1542291026-7eec264c27ff",
  "photo-1516826957135-700dedea698c",
  "photo-1513519245088-0e12902e5a38",
  "photo-1544787219-7f47ccb76574",
  "photo-1613771404784-3a5686aa2be3",
  "photo-1606167668584-78701c57f13d",
];

const defaultProductSizes = ["S", "M", "L", "XL"];
const defaultProductColors = ["Đen", "Trắng", "Kem", "Nâu"];

function compactList(values: any[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function withProductDefaults(product: Product, index: number): Product {
  const gallery = compactList([product.image, ...(Array.isArray(product.images) ? product.images : [])]);
  let cursor = index * 4;
  while (gallery.length < 4) {
    gallery.push(remote(galleryFallbackIds[cursor % galleryFallbackIds.length]));
    cursor += 1;
  }
  const images = compactList(gallery).slice(0, 4);
  while (images.length < 4) images.push(remote(galleryFallbackIds[(index + images.length) % galleryFallbackIds.length]));
  return {
    ...product,
    image: images[0] || product.image,
    images,
    sizes: product.sizes?.length ? product.sizes : defaultProductSizes,
    colors: product.colors?.length ? product.colors : defaultProductColors,
    dimensions: product.dimensions || (product.category === "clothing" ? "Form tiêu chuẩn, xem size S/M/L/XL" : "Kích thước tiêu chuẩn theo mô tả"),
    fit: product.fit || (product.category === "clothing" ? "Regular fit" : "Kích cỡ phổ thông"),
  };
}

export const categories: Category[] = [
  {
    id: "clothing",
    name: "Quần áo",
    subtitle: "Thời trang thường ngày, truyền thống và cosplay",
    image: require("../assets/clothing.png"),
    subcategories: [
      {
        id: "women-tops",
        name: "Áo cho nữ",
        description: "Áo kiểu, áo sơ mi, áo len và áo streetwear nữ.",
        image: remote("photo-1485968579580-b6d095142e6e"),
      },
      {
        id: "men-tops",
        name: "Áo cho nam",
        description: "Áo thun, sơ mi, hoodie, bomber và áo khoác nam.",
        image: remote("photo-1516257984-b1b4d707412e"),
      },
      {
        id: "women-bottoms",
        name: "Quần / váy nữ",
        description: "Quần dài, chân váy, váy casual và váy đi chơi.",
        image: remote("photo-1483985988355-763728e1935b"),
      },
      {
        id: "men-bottoms",
        name: "Quần nam",
        description: "Quần jeans, kaki, jogger, quần short và quần công sở.",
        image: remote("photo-1516826957135-700dedea698c"),
      },
      {
        id: "outerwear",
        name: "Áo khoác",
        description: "Bomber, cardigan, trench coat và áo khoác mùa lạnh.",
        image: remote("photo-1548883354-7622d03aca27"),
      },
      {
        id: "japan-traditional",
        name: "Trang phục truyền thống Nhật Bản",
        description: "Kimono, yukata, haori và cảm hứng wafuku.",
        image: remote("photo-1528360983277-13d401cdc186"),
      },
      {
        id: "vietnam-traditional",
        name: "Trang phục truyền thống Việt Nam",
        description: "Áo dài, áo bà ba và phong cách truyền thống Việt.",
        image: remote("photo-1524504388940-b1c1722653e1"),
      },
      {
        id: "kids",
        name: "Quần áo trẻ em",
        description: "Đồ mặc hằng ngày, đồ lễ và set quà cho trẻ em.",
        image: remote("photo-1519238263530-99bdd11df2ea"),
      },
      {
        id: "cosplay",
        name: "Cosplay anime / game",
        description:
          "Trang phục cosplay nhân vật anime, game và phụ kiện hóa trang.",
        image: remote("photo-1511512578047-dfb367046420"),
      },
      {
        id: "footwear",
        name: "Giày dép",
        description: "Sneaker, sandal, guốc Nhật, giày đi chơi và giày casual.",
        image: remote("photo-1542291026-7eec264c27ff"),
      },
      {
        id: "fashion-accessories",
        name: "Phụ kiện thời trang",
        description: "Túi, khăn, nón, thắt lưng, kính và trang sức.",
        image: remote("photo-1548036328-c9fa89d128fa"),
      },
    ],
  },
  {
    id: "home-items",
    name: "Đồ dùng",
    subtitle: "Đồ cá nhân, nhà cửa, công nghệ nhỏ và quà tặng",
    image: require("../assets/utensils.png"),
    subcategories: [
      {
        id: "tableware",
        name: "Bát đĩa / ly cốc",
        description: "Đồ dùng bàn ăn, cốc trà, khay, đũa và bình nước.",
        image: remote("photo-1544787219-7f47ccb76574"),
      },
      {
        id: "decor",
        name: "Đồ trang trí",
        description: "Tranh, tượng, đèn, quạt giấy và decor phòng.",
        image: remote("photo-1513519245088-0e12902e5a38"),
      },
      {
        id: "stationery",
        name: "Văn phòng phẩm",
        description: "Sổ tay, bút, sticker, bookmark và dụng cụ học tập.",
        image: remote("photo-1455390582262-044cdead277a"),
      },
      {
        id: "snacks",
        name: "Đồ ăn vặt Nhật",
        description: "Bánh kẹo, snack, trà, đồ uống và set quà nhỏ.",
        image: remote("photo-1578985545062-69928b1d9587"),
      },
      {
        id: "tech-small",
        name: "Công nghệ nhỏ",
        description: "Ốp lưng, tai nghe, chuột, móc khóa thông minh.",
        image: remote("photo-1516321318423-f06f85e504b3"),
      },
      {
        id: "bags",
        name: "Túi / ví / balo",
        description: "Túi xách, ví, balo đi học, balo du lịch và túi phụ kiện.",
        image: remote("photo-1553062407-98eeb64c6a62"),
      },
      {
        id: "collectibles",
        name: "Đồ sưu tầm",
        description: "Figure, mô hình, badge, móc khóa và vật phẩm anime.",
        image: remote("photo-1566576912321-d58ddd7a6088"),
      },
    ],
  },
  {
    id: "tools",
    name: "Dụng cụ",
    subtitle: "Dụng cụ bếp, thủ công, học tập, cosplay và gaming",
    image: require("../assets/tools.png"),
    subcategories: [
      {
        id: "kitchen-tools",
        name: "Dụng cụ bếp",
        description: "Dao, thớt, khuôn, bộ trà, dụng cụ sushi và hộp cơm.",
        image: remote("photo-1556911220-bff31c812dba"),
      },
      {
        id: "craft-tools",
        name: "Dụng cụ thủ công",
        description: "Cọ, kéo, keo, giấy, kit handmade và dụng cụ DIY.",
        image: remote("photo-1452860606245-08befc0ff44b"),
      },
      {
        id: "school-tools",
        name: "Dụng cụ học tập",
        description: "Bút, thước, sổ, kẹp giấy, hộp bút và bảng mini.",
        image: remote("photo-1497633762265-9d179a990aa6"),
      },
      {
        id: "cosplay-tools",
        name: "Dụng cụ cosplay",
        description: "Wig care, keo, phụ kiện hóa trang, đạo cụ nhẹ.",
        image: remote("photo-1529139574466-a303027c1d8b"),
      },
      {
        id: "gaming-tools",
        name: "Dụng cụ gaming",
        description: "Pad chuột, tay cầm, stand điện thoại, deck box gaming.",
        image: remote("photo-1593305841991-05c297ba4575"),
      },
      {
        id: "card-tools",
        name: "Dụng cụ bảo vệ thẻ",
        description: "Sleeve, album, binder, deck box và top loader.",
        image: remote("photo-1613771404784-3a5686aa2be3"),
      },
    ],
  },
  {
    id: "cards",
    name: "Thẻ bài",
    subtitle: "Trading cards, Pokémon, Yu-Gi-Oh!, anime và game",
    image: require("../assets/cards.png"),
    subcategories: [
      {
        id: "pokemon",
        name: "Pokémon / Pikachu",
        description: "Pokémon TCG, Pikachu, booster, card hiếm và set sưu tầm.",
        image: remote("photo-1613771404784-3a5686aa2be3"),
      },
      {
        id: "yugioh",
        name: "Yu-Gi-Oh!",
        description:
          "Deck, booster, card monster, spell, trap và album Yu-Gi-Oh!.",
        image: remote("photo-1606167668584-78701c57f13d"),
      },
      {
        id: "one-piece",
        name: "One Piece Card Game",
        description: "Thẻ One Piece, leader, character và bộ sưu tập anime.",
        image: remote("photo-1605902711622-cfb43c4437d1"),
      },
      {
        id: "dragon-ball",
        name: "Dragon Ball Card",
        description: "Thẻ Dragon Ball, battle card và các set sưu tầm.",
        image: remote("photo-1612036782180-6f0b6cd846fe"),
      },
      {
        id: "anime-cards",
        name: "Thẻ anime khác",
        description: "Thẻ nhân vật anime, idol, game và thẻ limited.",
        image: remote("photo-1550745165-9bc0b252726f"),
      },
      {
        id: "rare-holo",
        name: "Thẻ hiếm / holographic",
        description: "Card foil, holo, promo, limited và thẻ sưu tầm cao cấp.",
        image: remote("photo-1602524814575-f9c1d06aa0b9"),
      },
      {
        id: "card-accessories",
        name: "Sleeve / deck box / album",
        description: "Phụ kiện bảo vệ, trưng bày và lưu trữ thẻ bài.",
        image: remote("photo-1516321318423-f06f85e504b3"),
      },
    ],
  },
];

const rawProducts: Product[] = [
  {
    id: "p1",
    name: "Haori Linen Nadeshiko",
    category: "clothing",
    subcategory: "japan-traditional",
    price: 1290000,
    image: remote("photo-1528360983277-13d401cdc186"),
    badge: "Traditional",
    description:
      "Áo khoác haori linen mềm, phù hợp phối cùng váy hoặc quần suông.",
    story:
      "Lấy cảm hứng từ lớp áo khoác nhẹ trong trang phục Nhật cổ, sản phẩm được làm mới để mặc hằng ngày.",
  },
  {
    id: "p2",
    name: "Áo sơ mi nữ Kyoto Cream",
    category: "clothing",
    subcategory: "women-tops",
    price: 520000,
    image: remote("photo-1485968579580-b6d095142e6e"),
    description: "Form mềm, màu kem dễ phối, hợp đi học, đi làm và cafe.",
    story:
      "Một chiếc áo tối giản như trang giấy washi, dành cho những ngày cần sự thanh lịch nhẹ nhàng.",
  },
  {
    id: "p3",
    name: "Hoodie nam Gunjo Navy",
    category: "clothing",
    subcategory: "men-tops",
    price: 690000,
    image: remote("photo-1516257984-b1b4d707412e"),
    description: "Hoodie navy dày vừa, dễ phối cùng quần cargo hoặc jean.",
    story:
      "Màu xanh Gunjo lấy cảm hứng từ tranh cổ Nhật, phối lại thành streetwear hiện đại.",
  },
  {
    id: "p4",
    name: "Áo dài Lụa Trăng Non",
    category: "clothing",
    subcategory: "vietnam-traditional",
    price: 1480000,
    image: remote("photo-1524504388940-b1c1722653e1"),
    badge: "Gift",
    description: "Áo dài lụa nhẹ, phù hợp lễ, Tết và chụp ảnh.",
    story:
      "Kết hợp đường nét truyền thống Việt Nam với bảng màu trầm ấm của JAPANO.",
  },
  {
    id: "p5",
    name: "Cosplay Akatsuki Street Set",
    category: "clothing",
    subcategory: "cosplay",
    price: 980000,
    image: remote("photo-1511512578047-dfb367046420"),
    description: "Set cosplay lấy cảm hứng anime, có thể mặc dạng streetwear.",
    story:
      "Dành cho người thích anime nhưng vẫn muốn outfit có thể xuất hiện ngoài đời thường.",
  },
  {
    id: "p6",
    name: "Set trẻ em Matsuri",
    category: "clothing",
    subcategory: "kids",
    price: 450000,
    image: remote("photo-1519238263530-99bdd11df2ea"),
    description: "Set đồ trẻ em màu vui, phù hợp 1/6 hoặc lễ hội.",
    story:
      "Lấy cảm hứng từ mùa lễ hội hè, tạo cảm giác vui tươi và an toàn cho trẻ.",
  },
  {
    id: "p7",
    name: "Bộ trà Matcha nhà JAPANO",
    category: "home-items",
    subcategory: "tableware",
    price: 760000,
    image: remote("photo-1544787219-7f47ccb76574"),
    description: "Bộ tách trà, muỗng và khay nhỏ theo phong cách Nhật.",
    story: "Một khoảng lặng buổi chiều được thu nhỏ trong bộ trà màu đất nung.",
  },
  {
    id: "p8",
    name: "Sổ tay Sakura Notes",
    category: "home-items",
    subcategory: "stationery",
    price: 120000,
    image: remote("photo-1455390582262-044cdead277a"),
    description: "Sổ tay bìa mềm, giấy dày, hợp làm quà 20/11.",
    story:
      "Mỗi trang giấy được thiết kế như một tấm thiệp nhỏ dành cho suy nghĩ tử tế.",
  },
  {
    id: "p9",
    name: "Balo Canvas Tanuki",
    category: "home-items",
    subcategory: "bags",
    price: 640000,
    image: remote("photo-1553062407-98eeb64c6a62"),
    description: "Balo canvas nhẹ, nhiều ngăn, hợp đi học và du lịch.",
    story:
      "Tanuki là linh vật vui vẻ, chiếc balo này dành cho những chuyến đi tự do.",
  },
  {
    id: "p10",
    name: "Dao bếp Santoku Mini",
    category: "tools",
    subcategory: "kitchen-tools",
    price: 880000,
    image: remote("photo-1556911220-bff31c812dba"),
    description: "Dao mini cân bằng tốt, hợp bếp nhỏ và người mới nấu.",
    story:
      "Lấy tinh thần tỉ mỉ của bếp Nhật, tối ưu cho thao tác gọn và an toàn.",
  },
  {
    id: "p11",
    name: "Bộ cọ vẽ Ukiyo Craft",
    category: "tools",
    subcategory: "craft-tools",
    price: 260000,
    image: remote("photo-1452860606245-08befc0ff44b"),
    description: "Bộ cọ đa kích cỡ cho vẽ, mô hình và handmade.",
    story:
      "Cảm hứng từ nét cọ ukiyo-e, dành cho người thích tự tay làm đồ đẹp.",
  },
  {
    id: "p12",
    name: "Deck Box Gunpla Red",
    category: "tools",
    subcategory: "card-tools",
    price: 190000,
    image: remote("photo-1613771404784-3a5686aa2be3"),
    description: "Hộp đựng thẻ chắc chắn, màu đỏ Suoh.",
    story: "Một chiếc hộp nhỏ bảo vệ những lá bài có câu chuyện lớn.",
  },
  {
    id: "p13",
    name: "Pokémon Pikachu Holo Card",
    category: "cards",
    subcategory: "pokemon",
    price: 350000,
    image: remote("photo-1613771404784-3a5686aa2be3"),
    badge: "Holo",
    description: "Thẻ Pokémon phong cách holo, phù hợp sưu tầm và tặng trẻ em.",
    story:
      "Pikachu là ký ức tuổi thơ của nhiều người, lá bài này giữ lại niềm vui đó trong ánh holographic.",
  },
  {
    id: "p14",
    name: "Yu-Gi-Oh! Starter Deck",
    category: "cards",
    subcategory: "yugioh",
    price: 420000,
    image: remote("photo-1606167668584-78701c57f13d"),
    description: "Deck cơ bản cho người mới chơi Yu-Gi-Oh!.",
    story: "Dành cho khoảnh khắc bắt đầu một trận đấu đầu tiên với bạn bè.",
  },
  {
    id: "p15",
    name: "One Piece Leader Pack",
    category: "cards",
    subcategory: "one-piece",
    price: 390000,
    image: remote("photo-1605902711622-cfb43c4437d1"),
    description: "Set thẻ lấy cảm hứng One Piece Card Game.",
    story: "Mỗi lá bài như một mảnh hải trình, dành cho người thích phiêu lưu.",
  },
  {
    id: "p16",
    name: "Binder Album Sakura 9-Pocket",
    category: "cards",
    subcategory: "card-accessories",
    price: 240000,
    image: remote("photo-1516321318423-f06f85e504b3"),
    description: "Album 9 ô bảo vệ thẻ bài, bìa hoa sakura.",
    story: "Không chỉ cất thẻ, album còn là cách kể lại hành trình sưu tầm.",
  },
  {
    id: "p17",
    name: "Áo croptop Nadeshiko Pink",
    category: "clothing",
    subcategory: "women-tops",
    price: 390000,
    image: remote("photo-1503342217505-b0a15ec3261c"),
    badge: "New",
    description: "Áo croptop hồng trầm, hợp váy chữ A hoặc quần jean lưng cao.",
    story:
      "Sắc hồng Nadeshiko được làm dịu để dễ mặc hằng ngày nhưng vẫn nổi bật trong ảnh.",
    visualTags: ["hồng trầm", "nữ tính", "street casual", "dễ phối"],
    styleUseCase: "đi chơi, cafe, sinh nhật",
  },
  {
    id: "p18",
    name: "Quần suông nữ Sumi Black",
    category: "clothing",
    subcategory: "women-bottoms",
    price: 560000,
    image: remote("photo-1594633312681-425c7b97ccd1"),
    description:
      "Quần suông đen tôn dáng, phối đẹp với áo kem, áo hồng hoặc cardigan.",
    story:
      "Lấy cảm hứng từ nét mực sumi, chiếc quần tạo nền tối để áo và phụ kiện nổi bật.",
    visualTags: ["đen", "suông", "tối giản", "tôn dáng"],
    styleUseCase: "đi học, đi làm, đi chơi",
  },
  {
    id: "p19",
    name: "Sơ mi nam Waso Cream",
    category: "clothing",
    subcategory: "men-tops",
    price: 590000,
    image: remote("photo-1516257984-b1b4d707412e"),
    badge: "Basic",
    description:
      "Sơ mi nam màu kem, chất mềm, dễ phối cùng quần navy, kaki hoặc jean.",
    story: "Màu kem giấy washi đem lại cảm giác sạch, nhẹ và trưởng thành.",
    visualTags: ["kem", "basic", "nam", "thanh lịch"],
    styleUseCase: "đi làm, hẹn hò, gặp đối tác",
  },
  {
    id: "p20",
    name: "Quần cargo nam Kuri Brown",
    category: "clothing",
    subcategory: "men-bottoms",
    price: 720000,
    image: remote("photo-1473966968600-fa801b869a1a"),
    description:
      "Quần cargo nâu đất nhiều túi, hợp hoodie navy, áo trắng và sneaker.",
    story:
      "Sắc nâu Kuri gợi cảm giác bền bỉ, hợp người thích streetwear có tính ứng dụng.",
    visualTags: ["nâu đất", "cargo", "nam", "streetwear"],
    styleUseCase: "đi chơi, du lịch, hoạt động ngoài trời",
  },
  {
    id: "p21",
    name: "Cardigan Sakura Mist",
    category: "clothing",
    subcategory: "outerwear",
    price: 790000,
    image: remote("photo-1548883354-7622d03aca27"),
    description: "Cardigan mềm màu be hồng, khoác ngoài áo croptop hoặc sơ mi.",
    story:
      "Nhẹ như sương hoa anh đào, chiếc cardigan giúp outfit mềm và có chiều sâu hơn.",
    visualTags: ["be hồng", "mềm", "layer", "nữ tính"],
    styleUseCase: "đi cafe, đi học, chụp ảnh",
  },
  {
    id: "p22",
    name: "Sneaker trắng Shiro Walk",
    category: "clothing",
    subcategory: "footwear",
    price: 840000,
    image: remote("photo-1549298916-b41d501d3772"),
    description: "Sneaker trắng tối giản, hợp gần như mọi set đồ JAPANO.",
    story:
      "Shiro nghĩa là trắng, một đôi giày làm nền sạch cho các lớp màu Nhật cổ.",
    visualTags: ["trắng", "tối giản", "sneaker", "đa dụng"],
    styleUseCase: "đi học, đi chơi, du lịch",
  },
  {
    id: "p23",
    name: "Túi đeo chéo Suoh Mini",
    category: "home-items",
    subcategory: "bags",
    price: 460000,
    image: remote("photo-1594223274512-ad4803739b7c"),
    badge: "Accessory",
    description:
      "Túi mini đỏ Suoh, tạo điểm nhấn cho outfit kem, đen hoặc navy.",
    story: "Một chấm đỏ cổ điển có thể kéo cả set đồ trở nên có chủ đích.",
    visualTags: ["đỏ suoh", "mini bag", "điểm nhấn", "phụ kiện"],
    styleUseCase: "đi chơi, hẹn hò, lễ hội",
  },
  {
    id: "p24",
    name: "Khăn cổ Asanoha Beige",
    category: "clothing",
    subcategory: "fashion-accessories",
    price: 210000,
    image: remote("photo-1520903920243-00d872a2d1c9"),
    description:
      "Khăn cổ họa tiết asanoha, hợp phối áo sơ mi, haori hoặc cardigan.",
    story:
      "Họa tiết lá gai Nhật biểu tượng cho sự phát triển, phù hợp làm quà nhỏ tinh tế.",
    visualTags: ["be", "họa tiết Nhật", "khăn", "quà tặng"],
    styleUseCase: "quà tặng, outfit mùa lạnh",
  },
  {
    id: "p25",
    name: "Đèn lồng bàn Sakura Glow",
    category: "home-items",
    subcategory: "decor",
    price: 380000,
    image: remote("photo-1513519245088-0e12902e5a38"),
    description:
      "Đèn trang trí bàn ánh ấm, hợp góc học tập, phòng ngủ hoặc chụp sản phẩm.",
    story:
      "Ánh sáng ấm giúp những món đồ nhỏ có cảm giác như đang ở một lễ hội đêm.",
    visualTags: ["đèn", "decor", "ánh ấm", "sakura"],
    styleUseCase: "decor phòng, chụp ảnh sản phẩm",
  },
  {
    id: "p26",
    name: "Set Bento Mèo Maneki",
    category: "home-items",
    subcategory: "tableware",
    price: 330000,
    image: remote("photo-1523906630133-f6934a1ab2b9"),
    description: "Hộp bento và đũa đi kèm, thiết kế mèo may mắn dễ thương.",
    story: "Maneki-neko xuất hiện như lời chúc nhỏ mỗi bữa trưa.",
    visualTags: ["bento", "mèo", "đồ dùng", "dễ thương"],
    styleUseCase: "đi học, đi làm, quà tặng",
  },
  {
    id: "p27",
    name: "Tai nghe Sakura Pod Case",
    category: "home-items",
    subcategory: "tech-small",
    price: 180000,
    image: remote("photo-1606220945770-b5b6c2c55bf1"),
    description:
      "Ốp tai nghe màu hồng sakura, hợp set đồ trẻ trung và quà nhỏ.",
    story:
      "Một món phụ kiện nhỏ giúp đồ công nghệ bớt khô cứng và gần với thời trang hơn.",
    visualTags: ["hồng", "công nghệ nhỏ", "phụ kiện", "sakura"],
    styleUseCase: "quà nhỏ, dùng hằng ngày",
  },
  {
    id: "p28",
    name: "Bộ khuôn cơm Onigiri",
    category: "tools",
    subcategory: "kitchen-tools",
    price: 150000,
    image: remote("photo-1547592180-85f173990554"),
    description: "Khuôn cơm tam giác, dễ làm bento, phù hợp trẻ em và picnic.",
    story: "Một dụng cụ nhỏ để biến bữa cơm thành kỷ niệm dễ thương.",
    visualTags: ["bếp", "onigiri", "bento", "gia đình"],
    styleUseCase: "nấu ăn, picnic, chuẩn bị quà 1/6",
  },
  {
    id: "p29",
    name: "Kit handmade Charm Anime",
    category: "tools",
    subcategory: "craft-tools",
    price: 230000,
    image: remote("photo-1517971071642-34a2d3ecc9cd"),
    description: "Bộ làm charm nhân vật, có móc khóa, nhựa trong và sticker.",
    story:
      "Tự làm một món phụ kiện nhỏ cho nhân vật yêu thích sẽ khiến món đồ có câu chuyện riêng.",
    visualTags: ["handmade", "anime", "móc khóa", "DIY"],
    styleUseCase: "làm quà, trang trí balo",
  },
  {
    id: "p30",
    name: "Stand điện thoại Torii Red",
    category: "tools",
    subcategory: "gaming-tools",
    price: 190000,
    image: remote("photo-1516321318423-f06f85e504b3"),
    description:
      "Giá đỡ điện thoại màu đỏ torii, hợp xem anime, livestream hoặc chơi game.",
    story: "Lấy hình ảnh cổng torii làm điểm nhấn cho góc bàn gaming.",
    visualTags: ["đỏ", "gaming", "điện thoại", "góc bàn"],
    styleUseCase: "gaming, học online, xem phim",
  },
  {
    id: "p31",
    name: "Wig Care Cosplay Kit",
    category: "tools",
    subcategory: "cosplay-tools",
    price: 320000,
    image: remote("photo-1529139574466-a303027c1d8b"),
    description: "Bộ chăm wig gồm lược, xịt giữ nếp và kẹp tóc cosplay.",
    story: "Một bộ cosplay đẹp bắt đầu từ phần tóc gọn và giữ form tốt.",
    visualTags: ["cosplay", "wig", "anime", "dụng cụ"],
    styleUseCase: "cosplay, lễ hội, chụp ảnh",
  },
  {
    id: "p32",
    name: "Pokémon Booster Pastel Pack",
    category: "cards",
    subcategory: "pokemon",
    price: 260000,
    image: remote("photo-1613771404784-3a5686aa2be3"),
    badge: "Pika",
    description: "Booster Pokémon tông pastel, hợp sưu tầm hoặc quà 1/6.",
    story:
      "Mỗi pack mở ra một khoảnh khắc bất ngờ, giống cảm giác nhận quà tuổi thơ.",
    visualTags: ["pokemon", "pikachu", "booster", "trẻ em"],
    styleUseCase: "quà 1/6, sưu tầm",
  },
  {
    id: "p33",
    name: "Yu-Gi-Oh! Spellcaster Pack",
    category: "cards",
    subcategory: "yugioh",
    price: 370000,
    image: remote("photo-1606167668584-78701c57f13d"),
    description: "Gói thẻ chủ đề pháp sư, hợp người mới xây deck.",
    story: "Một chủ đề dễ bắt đầu nhưng vẫn có cá tính mạnh trên bàn đấu.",
    visualTags: ["yugioh", "deck", "spellcaster", "game"],
    styleUseCase: "chơi thẻ, sưu tầm",
  },
  {
    id: "p34",
    name: "Dragon Ball Saiyan Holo",
    category: "cards",
    subcategory: "dragon-ball",
    price: 410000,
    image: remote("photo-1612036782180-6f0b6cd846fe"),
    badge: "Rare",
    description: "Thẻ holo Dragon Ball chủ đề chiến binh Saiyan.",
    story: "Ánh holo làm cảm giác năng lượng bùng nổ rõ hơn khi trưng bày.",
    visualTags: ["dragon ball", "holo", "rare", "anime"],
    styleUseCase: "sưu tầm, quà fan anime",
  },
  {
    id: "p35",
    name: "One Piece Treasure Sleeve",
    category: "cards",
    subcategory: "card-accessories",
    price: 160000,
    image: remote("photo-1516321318423-f06f85e504b3"),
    description: "Sleeve bảo vệ thẻ bài, họa tiết kho báu hải tặc.",
    story: "Bảo vệ lá bài cũng là bảo vệ chuyến phiêu lưu của bộ sưu tập.",
    visualTags: ["sleeve", "one piece", "phụ kiện thẻ", "bảo vệ"],
    styleUseCase: "bảo vệ thẻ, trưng bày",
  },
  {
    id: "p36",
    name: "Áo thun trẻ em Pikachu Smile",
    category: "clothing",
    subcategory: "kids",
    price: 290000,
    image: remote("photo-1503919545889-aef636e10ad4"),
    badge: "Kids",
    description:
      "Áo thun trẻ em màu vàng dịu, dễ phối cùng quần short và sneaker.",
    story: "Màu vàng vui như một nụ cười, phù hợp những dịp tặng quà cho trẻ.",
    visualTags: ["trẻ em", "vàng", "pikachu mood", "quà"],
    styleUseCase: "1/6, sinh nhật, đi chơi",
  },
  {
    id: "p37",
    name: "Áo len nữ Hokkaido Oat",
    category: "clothing",
    subcategory: "women-tops",
    price: 680000,
    image: remote("photo-1543087903-1ac2ec7aa8c5"),
    badge: "Cozy",
    description:
      "Áo len màu yến mạch, cổ tròn mềm, hợp mùa lạnh và ảnh ngoài trời.",
    story:
      "Lấy cảm hứng từ tuyết Hokkaido, chiếc áo tạo cảm giác ấm nhưng không nặng nề.",
    visualTags: ["oat", "ấm", "nữ", "mùa lạnh"],
    styleUseCase: "đi học, đi cafe, Noel",
  },
  {
    id: "p38",
    name: "Váy midi Fuji Navy",
    category: "clothing",
    subcategory: "women-bottoms",
    price: 730000,
    image: remote("photo-1551163943-3f7e3eeed6e9"),
    description:
      "Váy midi navy, dáng rơi nhẹ, phối đẹp với sơ mi kem hoặc cardigan.",
    story:
      "Sắc navy trầm như bóng núi Fuji khi chiều xuống, dễ mặc nhưng vẫn có chiều sâu.",
    visualTags: ["navy", "midi", "thanh lịch", "nữ"],
    styleUseCase: "đi làm, hẹn hò, lễ hội",
  },
  {
    id: "p39",
    name: "Áo khoác bomber Kuro Street",
    category: "clothing",
    subcategory: "outerwear",
    price: 1190000,
    image: remote("photo-1520975922284-8b456906c813"),
    badge: "Street",
    description: "Bomber đen form rộng, hợp hoodie, cargo và sneaker trắng.",
    story: "Kuro là sắc đen đô thị, dành cho người muốn outfit mạnh nhưng gọn.",
    visualTags: ["đen", "bomber", "streetwear", "nam nữ"],
    styleUseCase: "đi chơi, chụp ảnh đêm, gaming event",
  },
  {
    id: "p40",
    name: "Yukata mùa hè Aoi Blue",
    category: "clothing",
    subcategory: "japan-traditional",
    price: 1680000,
    image: remote("photo-1493976040374-85c8e12f0c0e"),
    badge: "Matsuri",
    description: "Yukata xanh dịu, hợp lễ hội hè, chụp ảnh và concept Nhật cổ.",
    story: "Aoi gợi màu lá non và bầu trời mùa hè trong các lễ hội matsuri.",
    visualTags: ["yukata", "xanh", "lễ hội", "truyền thống"],
    styleUseCase: "lễ hội, du lịch, chụp ảnh",
  },
  {
    id: "p41",
    name: "Áo bà ba Mộc Nâu",
    category: "clothing",
    subcategory: "vietnam-traditional",
    price: 890000,
    image: remote("photo-1500530855697-b586d89ba3ee"),
    description: "Áo bà ba nâu mộc, mềm, phù hợp Tết, lễ và concept Việt Nam.",
    story:
      "Một sắc nâu gần đất, nhắc đến sự giản dị và ấm áp của trang phục Việt.",
    visualTags: ["nâu", "Việt Nam", "truyền thống", "mộc"],
    styleUseCase: "Tết, 30/4, chụp ảnh gia đình",
  },
  {
    id: "p42",
    name: "Mũ bucket Sakura Beige",
    category: "clothing",
    subcategory: "fashion-accessories",
    price: 260000,
    image: remote("photo-1521369909029-2afed882baee"),
    description: "Mũ bucket be thêu sakura nhỏ, che nắng và làm mềm outfit.",
    story:
      "Một phụ kiện nhẹ giúp set đồ đời thường có chất Nhật mà không quá cầu kỳ.",
    visualTags: ["mũ", "be", "sakura", "phụ kiện"],
    styleUseCase: "đi chơi, du lịch, 1/6",
  },
  {
    id: "p43",
    name: "Bình nước Fuji Clear",
    category: "home-items",
    subcategory: "tableware",
    price: 220000,
    image: remote("photo-1523362628745-0c100150b504"),
    description: "Bình nước trong nhẹ, nắp chắc, hợp đi học, gym và du lịch.",
    story: "Thiết kế trong suốt như mặt hồ nhìn về Fuji, đơn giản và sạch.",
    visualTags: ["bình nước", "đi học", "du lịch", "clear"],
    styleUseCase: "đi học, đi làm, thể thao",
  },
  {
    id: "p44",
    name: "Set sticker Maneki Neko",
    category: "home-items",
    subcategory: "stationery",
    price: 79000,
    image: remote("photo-1513475382585-d06e58bcb0e0"),
    description:
      "Sticker mèo may mắn cho laptop, sổ tay, điện thoại và quà nhỏ.",
    story: "Mỗi sticker là một lời chúc nhỏ: học tốt, may mắn, gặp điều vui.",
    visualTags: ["sticker", "mèo", "quà nhỏ", "học tập"],
    styleUseCase: "20/11, sinh nhật, quà học sinh",
  },
  {
    id: "p45",
    name: "Móc khóa Torii Lucky",
    category: "home-items",
    subcategory: "collectibles",
    price: 99000,
    image: remote("photo-1513151233558-d860c5398176"),
    description: "Móc khóa cổng torii đỏ, hợp treo balo, túi hoặc tặng bạn bè.",
    story:
      "Torii là biểu tượng bước qua một không gian mới, món nhỏ cho khởi đầu tốt.",
    visualTags: ["móc khóa", "torii", "đỏ", "quà"],
    styleUseCase: "quà tặng, balo, anime event",
  },
  {
    id: "p46",
    name: "Bộ bút brush Sumi Ink",
    category: "tools",
    subcategory: "school-tools",
    price: 180000,
    image: remote("photo-1513364776144-60967b0f800f"),
    description:
      "Bộ bút brush nhiều đầu, hợp ghi chú, vẽ line art và lettering.",
    story: "Đường bút lấy cảm hứng từ mực sumi, vừa học tập vừa sáng tạo.",
    visualTags: ["bút", "sumi", "học tập", "vẽ"],
    styleUseCase: "20/11, học tập, handmade",
  },
  {
    id: "p47",
    name: "Pad chuột Wave Kanagawa",
    category: "tools",
    subcategory: "gaming-tools",
    price: 260000,
    image: remote("photo-1527814050087-3793815479db"),
    description:
      "Pad chuột lớn họa tiết sóng Kanagawa, hợp góc học tập và gaming.",
    story: "Con sóng lớn được đưa vào góc bàn để tạo năng lượng tập trung.",
    visualTags: ["gaming", "pad chuột", "sóng", "bàn học"],
    styleUseCase: "gaming, học online, làm việc",
  },
  {
    id: "p48",
    name: "Anime Idol Limited Card Set",
    category: "cards",
    subcategory: "anime-cards",
    price: 310000,
    image: remote("photo-1550745165-9bc0b252726f"),
    badge: "Limited",
    description:
      "Set thẻ nhân vật anime/idol limited, hợp sưu tầm và trưng bày.",
    story:
      "Mỗi lá thẻ giữ một khoảnh khắc nhân vật, phù hợp người thích kể chuyện bằng bộ sưu tập.",
    visualTags: ["anime", "idol", "limited", "sưu tầm"],
    styleUseCase: "quà fan anime, trưng bày",
  },
  {
    id: "p49",
    name: "Áo khoác gió Hinode Light",
    category: "clothing",
    subcategory: "outerwear",
    price: 640000,
    image: remote("photo-1496747611176-843222e1e57c"),
    badge: "Light",
    description: "Áo khoác gió nhẹ, chống nắng nhẹ, hợp đi học và đi chơi.",
    story:
      "Hinode là bình minh, chiếc áo dành cho những buổi ra ngoài cần gọn và sáng.",
    visualTags: ["áo khoác", "nhẹ", "daily", "unisex"],
    styleUseCase: "đi học, đi chơi, du lịch",
  },
  {
    id: "p50",
    name: "Chân váy xếp ly Sakura School",
    category: "clothing",
    subcategory: "women-bottoms",
    price: 490000,
    image: remote("photo-1554412933-514a83d2f3c8"),
    badge: "School",
    description:
      "Chân váy xếp ly màu be hồng, phối đẹp cùng sơ mi kem hoặc cardigan.",
    story:
      "Lấy cảm hứng đồng phục học đường Nhật, làm mềm lại để mặc hằng ngày.",
    visualTags: ["váy", "xếp ly", "nữ", "học đường"],
    styleUseCase: "đi học, cafe, chụp ảnh",
  },
  {
    id: "p51",
    name: "Áo thun nam Shiba Graphic",
    category: "clothing",
    subcategory: "men-tops",
    price: 350000,
    image: remote("photo-1521572163474-6864f9cf17ab"),
    badge: "Graphic",
    description:
      "Áo thun graphic shiba, form rộng vừa, hợp quần cargo và sneaker.",
    story: "Một chú shiba nhỏ khiến outfit streetwear bớt căng và gần gũi hơn.",
    visualTags: ["áo thun", "graphic", "shiba", "unisex"],
    styleUseCase: "đi chơi, gaming event, du lịch",
  },
  {
    id: "p52",
    name: "Quần short Kaze Summer",
    category: "clothing",
    subcategory: "men-bottoms",
    price: 420000,
    image: remote("photo-1506629905607-d405b7a30db9"),
    description: "Quần short nhẹ, hợp mùa nóng, đi biển, lễ hội và du lịch.",
    story: "Kaze là gió, món đồ để outfit mùa hè thoáng và dễ di chuyển.",
    visualTags: ["short", "mùa hè", "du lịch", "thoải mái"],
    styleUseCase: "1/6, du lịch, đi chơi",
  },
  {
    id: "p53",
    name: "Set kẹp tóc Hana Pastel",
    category: "home-items",
    subcategory: "collectibles",
    price: 95000,
    image: remote("photo-1515562141207-7a88fb7ce338"),
    description: "Kẹp tóc hoa pastel, hợp outfit nữ tính và làm quà nhỏ.",
    story:
      "Một chi tiết nhỏ có thể khiến gương mặt sáng và outfit có điểm nhấn.",
    visualTags: ["kẹp tóc", "pastel", "phụ kiện", "quà"],
    styleUseCase: "8/3, 20/10, sinh nhật",
  },
  {
    id: "p54",
    name: "Túi tote Fuji Canvas",
    category: "home-items",
    subcategory: "bags",
    price: 260000,
    image: remote("photo-1544816155-12df9643f363"),
    description:
      "Tote canvas in núi Fuji, đựng laptop nhẹ, sách và đồ cá nhân.",
    story: "Một chiếc túi như poster nhỏ của chuyến đi, dễ dùng mỗi ngày.",
    visualTags: ["tote", "canvas", "fuji", "đi học"],
    styleUseCase: "đi học, đi làm, quà tặng",
  },
  {
    id: "p55",
    name: "Ly giữ nhiệt Hoshi Cream",
    category: "home-items",
    subcategory: "tableware",
    price: 310000,
    image: remote("photo-1542556398-95fb5b9f9b2d"),
    description: "Ly giữ nhiệt màu kem, hợp đi học, đi làm và picnic.",
    story: "Hoshi là ngôi sao nhỏ giữ đồ uống ấm như một thói quen tử tế.",
    visualTags: ["ly", "giữ nhiệt", "kem", "daily"],
    styleUseCase: "đi học, văn phòng, du lịch",
  },
  {
    id: "p56",
    name: "Bộ đũa gỗ Kumo Pair",
    category: "home-items",
    subcategory: "tableware",
    price: 145000,
    image: remote("photo-1610701596007-11502861dcfa"),
    description: "Bộ đũa gỗ đôi, hộp vải nhỏ, hợp làm quà gia đình.",
    story:
      "Một món đồ dùng nhỏ nhưng xuất hiện trong rất nhiều bữa cơm thân thuộc.",
    visualTags: ["đũa", "gỗ", "gia đình", "quà"],
    styleUseCase: "Tết, tân gia, quà gia đình",
  },
  {
    id: "p57",
    name: "Dao rọc giấy Kiri Craft",
    category: "tools",
    subcategory: "craft-tools",
    price: 120000,
    image: remote("photo-1581235720704-06d3acfcb36f"),
    description: "Dao rọc giấy mini cho handmade, scrapbook và mô hình giấy.",
    story:
      "Kiri nghĩa là cắt, một dụng cụ gọn giúp ý tưởng thủ công chính xác hơn.",
    visualTags: ["craft", "dao", "handmade", "học tập"],
    styleUseCase: "DIY, học tập, làm quà",
  },
  {
    id: "p58",
    name: "Bộ sleeve Holo Clear 100 lá",
    category: "tools",
    subcategory: "card-tools",
    price: 135000,
    image: remote("photo-1602524814575-f9c1d06aa0b9"),
    description: "Sleeve trong bảo vệ thẻ Pokémon, Yu-Gi-Oh và card sưu tầm.",
    story:
      "Lá bài đẹp cần lớp áo trong để giữ lại cạnh, góc và ký ức khi mở pack.",
    visualTags: ["sleeve", "card", "holo", "bảo vệ"],
    styleUseCase: "sưu tầm, chơi thẻ, quà fan card",
  },
  {
    id: "p59",
    name: "Pokémon Eevee Gift Card",
    category: "cards",
    subcategory: "pokemon",
    price: 320000,
    image: remote("photo-1613771404784-3a5686aa2be3"),
    badge: "Gift",
    description: "Thẻ Eevee phong cách quà tặng, hợp sinh nhật và 1/6.",
    story:
      "Eevee là biểu tượng của nhiều lựa chọn, phù hợp người đang tìm phong cách riêng.",
    visualTags: ["pokemon", "eevee", "gift", "trẻ em"],
    styleUseCase: "1/6, sinh nhật, sưu tầm",
  },
  {
    id: "p60",
    name: "Yu-Gi-Oh! Blue Eyes Display",
    category: "cards",
    subcategory: "yugioh",
    price: 540000,
    image: remote("photo-1606167668584-78701c57f13d"),
    badge: "Display",
    description: "Thẻ trưng bày chủ đề rồng xanh, hợp decor góc gaming.",
    story:
      "Một biểu tượng sức mạnh cổ điển cho người thích thẻ bài và góc trưng bày.",
    visualTags: ["yugioh", "blue eyes", "display", "gaming"],
    styleUseCase: "sưu tầm, decor, quà fan yugioh",
  },
];

export const products: Product[] = rawProducts.map(withProductDefaults);

export const accessories = products.filter((p) =>
  ["fashion-accessories", "card-accessories", "bags", "stationery"].includes(
    p.subcategory,
  ),
);

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}
