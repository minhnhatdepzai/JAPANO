import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeApiUrl(value?: string | null) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'auto') return '';
  return text.replace(/\/+$/, '');
}

function getWebHostApiUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  const { protocol, hostname } = window.location;
  if (!hostname) return '';
  const scheme = protocol === 'https:' ? 'https' : 'http';
  return `${scheme}://${hostname}:4000`;
}

function getExpoHostApiUrl() {
  const candidates = [
    (Constants as any)?.expoConfig?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const host = String(candidate).split(':')[0];
    if (host) return `http://${host}:4000`;
  }
  return '';
}

const envApiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
const autoApiUrl = normalizeApiUrl(Platform.OS === 'web' ? getWebHostApiUrl() : getExpoHostApiUrl());
const localWebApiUrl = Platform.OS === 'web' ? 'http://localhost:4000' : '';
const androidEmulatorApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : '';

// Web ưu tiên host hiện tại để tránh lỗi .env còn IP LAN cũ sau khi đổi Wi-Fi.
export const API_URL = normalizeApiUrl(
  Platform.OS === 'web'
    ? autoApiUrl || envApiUrl || localWebApiUrl
    : envApiUrl || autoApiUrl || androidEmulatorApiUrl || 'http://localhost:4000',
);

const API_TIMEOUT_MS = Math.max(3500, Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 12000));

function parseJsonSafely(text: string) {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function backendConnectionMessage(path: string, error: any) {
  const reason = error?.name === 'AbortError' ? 'hết thời gian chờ' : (error?.message || 'không có phản hồi');
  return `Không kết nối được backend (${reason}) tại ${API_URL}${path}. Hãy chạy backend bằng "npm run start-server" hoặc START_HERE_WINDOWS.bat, rồi mở thử ${API_URL}/api/health. Nếu bạn vừa đổi Wi-Fi/IP, hãy chạy Expo với -c để xóa cache.`;
}

async function request(path: string, options: RequestInit = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller?.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const text = await res.text();
    const data = parseJsonSafely(text);
    if (!res.ok) throw new Error(data.message || text || `HTTP ${res.status}`);
    return data;
  } catch (error: any) {
    if (error?.message?.startsWith('Không kết nối được backend')) throw error;
    if (error?.name === 'AbortError' || error instanceof TypeError || /Network request failed|Failed to fetch/i.test(String(error?.message || ''))) {
      throw new Error(backendConnectionMessage(path, error));
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  health: () => request('/api/health'),
  getCloudinaryConfig: () => request('/api/cloudinary/config'),
  visionHealth: () => request('/api/vision/health'),
  register: (body: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body: any) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  getCustomer: (userId: string) => request(`/api/customers/${encodeURIComponent(userId)}`),
  saveCustomer: (body: any) => request('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  saveUserSettings: (userId: string, settings: any) => request(`/api/users/${encodeURIComponent(userId)}/settings`, { method: 'POST', body: JSON.stringify(settings) }),
  getAdminOverview: (adminId: string) => request(`/api/admin/overview?adminId=${encodeURIComponent(adminId)}`),
  getAdminUsers: (adminId: string) => request(`/api/admin/users?adminId=${encodeURIComponent(adminId)}`),
  setAdminUserRole: (adminId: string, targetUserId: string, role: 'admin' | 'customer') => request(`/api/admin/users/${encodeURIComponent(targetUserId)}/role`, { method: 'PATCH', body: JSON.stringify({ adminId, role }) }),
  adjustAdminUserCoins: (adminId: string, targetUserId: string, delta: number) => request(`/api/admin/users/${encodeURIComponent(targetUserId)}/coins`, { method: 'PATCH', body: JSON.stringify({ adminId, delta }) }),
  getAdminProducts: (adminId: string) => request(`/api/admin/products?adminId=${encodeURIComponent(adminId)}`),
  saveAdminProduct: (adminId: string, body: any) => request('/api/admin/products', { method: 'POST', body: JSON.stringify({ ...body, adminId }) }),
  updateAdminProduct: (adminId: string, productId: string, body: any) => request(`/api/admin/products/${encodeURIComponent(productId)}`, { method: 'PATCH', body: JSON.stringify({ ...body, adminId }) }),
  changeAdminProductPrice: (adminId: string, productId: string, percent: number) => request(`/api/admin/products/${encodeURIComponent(productId)}/price`, { method: 'PATCH', body: JSON.stringify({ adminId, percent }) }),
  setAdminProductHidden: (adminId: string, productId: string, hidden: boolean) => request(`/api/admin/products/${encodeURIComponent(productId)}/visibility`, { method: 'PATCH', body: JSON.stringify({ adminId, hidden }) }),
  getAdminOrders: (adminId: string) => request(`/api/admin/orders?adminId=${encodeURIComponent(adminId)}`),
  updateAdminOrderStatus: (adminId: string, orderId: string, status: string, note = '') => request(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify({ adminId, status, note }) }),
  adminQuickOrderSuccess: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/success`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),
  adminQuickOrderCancel: (adminId: string, orderId: string) => request(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),
  getAdminPayments: (adminId: string) => request(`/api/admin/payments?adminId=${encodeURIComponent(adminId)}`),
  getAdminVouchers: (adminId: string) => request(`/api/admin/vouchers?adminId=${encodeURIComponent(adminId)}`),
  saveAdminVoucher: (adminId: string, body: any) => request('/api/admin/vouchers', { method: 'POST', body: JSON.stringify({ ...body, adminId }) }),
  updateAdminVoucher: (adminId: string, voucherId: string, body: any) => request(`/api/admin/vouchers/${encodeURIComponent(voucherId)}`, { method: 'PATCH', body: JSON.stringify({ ...body, adminId }) }),
  sendAdminNotification: (adminId: string, body: any) => request('/api/admin/notifications', { method: 'POST', body: JSON.stringify({ ...body, adminId }) }),
  getBannedWords: (adminId: string) => request(`/api/admin/banned-words?adminId=${encodeURIComponent(adminId)}`),
  addBannedWord: (adminId: string, word: string, severity = 'block') => request('/api/admin/banned-words', { method: 'POST', body: JSON.stringify({ adminId, word, severity }) }),
  deleteBannedWord: (adminId: string, id: string) => request(`/api/admin/banned-words/${encodeURIComponent(id)}?adminId=${encodeURIComponent(adminId)}`, { method: 'DELETE' }),
  getAdminGames: (adminId: string) => request(`/api/admin/games?adminId=${encodeURIComponent(adminId)}`),
  saveAdminGame: (adminId: string, body: any) => request('/api/admin/games', { method: 'POST', body: JSON.stringify({ ...body, adminId }) }),
  updateAdminGame: (adminId: string, gameId: string, body: any) => request(`/api/admin/games/${encodeURIComponent(gameId)}`, { method: 'PATCH', body: JSON.stringify({ ...body, adminId }) }),
  deleteAdminGame: (adminId: string, gameId: string) => request(`/api/admin/games/${encodeURIComponent(gameId)}?adminId=${encodeURIComponent(adminId)}`, { method: 'DELETE' }),
  getTryOnUsage: (userId: string) => request(`/api/users/${encodeURIComponent(userId)}/try-on-usage`),
  upgradeVip: (userId: string, paymentMethod = 'demo-vip', paymentIntentId = '') => request('/api/vip/upgrade', { method: 'POST', body: JSON.stringify({ userId, paymentMethod, paymentIntentId }) }),
  getStripeConfig: () => request('/api/stripe/config'),
  createStripePaymentSheet: (body: any) => request('/api/stripe/payment-sheet', { method: 'POST', body: JSON.stringify(body) }),
  confirmVipPayment: (body: any) => request('/api/stripe/confirm-vip', { method: 'POST', body: JSON.stringify(body) }),
  confirmStripeOrderPayment: (body: any) => request('/api/stripe/confirm-order', { method: 'POST', body: JSON.stringify(body) }),
  getCart: (userId: string) => request(`/api/cart/${encodeURIComponent(userId)}`),
  saveCart: (userId: string, items: any[]) => request(`/api/cart/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify({ items }) }),
  getWishlist: (userId: string) => request(`/api/wishlist/${encodeURIComponent(userId)}`),
  saveWishlist: (userId: string, items: any[]) => request(`/api/wishlist/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify({ items }) }),
  getOrders: (userId: string) => request(`/api/orders/${encodeURIComponent(userId)}`),
  createOrder: (body: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  getProductReviews: (productId: string, userId = '') => request(`/api/products/${encodeURIComponent(productId)}/reviews?userId=${encodeURIComponent(userId)}`),
  getReviewEligibility: (productId: string, userId: string) => request(`/api/products/${encodeURIComponent(productId)}/review-eligibility?userId=${encodeURIComponent(userId)}`),
  createProductReview: (productId: string, body: any) => request(`/api/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  addSearch: (body: any) => request('/api/search-history', { method: 'POST', body: JSON.stringify(body) }),
  getSearch: (userId: string) => request(`/api/search-history/${encodeURIComponent(userId)}`),
  getGeneratedImages: (userId: string) => request(`/api/generated-images/${encodeURIComponent(userId)}`),
  getStyleSuggestions: (productId: string, userId = 'guest') => request(`/api/products/${encodeURIComponent(productId)}/style-suggestions?userId=${encodeURIComponent(userId)}`),
  searchSuggest: (body: any) => request('/api/search/suggest', { method: 'POST', body: JSON.stringify(body) }),
  getHomeRecommendations: (userId = 'guest', occasionKey = '') => request(`/api/recommendations/home?userId=${encodeURIComponent(userId)}&occasionKey=${encodeURIComponent(occasionKey)}`),
  checkoutQuote: (body: any) => request('/api/checkout/quote', { method: 'POST', body: JSON.stringify(body) }),
  checkoutIntent: (body: any) => request('/api/checkout/intent', { method: 'POST', body: JSON.stringify(body) }),
  trackOrder: (orderId: string) => request(`/api/orders/${encodeURIComponent(orderId)}/track`),
  validateDiscount: (body: { code: string; subtotal: number }) => request('/api/discounts/validate', { method: 'POST', body: JSON.stringify(body) }),
  getRelatedProducts: (productId: string) => request(`/api/products/${encodeURIComponent(productId)}/related`),
  getRecommendations: (userId: string, limit = 10) => request(`/api/recommendations/${encodeURIComponent(userId)}?limit=${limit}`),
  saveGeneratedImage: (body: any) => request('/api/generated-images', { method: 'POST', body: JSON.stringify(body) }),
  seedProducts: (items: any[]) => request('/api/products/bulk', { method: 'POST', body: JSON.stringify({ items }) }),
  sendChatMessage: (body: any) => request('/api/chat', { method: 'POST', body: JSON.stringify(body) }),
  createChatImage: (body: any) => request('/api/chat/create-image', { method: 'POST', body: JSON.stringify(body) }),
  saveGameHistory: (body: any) => request('/api/game-history', { method: 'POST', body: JSON.stringify(body) }),
  getStylistProfile: (userId: string) => request(`/api/stylist-profile/${encodeURIComponent(userId)}`),
  saveStylistProfile: (userId: string, body: any) => request(`/api/stylist-profile/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify(body) }),
  getBodyProfile: (userId: string) => request(`/api/body-profile/${encodeURIComponent(userId)}`),
  saveBodyProfile: (userId: string, body: any) => request(`/api/body-profile/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify(body) }),
  getDailyStylistQuiz: (userId: string, dateKey = '') => request(`/api/stylist-daily-quiz/${encodeURIComponent(userId)}${dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : ''}`),
  saveDailyStylistQuiz: (userId: string, body: any) => request(`/api/stylist-daily-quiz/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify(body) }),
  getAiStylistSuggestions: (body: any) => request('/api/ai-stylist/suggest', { method: 'POST', body: JSON.stringify(body) }),
  getTryOnHistory: (userId: string) => request(`/api/tryon-history/${encodeURIComponent(userId)}`),
  getOutfitCollections: (userId: string) => request(`/api/outfit-collections/${encodeURIComponent(userId)}`),
  saveOutfitCollection: (userId: string, body: any) => request(`/api/outfit-collections/${encodeURIComponent(userId)}`, { method: 'POST', body: JSON.stringify(body) }),
  deleteOutfitCollection: (userId: string, id: string) => request(`/api/outfit-collections/${encodeURIComponent(userId)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getSizeAdvice: (productId: string, userId = 'guest') => request(`/api/products/${encodeURIComponent(productId)}/size-advice?userId=${encodeURIComponent(userId)}`),
  getGames: () => request('/api/games'),
};


async function postMultipart(path: string, form: FormData) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(API_TIMEOUT_MS, 60000)) : null;
  try {
    const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: form, signal: controller?.signal });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.message || data.error || text || `HTTP ${res.status}`);
    if (data.url && data.url.startsWith('/')) data.url = `${API_URL}${data.url}`;
    if (data.secureUrl && data.secureUrl.startsWith('/')) data.secureUrl = `${API_URL}${data.secureUrl}`;
    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError' || error instanceof TypeError || /Network request failed|Failed to fetch/i.test(String(error?.message || ''))) {
      throw new Error(backendConnectionMessage(path, error));
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function uploadMediaFile(
  file: { uri: string; name: string; type: string },
  userId = 'guest',
  folder = 'uploads',
  source = 'media-upload',
  adminId = '',
) {
  const form = new FormData();
  form.append('userId', userId);
  form.append('folder', folder);
  form.append('source', source);
  form.append('file', file as any);
  if (adminId) {
    form.append('adminId', adminId);
    return postMultipart('/api/admin/media/upload', form);
  }
  return postMultipart('/api/media/upload', form);
}

export async function uploadRemoteMediaUrl(body: { url: string; userId?: string; folder?: string; source?: string; filename?: string; mimeType?: string; resourceType?: 'image' | 'video' | 'raw' }) {
  return request('/api/media/upload-remote', { method: 'POST', body: JSON.stringify(body) });
}

export async function uploadChatFile(file: { uri: string; name: string; type: string }, userId = 'guest') {
  const form = new FormData();
  form.append('userId', userId);
  form.append('file', file as any);
  return postMultipart('/api/chat/upload', form);
}

export async function analyzeOutfitMedia(file: { uri: string; name: string; type: string; kind?: 'image' | 'video' }, userId = 'guest', productId = '') {
  const form = new FormData();
  form.append('userId', userId);
  if (productId) form.append('productId', productId);
  form.append('mediaKind', file.kind || (file.type?.startsWith('video/') ? 'video' : 'image'));
  form.append('file', file as any);
  const res = await fetch(`${API_URL}/api/vision/style-from-media`, { method: 'POST', body: form });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || text || `HTTP ${res.status}`);
  if (data.imageUrl && data.imageUrl.startsWith('/')) data.imageUrl = `${API_URL}${data.imageUrl}`;
  if (data.fileUrl && data.fileUrl.startsWith('/')) data.fileUrl = `${API_URL}${data.fileUrl}`;
  return data;
}

export type TryOnGenerateInput = {
  userId?: string;
  productId?: string;
  productIds?: string[];
  comboTitle?: string;
  imageUrl?: string;
  file?: { uri: string; name: string; type: string };
};

export async function generateTryOnImage(input: TryOnGenerateInput) {
  const productIds = Array.isArray(input.productIds) ? input.productIds.filter(Boolean) : [];
  let res: Response;

  if (input.file) {
    const form = new FormData();
    form.append('userId', input.userId || 'guest');
    if (input.productId) form.append('productId', input.productId);
    form.append('productIds', JSON.stringify(productIds));
    if (input.comboTitle) form.append('comboTitle', input.comboTitle);
    form.append('file', input.file as any);
    res = await fetch(`${API_URL}/api/try-on/generate`, { method: 'POST', body: form });
  } else {
    res = await fetch(`${API_URL}/api/try-on/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: input.userId || 'guest',
        productId: input.productId || '',
        productIds,
        comboTitle: input.comboTitle || '',
        imageUrl: input.imageUrl || '',
      }),
    });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || text || `HTTP ${res.status}`);
  if (data.imageUrl && data.imageUrl.startsWith('/')) data.imageUrl = `${API_URL}${data.imageUrl}`;
  if (data.sourceImageUrl && data.sourceImageUrl.startsWith('/')) data.sourceImageUrl = `${API_URL}${data.sourceImageUrl}`;
  return data;
}

export async function analyzeOutfitImage(file: { uri: string; name: string; type: string }, userId = 'guest', productId = '') {
  return analyzeOutfitMedia({ ...file, kind: 'image' }, userId, productId);
}

export const sendChatMessage = api.sendChatMessage;
export const createChatImage = api.createChatImage;
