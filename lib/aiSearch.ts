import { Product, products } from '../data/catalog';
import { OccasionRecommendation } from '../data/occasions';

export type SearchSuggestion = {
  id: string;
  type: 'product' | 'query' | 'ai' | 'recent' | 'category';
  title: string;
  subtitle: string;
  product?: Product;
  query?: string;
  confidence?: number;
  productIds?: string[];
  reason?: string;
};

const outfitHints = [
  'mặc gì', 'mac gi', 'phối', 'phoi', 'outfit', 'hợp gì', 'hop gi', 'đi chơi', 'di choi',
  'đi học', 'di hoc', 'đi làm', 'di lam', 'hôm nay', 'hom nay', 'tết', 'tet', 'noel',
  'quà', 'qua', 'sinh nhật', 'sinh nhat', 'ngày lễ', 'ngay le', 'combo', 'set đồ', 'set do'
];

export function normalizeSearchText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productHaystack(product: Product) {
  return normalizeSearchText(`${product.name} ${product.category} ${product.subcategory} ${product.description} ${product.story} ${(product.visualTags || []).join(' ')} ${product.styleUseCase || ''}`);
}

export function isConversationalSearch(query: string) {
  const q = normalizeSearchText(query);
  return outfitHints.some((hint) => q.includes(normalizeSearchText(hint))) || q.split(' ').length >= 3;
}

export function rankProductsForQuery(query: string, sourceProducts: Product[] = products, occasion: OccasionRecommendation | null = null) {
  const q = normalizeSearchText(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  const conv = isConversationalSearch(query);
  return sourceProducts
    .map((product) => {
      const haystack = productHaystack(product);
      let score = 0;
      if (!q) score += occasion?.productIds?.includes(product.id) ? 6 : 1;
      if (q && haystack.includes(q)) score += q.length === 1 ? 2 : 10;
      tokens.forEach((token) => {
        if (!token) return;
        if (haystack.includes(token)) score += token.length === 1 ? 1 : 3;
        if (product.name.toLowerCase().startsWith(token)) score += 3;
      });
      if (occasion?.productIds?.includes(product.id)) score += 4;
      if (/ao|shirt|top|mac/.test(q) && /tops|outerwear|traditional|cosplay/.test(product.subcategory)) score += 4;
      if (/quan|vay|pants|bottom/.test(q) && /bottoms|traditional/.test(product.subcategory)) score += 4;
      if (/giay|shoe|dep|sneaker/.test(q) && product.subcategory === 'footwear') score += 5;
      if (/the|card|pokemon|pikachu|yugioh|one piece|dragon/.test(q) && product.category === 'cards') score += 6;
      if (/dung cu|tool|bep|gaming|cosplay/.test(q) && product.category === 'tools') score += 4;
      if (/qua|gift|sinh nhat|1 6|20 10|8 3|noel|tet/.test(q) && ['home-items', 'cards', 'clothing'].includes(product.category)) score += 3;
      if (conv && ['clothing', 'home-items'].includes(product.category)) score += 2;
      return { product, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function buildLocalSearchSuggestions(query: string, occasion: OccasionRecommendation | null, limit = 10): SearchSuggestion[] {
  const q = normalizeSearchText(query);
  const conversational = isConversationalSearch(query);
  const ranked = rankProductsForQuery(query, products, occasion);

  if (!q) {
    const seed = occasion?.productIds?.length
      ? products.filter((p) => occasion.productIds.includes(p.id))
      : products.slice(0, 6);
    return seed.slice(0, 6).map((product, index) => ({
      id: `seed-${product.id}-${index}`,
      type: 'product',
      title: product.name,
      subtitle: occasion ? `Hợp với ${occasion.name}: ${occasion.reason}` : product.description,
      product,
      confidence: 0.82,
      reason: occasion?.reason,
    }));
  }

  const direct = ranked.slice(0, limit).map(({ product, score }, index) => ({
    id: `product-${product.id}-${index}`,
    type: 'product' as const,
    title: product.name,
    subtitle: `AI khớp theo tên, danh mục, ảnh/tag và ngữ cảnh · ${Math.min(99, Math.max(35, score * 9))}%`,
    product,
    confidence: Math.min(0.98, score / 14),
    reason: `Phù hợp với truy vấn “${query}” nhờ màu sắc, form dáng, nhóm ${product.subcategory} và câu chuyện sản phẩm.`,
  }));

  const aiSuggestions: SearchSuggestion[] = [];
  if (conversational) {
    const topIds = ranked.slice(0, 5).map((x) => x.product.id);
    const occasionPart = occasion ? ` theo ${occasion.name}` : '';
    aiSuggestions.push(
      {
        id: `ai-outfit-${q}`,
        type: 'ai',
        title: `AI phối đồ${occasionPart}`,
        subtitle: 'Bấm để xem set sản phẩm + lý do chọn như chatbot stylist.',
        query,
        productIds: topIds,
        reason: 'Truy vấn có ngữ nghĩa tư vấn trang phục/quà tặng, nên ưu tiên combo thay vì chỉ tìm theo tên.',
      },
      {
        id: `ai-combo-${q}`,
        type: 'ai',
        title: 'AI tạo combo mua kèm',
        subtitle: 'Sản phẩm chính + phụ kiện + đồ dùng bổ trợ để tăng độ hoàn chỉnh.',
        query: `combo ${query}`,
        productIds: topIds,
      },
    );
  }

  const querySuggestions: SearchSuggestion[] = [
    { id: 'q-tet', type: 'query', title: 'Set đồ đi Tết + quà biếu', subtitle: 'Áo truyền thống, phụ kiện đỏ, lì xì và đồ dùng tặng kèm', query: 'set đồ đi Tết quà biếu' },
    { id: 'q-national', type: 'query', title: 'Đồ đi chơi 30/4, 1/5, 2/9', subtitle: 'Outfit thoải mái, balo, túi và phụ kiện du lịch', query: 'đồ đi chơi dịp lễ quốc gia' },
    { id: 'q-child', type: 'query', title: 'Quà 1/6 cho trẻ em', subtitle: 'Thẻ bài, snack Nhật, đồ dễ thương và set quà nhỏ', query: 'quà 1/6 cho trẻ em' },
    { id: 'q-anime', type: 'query', title: 'Cosplay anime / game', subtitle: 'Trang phục, đạo cụ và thẻ bài nhân vật', query: 'cosplay anime game' },
    { id: 'q-card', type: 'query', title: 'Thẻ bài Pokémon / Yu-Gi-Oh!', subtitle: 'Booster, binder, sleeve, card hiếm', query: 'thẻ bài pokemon yugioh' },
  ].filter((s) => normalizeSearchText(s.title + ' ' + s.subtitle).includes(q) || q.length > 5).slice(0, 3);

  const seen = new Set<string>();
  return [...aiSuggestions, ...direct, ...querySuggestions]
    .filter((item) => {
      const key = item.product?.id || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
