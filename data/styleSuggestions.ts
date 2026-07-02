import { Product, products } from './catalog';

export type OutfitSuggestion = {
  id: string;
  title: string;
  reason: string;
  items: Product[];
  mood: string;
};

const byIds = (ids: string[]) => ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];

const rules: Record<string, { title: string; reason: string; mood: string; ids: string[] }[]> = {
  'women-tops': [
    { title: 'Set nữ thanh lịch đi cafe', mood: 'dịu, sạch, tôn dáng', ids: ['p18', 'p21', 'p22', 'p23'], reason: 'AI nhận diện áo nữ cần phần dưới tối màu để giữ tỉ lệ người gọn hơn. Quần suông đen kéo dài chân, cardigan be hồng làm mềm outfit, sneaker trắng giữ tổng thể sạch và túi Suoh tạo điểm nhấn.' },
    { title: 'Set nữ trẻ trung đi chơi', mood: 'tươi, năng động', ids: ['p17', 'p18', 'p22', 'p27'], reason: 'Tông hồng và đen tạo tương phản rõ trên ảnh. Phụ kiện công nghệ màu sakura giúp set đồ có chi tiết nhỏ đồng bộ màu.' },
  ],
  'women-bottoms': [
    { title: 'Set cân bằng tỉ lệ với quần/váy nữ', mood: 'tối giản, dễ mặc', ids: ['p2', 'p21', 'p22', 'p24'], reason: 'Quần/váy tối màu hợp áo kem sáng để đưa điểm nhìn lên phần thân trên. Khăn họa tiết Nhật thêm chiều sâu nhưng không làm rối ảnh.' },
  ],
  'men-tops': [
    { title: 'Set nam streetwear gọn', mood: 'nam tính, ứng dụng', ids: ['p20', 'p22', 'p9'], reason: 'AI dựa vào form áo nam rộng vừa nên ghép quần cargo để cân bằng khối. Sneaker trắng làm outfit nhẹ hơn, balo canvas hợp di chuyển hằng ngày.' },
    { title: 'Set nam tối giản lịch sự', mood: 'sạch, trưởng thành', ids: ['p19', 'p20', 'p22'], reason: 'Áo kem sáng đi với nâu Kuri cho cảm giác ấm và trưởng thành. Bộ màu này dễ dùng khi đi làm, hẹn hò hoặc gặp bạn bè.' },
  ],
  'men-bottoms': [
    { title: 'Set quần nam đi chơi', mood: 'bền bỉ, tự do', ids: ['p3', 'p19', 'p22', 'p30'], reason: 'Quần cargo nâu hợp áo navy/kem vì tạo bảng màu Nhật cổ rõ ràng. Stand điện thoại là phụ kiện đi kèm cho người thích gaming và di chuyển.' },
  ],
  outerwear: [
    { title: 'Layer Nhật cổ đời thường', mood: 'ấm, nghệ thuật', ids: ['p2', 'p18', 'p22', 'p24'], reason: 'Áo khoác/cardigan cần lớp trong sáng và quần nền tối để không bị nặng hình. Khăn asanoha tạo chất Nhật cổ đúng tinh thần JAPANO.' },
  ],
  'japan-traditional': [
    { title: 'Haori hiện đại', mood: 'Nhật cổ, tinh tế', ids: ['p18', 'p22', 'p24', 'p23'], reason: 'Haori có hình khối truyền thống nên AI chọn quần suông đen và sneaker trắng để hiện đại hóa. Túi Suoh tạo điểm đỏ lễ hội, khăn asanoha giữ nét Nhật.' },
  ],
  'vietnam-traditional': [
    { title: 'Áo dài lễ/Tết', mood: 'trang trọng, mềm mại', ids: ['p23', 'p24', 'p25'], reason: 'Áo dài cần phụ kiện nhỏ, không cồng kềnh. Túi đỏ Suoh hợp dịp lễ/Tết, khăn be giữ tổng thể trang nhã, đèn lồng dùng để chụp ảnh lookbook.' },
  ],
  kids: [
    { title: 'Set quà cho trẻ em', mood: 'vui, an toàn, dễ thương', ids: ['p36', 'p22', 'p26', 'p32'], reason: 'Tông vàng/trắng tạo cảm giác vui. Bento mèo và Pokémon booster là combo quà hợp 1/6 hoặc sinh nhật trẻ em.' },
  ],
  cosplay: [
    { title: 'Cosplay đi lễ hội', mood: 'anime, nổi bật', ids: ['p31', 'p29', 'p22', 'p30'], reason: 'Trang phục cosplay cần dụng cụ giữ form tóc và phụ kiện nhân vật. Sneaker trắng giúp di chuyển thoải mái ở lễ hội, charm anime làm điểm nhận diện.' },
  ],
  footwear: [
    { title: 'Sneaker trắng đa dụng', mood: 'sạch, dễ phối', ids: ['p2', 'p18', 'p21', 'p23'], reason: 'Giày trắng là nền an toàn. AI ghép áo kem, quần đen và túi đỏ để set đồ có đủ sáng - tối - điểm nhấn.' },
  ],
  'fashion-accessories': [
    { title: 'Phụ kiện tạo điểm nhấn', mood: 'có chủ đích', ids: ['p2', 'p18', 'p21', 'p22'], reason: 'Phụ kiện nên đi cùng outfit nền trung tính. Khi nền kem/đen/be đủ sạch, chi tiết túi/khăn sẽ nổi bật mà không bị rối.' },
  ],
  bags: [
    { title: 'Set đi học/đi làm với túi balo', mood: 'gọn, tiện, lịch sự', ids: ['p19', 'p20', 'p22', 'p8'], reason: 'Túi/balo cần đi cùng outfit thực dụng. Sơ mi kem + cargo nâu + sneaker trắng tạo set dễ dùng, sổ Sakura đi kèm đúng nhu cầu học/làm.' },
  ],
  stationery: [
    { title: 'Combo quà tri ân', mood: 'nhẹ nhàng, lịch sự', ids: ['p8', 'p24', 'p25'], reason: 'Sổ tay là quà an toàn cho 20/11 hoặc sinh nhật. Khăn và đèn trang trí làm combo quà có cảm xúc hơn, không quá riêng tư.' },
  ],
  tableware: [
    { title: 'Set quà nhà bếp Nhật', mood: 'ấm, gia đình', ids: ['p7', 'p26', 'p28', 'p25'], reason: 'Bộ trà, bento và khuôn onigiri có cùng ngôn ngữ hình ảnh Nhật. Đèn lồng bàn dùng để decor góc ăn hoặc chụp món.' },
  ],
  decor: [
    { title: 'Góc phòng Nhật cổ', mood: 'ấm, yên tĩnh', ids: ['p25', 'p8', 'p7', 'p24'], reason: 'Decor cần tạo không khí. Đèn ấm, sổ tay và bộ trà tạo một góc sinh hoạt có câu chuyện, khăn asanoha thêm họa tiết mềm.' },
  ],
  'tech-small': [
    { title: 'Set công nghệ nhỏ dễ thương', mood: 'trẻ, tiện', ids: ['p27', 'p30', 'p9'], reason: 'Ốp tai nghe và stand điện thoại là phụ kiện có cùng công năng hằng ngày. Balo canvas giúp mang đồ công nghệ gọn hơn.' },
  ],
  'kitchen-tools': [
    { title: 'Combo bento tại nhà', mood: 'gọn, gia đình', ids: ['p28', 'p26', 'p7'], reason: 'Khuôn onigiri nên đi kèm hộp bento và bộ trà để tạo trải nghiệm đầy đủ: chuẩn bị, mang đi và thưởng thức.' },
  ],
  'craft-tools': [
    { title: 'Combo handmade anime', mood: 'sáng tạo, cá nhân', ids: ['p29', 'p31', 'p16', 'p35'], reason: 'Dụng cụ handmade hợp với cosplay và sưu tầm. Charm, wig kit và album/sleeve giúp người dùng vừa làm phụ kiện vừa bảo quản bộ sưu tập.' },
  ],
  'gaming-tools': [
    { title: 'Góc gaming JAPANO', mood: 'gọn, có màu nhấn', ids: ['p30', 'p12', 'p35', 'p33'], reason: 'Stand điện thoại, deck box và sleeve đều phục vụ góc chơi game/thẻ bài. Màu đỏ Torii tạo điểm nhấn trên bàn.' },
  ],
  pokemon: [
    { title: 'Combo quà Pokémon / Pikachu', mood: 'vui, sưu tầm', ids: ['p13', 'p32', 'p36', 'p16'], reason: 'Thẻ Pokémon nên đi kèm áo trẻ em hoặc album để tăng giá trị quà. AI chọn cùng tông vui và có chỗ lưu giữ thẻ.' },
  ],
  yugioh: [
    { title: 'Combo bắt đầu Yu-Gi-Oh!', mood: 'chiến thuật, gọn', ids: ['p14', 'p33', 'p12', 'p35'], reason: 'Deck và booster cần deck box/sleeve để chơi thật. Combo này phù hợp người mới bắt đầu nhưng vẫn bảo vệ thẻ tốt.' },
  ],
  'one-piece': [
    { title: 'Combo fan One Piece', mood: 'phiêu lưu, sưu tầm', ids: ['p15', 'p35', 'p16'], reason: 'Leader pack cần sleeve và binder để lưu giữ. Chủ đề kho báu tạo câu chuyện đồng bộ với One Piece.' },
  ],
  'dragon-ball': [
    { title: 'Combo thẻ holo trưng bày', mood: 'năng lượng, nổi bật', ids: ['p34', 'p16', 'p35'], reason: 'Thẻ holo cần binder/sleeve để tránh trầy. Khi trưng bày, phụ kiện bảo vệ làm thẻ giữ giá trị lâu hơn.' },
  ],
  'card-accessories': [
    { title: 'Bộ bảo vệ thẻ bài', mood: 'gọn, bền', ids: ['p16', 'p35', 'p12', 'p13'], reason: 'Album, sleeve và deck box là bộ ba cơ bản để bảo vệ thẻ. Ghép thêm một lá/pack chính giúp người dùng có combo mua ngay.' },
  ],
};

export function getOutfitSuggestions(product: Product): OutfitSuggestion[] {
  const direct = rules[product.subcategory] || [];
  const categoryFallback = product.category === 'cards'
    ? rules['card-accessories']
    : product.category === 'tools'
      ? rules['craft-tools']
      : product.category === 'home-items'
        ? rules.decor
        : rules['women-tops'];

  const source = direct.length ? direct : categoryFallback;
  return source.slice(0, 3).map((rule, index) => ({
    id: `${product.id}-style-${index}`,
    title: rule.title,
    reason: rule.reason,
    mood: rule.mood,
    items: [product, ...byIds(rule.ids).filter((p) => p.id !== product.id)].slice(0, 5),
  }));
}

export function buildVisualPrompt(product: Product) {
  return [
    `Sản phẩm chính: ${product.name}`,
    `Danh mục: ${product.category}/${product.subcategory}`,
    `Mô tả: ${product.description}`,
    `Câu chuyện: ${product.story}`,
    `Ảnh sản phẩm: ${product.image}`,
    `Tag thị giác: ${(product.visualTags || []).join(', ')}`,
  ].join('\n');
}
