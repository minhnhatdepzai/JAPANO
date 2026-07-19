import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const USER_ID = 'demo-minh';

type RequestOptions = RequestInit & { timeoutMs?: number };

export type StyleProfile = {
  style?: string;
  height?: string;
  weight?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  shoulder?: string;
  [key: string]: unknown;
};

export type ApiProductRef = string | { id?: string; _id?: string; slug?: string; productId?: string; reason?: string };

export type HomeRecommendations = {
  items: ApiProductRef[];
  reasons: Record<string, string>;
  source?: string;
};

export type StylistRecommendation = {
  summary: string;
  tags: string[];
  products: ApiProductRef[];
  accessories: ApiProductRef[];
};

export type SizeFit = {
  chosen: string;
  recommended: string|null;
  delta: number;
  verdict: 'good'|'tight'|'loose'|'unknown';
  message: string;
};
export type TryOnResult = {
  imageUrl: string;
  message: string;
  recommendedSize?: string;
  engine?: string;
  sizeFit?: SizeFit;
  warning?: string;
};

export type ProductAiDescription = {
  headline: string;
  visualSummary: string;
  details: string[];
  stylingTip: string;
  purchaseReason: string;
  confidence: string;
  engine: string;
};

export type GoalPlan = {
  saving: {
    productId: string; productName: string; targetPrice: number; currentSavings: number;
    gap: number; progressPercent: number; monthlySaving: number; weeklySaving: number;
    requestedMonths: number; estimatedMonths: number | null; feasibleByRequestedDate: boolean;
    milestones: Array<{ milestone:number; amount:number; reached:boolean }>; actions:string[];
  };
  wellness: {
    status:string; currentBmi:number|null; targetBmi:number|null; lossKg:number;
    weeklyRateKg:number|null; estimatedWeeks:number|null; activityMinutesPerWeek:number;
    strengthDaysPerWeek:number; safetyMessage:string; habits:string[]; sources:string[];
  };
  coaching: {
    motivation:string; identityStatement:string; implementationIntentions:string[];
    obstaclePlans:string[]; weeklyFocus:string; reflectionQuestion:string; engine:string;
  };
  methodology:string[];
  disclaimer:string;
};

export type Flagcard = {
  id:string; order:number; glyph:string; accent:string; title:string; japanese:string; region:string;
  summary:string; formationHistory:string; legend:string; funFacts:string[];
  checkins:Array<{name:string;tip:string}>;
  outfit:{style:string;clothing:string[];accessories:string[];reason:string};
  recommendedProductIds:string[]; sourceUrl:string; active:boolean; owned:boolean;
  award?:{orderCode:string;orderTotal:number;awardedAt:number}|null;
};

export type FlagcardCollection = {
  ok:boolean;
  config:{active:boolean;qualifyingOrderMin:number;requiredCards:number;rewardPercent:number;rewardVoucherMinOrder:number;rewardValidityDays:number};
  progress:{owned:number;required:number;percent:number;completed:boolean};
  cards:Flagcard[];
  collection:{userId:string;cardIds:string[];awards:any[];rewardVoucherCode?:string};
  rewardVoucher?:{code:string;type:string;value:number;min:number;expiry:string;used:number;limit:number;active:boolean}|null;
};

const trim = (value?: string | null) => String(value || '').trim().replace(/\/+$/, '');

class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

function expoDevHost() {
  const c = Constants as any;
  const uri = c.expoConfig?.hostUri || c.manifest2?.extra?.expoClient?.hostUri || c.manifest?.debuggerHost || '';
  const withoutScheme = String(uri).replace(/^https?:\/\//, '');
  const host = withoutScheme.split('/')[0].split(':')[0];
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === 'localhost' ? host : '';
}

function webHost() {
  const location = (globalThis as any)?.location;
  return Platform.OS === 'web' && location?.hostname ? String(location.hostname) : '';
}

export function apiBaseCandidates() {
  const env = trim(process.env.EXPO_PUBLIC_API_URL);
  const port = trim(process.env.EXPO_PUBLIC_API_PORT) || '4100';
  const dev = expoDevHost();
  const browser = webHost();
  const list = [
    env,
    dev && `http://${dev}:${port}`,
    browser && `http://${browser}:${port}`,
    Platform.OS === 'android' ? `http://10.0.2.2:${port}` : `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ].filter(Boolean) as string[];
  return [...new Set(list.map(trim))];
}

export const API_BASE = apiBaseCandidates()[0] || 'http://localhost:4100';
let activeBase = '';

export function resolveApiMediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw || /^(?:https?:|data:|file:)/i.test(raw)) return raw;
  return `${activeBase || API_BASE}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return text; }
}

export async function requestJson<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 12000;
  const { timeoutMs: _timeout, ...fetchOptions } = options;
  const bases = activeBase
    ? [activeBase, ...apiBaseCandidates().filter(base => base !== activeBase)]
    : apiBaseCandidates();
  let lastError: Error = new Error('Không tìm thấy địa chỉ backend JAPANO.');

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = new Headers(fetchOptions.headers || {});
      if (fetchOptions.body && typeof fetchOptions.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      const body = await readBody(response);
      if (!response.ok) {
        const message = body?.message || body?.error || body?.detail || `HTTP ${response.status}`;
        throw new ApiHttpError(response.status, String(message));
      }
      activeBase = base;
      return body as T;
    } catch (error: any) {
      // An HTTP response proves this backend address is reachable. Retrying a
      // long POST (especially /api/tryon) against 10.0.2.2/127.0.0.1 would
      // submit the same GPU job several times and can exhaust VRAM.
      if (error instanceof ApiHttpError) throw error;
      lastError = new Error(error?.name === 'AbortError' ? 'Backend phản hồi quá lâu.' : (error?.message || 'Lỗi kết nối backend.'));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

const jsonPost = <T = any>(path: string, payload: unknown, timeoutMs = 20000) =>
  requestJson<T>(path, { method: 'POST', body: JSON.stringify(payload), timeoutMs });

const arrayFrom = (data: any) => Array.isArray(data) ? data : (data?.items || data?.products || data?.data || []);
const refKey = (ref: ApiProductRef) => typeof ref === 'string'
  ? ref
  : String(ref.slug || ref.productId || ref.id || ref._id || '');

export const getHealth = () => requestJson('/api/health', { timeoutMs: 4500 });
export const getProducts = async () => arrayFrom(await requestJson('/api/products', { timeoutMs: 6500 }));
export const getCategories = async () => arrayFrom(await requestJson('/api/categories'));
export const getBanners = async () => arrayFrom(await requestJson('/api/banners'));
export type ShopInfo = { name:string; hotline:string; email:string; address:string; shipFee:number; cod:boolean; stripe:boolean; logo?:string|null; updatedAt?:number };
export async function getShop():Promise<ShopInfo>{
  const shop:any=await requestJson('/api/shop',{timeoutMs:6500});
  return {...shop,logo:shop?.logo?resolveApiMediaUrl(String(shop.logo)):null};
}

export type VietnamLocation = { code:string; name:string; wardCount?:number; provinceCode?:string };
export async function getProvinces(query=''):Promise<VietnamLocation[]>{
  const data:any=await requestJson(`/api/locations/provinces?q=${encodeURIComponent(query)}`,{timeoutMs:8000});
  return data?.items||[];
}
export async function getWards(provinceCode:string,query='',limit=100):Promise<{items:VietnamLocation[];total:number}>{
  const data:any=await requestJson(`/api/locations/wards?provinceCode=${encodeURIComponent(provinceCode)}&q=${encodeURIComponent(query)}&limit=${limit}`,{timeoutMs:8000});
  return {items:data?.items||[],total:Number(data?.total||0)};
}

export async function getHomeRecommendations(userId = USER_ID, limit = 8, profile?:StyleProfile): Promise<HomeRecommendations> {
  const style=profile?.style?`&style=${encodeURIComponent(String(profile.style))}`:'';
  const data: any = await requestJson(`/api/recommendations/home?userId=${encodeURIComponent(userId)}&limit=${limit}${style}`);
  const raw = data?.items || data?.recommendations || data?.products || data?.rails?.[0]?.items || data?.productIds || [];
  const reasons: Record<string, string> = { ...(data?.reasons || {}) };
  for (const ref of raw) {
    const key = refKey(ref);
    if (key && typeof ref === 'object' && ref.reason) reasons[key] = ref.reason;
  }
  return { items: raw, reasons, source: data?.source || data?.algorithm };
}

export function saveRemoteStyleProfile(profile:StyleProfile,userId=USER_ID){
  return jsonPost('/api/stylist/profile',{userId,profile},12000);
}

export function trackInteraction(payload: {
  userId?: string;
  type: 'view' | 'search' | 'wishlist' | 'cart' | 'tryon' | 'chat' | 'goal';
  productId: string;
  value: number;
  metadata?: Record<string, unknown>;
}) {
  return jsonPost('/api/interactions', { userId: USER_ID, ...payload }, 6000);
}

export function syncCart(userId:string,items:Array<{slug:string;color:string;size:string;qty:number}>){
  return jsonPost('/api/carts/sync',{userId,items},8000);
}

export async function recommendStyle(payload: {
  userId?: string;
  imageBase64: string;
  profile?: StyleProfile;
}): Promise<StylistRecommendation> {
  const data: any = await jsonPost('/api/stylist/recommend', { userId: USER_ID, ...payload }, 90000);
  const result = data?.recommendation || data?.result || data;
  return {
    summary: String(result?.summary || result?.message || 'Đã phân tích phong cách của bạn.'),
    tags: (result?.tags || result?.styleTags || result?.analysis?.styleTags || []).map(String),
    products: result?.products || result?.recommendations || result?.productIds || [],
    accessories: result?.accessories || result?.accessoryProducts || result?.accessoryIds || [],
  };
}

export async function getSizeAdvice(payload: {
  userId?: string;
  productId: string;
  profile: StyleProfile;
  selectedSize?: string;
}) {
  const data: any = await jsonPost('/api/stylist/size', { userId: USER_ID, ...payload }, 30000);
  return {
    size: String(data?.size || data?.recommendedSize || data?.result?.recommendedSize || ''),
    advice: String(data?.advice || data?.message || data?.result?.why?.join?.(' · ') || ''),
  };
}

function imageFrom(data: any) {
  const raw = data?.imageUrl || data?.resultUrl || data?.finalImageUrl || data?.finalImageBase64 || data?.imageBase64 || data?.result?.imageBase64 || '';
  if (!raw) return '';
  const value = String(raw);
  return value.startsWith('data:') || value.startsWith('http') || value.startsWith('file:')
    ? value
    : `data:image/png;base64,${value}`;
}

export async function generateTryOn(payload: Record<string, unknown>): Promise<TryOnResult> {
  const configured=Number(process.env.EXPO_PUBLIC_TRYON_TIMEOUT_MS||720000);
  const timeout=Number.isFinite(configured)&&configured>=30000?configured:720000;
  const data: any = await jsonPost('/api/tryon', { userId: USER_ID, ...payload }, timeout);
  return {
    imageUrl: imageFrom(data),
    message: String(data?.message || (imageFrom(data) ? 'Đã tạo ảnh thử đồ.' : 'Backend chưa trả ảnh kết quả.')),
    recommendedSize: data?.recommendedSize || data?.size,
    engine: String(data?.engine || ''),
    sizeFit: data?.sizeFit,
    warning: String(data?.accessoryWarning || (data?.qualityWarning ? data?.message : '') || ''),
  };
}

export async function getProductAiDescription(slug:string):Promise<ProductAiDescription>{
  return requestJson(`/api/products/${encodeURIComponent(slug)}/ai-description`,{timeoutMs:135000});
}

export async function createGoalPlan(payload:Record<string,unknown>):Promise<{ok:boolean;goal:{id:string;productId:string;plan:GoalPlan}}>{
  return jsonPost('/api/goals/plan',{userId:USER_ID,...payload},110000);
}

export async function getGoals(userId=USER_ID){
  return requestJson(`/api/goals/${encodeURIComponent(userId)}`,{timeoutMs:8000});
}

export async function sendStylistMessage(payload: {
  userId?: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
  profile?: StyleProfile;
}) {
  const data: any = await jsonPost('/api/stylist/chat', { userId: USER_ID, ...payload }, 90000);
  const result = data?.result || data;
  return {
    message: String(result?.message || result?.reply || result?.text || 'Ori chưa có câu trả lời.'),
    products: (result?.products || result?.recommendations || result?.productIds || [])
      .map((ref: ApiProductRef) => refKey(ref))
      .filter(Boolean),
  };
}

export function createOrder(payload: any) {
  return jsonPost('/api/orders', { userId:USER_ID, ...payload }, 15000);
}

export type StripePaymentRecord = {
  id:string; code:string; orderId:string; orderCode:string; userId:string;
  provider:string; method:string; status:string; amount:number; currency:string;
  transactionCode?:string; paymentIntentId?:string; checkoutSessionId?:string;
  originalAmount?:number; discount?:number; voucherDiscount?:number; paymentDiscount?:number; promotionCode?:string;
  refundable?:boolean; refundedAmount?:number; pendingRefundAmount?:number; refundId?:string;
  chargeId?:string; receiptUrl?:string; paymentMethodType?:string;
  customer?:{name?:string;email?:string;phone?:string;address?:Record<string,string>|null};
  card?:{brand?:string;last4?:string;funding?:string};
  refunds?:Array<{id:string;amount:number;currency:string;status:string;reason?:string;failureReason?:string;returnRequestId?:string;createdAt:number}>;
};

export type StripeCheckoutResult = {
  ok:boolean; url:string; sessionId:string; mode:'test';
  order:ApiOrder; payment:StripePaymentRecord;
  flagcardEligibility?:{qualifiesByAmount:boolean;threshold:number;awarded:boolean};
};

export function createStripeCheckoutSession(payload:any):Promise<StripeCheckoutResult>{
  return jsonPost('/api/stripe/checkout-session',{userId:USER_ID,...payload},30000);
}

export function getPaymentStatus(id:string):Promise<{ok:boolean;payment:StripePaymentRecord;order:ApiOrder}>{
  return requestJson(`/api/payments/${encodeURIComponent(id)}`,{timeoutMs:10000});
}

export type ReturnRequest = {
  id:string; code:string; orderId:string; orderCode:string; userId:string; paymentId:string; paymentCode:string;
  status:'requested'|'approved'|'received'|'refund_pending'|'refunded'|'refund_failed'|'rejected'|'cancelled';
  reason:string; note?:string; adminNote?:string; amount:number; currency:string; refundId?:string; refundStatus?:string;
  createdAt:number; updatedAt:number; timeline:Array<{s:string;at:number;refundId?:string;note?:string}>;
};

export type ProductReview={id:string;productId:string;userName:string;rating:number;comment:string;verifiedPurchase:boolean;createdAt:number;updatedAt:number;helpful:number;notHelpful:number;myReaction:'helpful'|'not_helpful'|null};
export type ProductReviews={ok:boolean;productId:string;summary:{average:number;count:number;distribution:Array<{rating:number;count:number}>};eligibility:{canReview:boolean;purchased:boolean;alreadyReviewed:boolean;orderIds:string[]};reviews:ProductReview[]};
export function getProductReviews(slug:string,userId=''):Promise<ProductReviews>{
  return requestJson(`/api/products/${encodeURIComponent(slug)}/reviews?userId=${encodeURIComponent(userId)}`,{timeoutMs:10000});
}
export function createProductReview(slug:string,payload:{userId:string;userName?:string;rating:number;comment:string}):Promise<{ok:boolean;status:string;message:string;review:ProductReview|null}>{
  return jsonPost(`/api/products/${encodeURIComponent(slug)}/reviews`,payload,55000);
}
export function reactToReview(reviewId:string,userId:string,value:'helpful'|'not_helpful'):Promise<{ok:boolean;review:ProductReview}>{
  return jsonPost(`/api/reviews/${encodeURIComponent(reviewId)}/reaction`,{userId,value},10000);
}

export function getOrderDetail(id:string):Promise<{ok:boolean;order:ApiOrder;payment:StripePaymentRecord|null;returnRequest:ReturnRequest|null}>{
  return requestJson(`/api/orders/${encodeURIComponent(id)}`,{timeoutMs:10000});
}

export function createReturnRequest(orderId:string,payload:{reason:string;note?:string}):Promise<{ok:boolean;order:ApiOrder;payment:StripePaymentRecord;returnRequest:ReturnRequest}>{
  return jsonPost(`/api/orders/${encodeURIComponent(orderId)}/returns`,{userId:USER_ID,...payload},15000);
}

export function getFlagcardCollection(userId=USER_ID):Promise<FlagcardCollection>{
  return requestJson(`/api/flagcards/collection/${encodeURIComponent(userId)}`,{timeoutMs:10000});
}

export function validateVoucher(code:string,subtotal:number,userId=USER_ID):Promise<{ok:boolean;discount:number;voucher:{code:string;value:number;type:string;min:number}}>{
  return jsonPost('/api/vouchers/validate',{code,userId,subtotal},10000);
}

export type AppliedVoucher = { code:string; type:string; value:number; min:number };
export type ApiVoucher = {
  code:string; type:string; value:number; min:number; expiry:string; limit:number; used:number;
  active:boolean; ownerUserId?:string; source?:string;
};
const finite = (value:unknown, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export async function getVouchers(userId=USER_ID):Promise<ApiVoucher[]>{
  const data:any = await requestJson('/api/vouchers',{timeoutMs:8000});
  const list:ApiVoucher[] = Array.isArray(data)?data:(data?.vouchers||[]);
  const now = Date.now();
  return list.filter(v => {
    if (!v.active) return false;
    if (v.ownerUserId && String(v.ownerUserId)!==String(userId)) return false;
    if (finite(v.used) >= Math.max(1, finite(v.limit,1))) return false;
    if (v.expiry && v.expiry!=='—' && new Date(`${v.expiry}T23:59:59`).getTime() < now) return false;
    return true;
  }).sort((a,b)=> (a.min||0) - (b.min||0));
}

export function voucherDiscountFor(subtotal:number, voucher:AppliedVoucher|null|undefined):number{
  if(!voucher || subtotal<voucher.min) return 0;
  return voucher.type==='percent'
    ? Math.round(subtotal*Math.min(100,Math.max(0,voucher.value))/100)
    : Math.min(subtotal,Math.max(0,voucher.value));
}

export type ApiOrder = {
  id:string; code:string; userId?:string; customer:{id?:string;name:string;phone:string};
  address:string; items:Array<{productId:string;slug:string;name:string;colorName:string;colorHex:string;size:string;qty:number;price:number}>;
  subtotal:number; discount:number; voucherDiscount?:number; paymentDiscount?:number; discountCode?:string; total:number; ship:number;
  payment:{method:string;status:string;txn:string;provider?:string;paymentId?:string;checkoutSessionId?:string;refundId?:string;refundedAmount?:number;pendingRefundAmount?:number;card?:{brand?:string;last4?:string}};
  status:string; returnStatus?:string; returnRequest?:{id:string;code:string;status:string}; createdAt:number; completedAt?:number;
  history?:Array<{s:string;at:number}>;
};
export async function getOrders(userId=USER_ID):Promise<ApiOrder[]>{
  const data:any = await requestJson('/api/orders',{timeoutMs:8000});
  const list:ApiOrder[] = Array.isArray(data)?data:(data?.orders||[]);
  return list
    .filter(o=>String(o.userId||o.customer?.id||'')===String(userId))
    .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
}

export async function getRelatedProducts(slug: string, limit = 8): Promise<string[]> {
  const data: any = await requestJson(`/api/products/${encodeURIComponent(slug)}/related?limit=${limit}`, { timeoutMs: 6500 });
  return arrayFrom(data?.productIds ? data.productIds : data).map(String);
}

export type OutfitSet = { anchor: string; title: string; items: Array<{ slug: string; role: string; reason?: string }>; totalPrice: number };

export async function getTodaysOutfit(): Promise<OutfitSet | null> {
  const data: any = await requestJson('/api/outfits/today', { timeoutMs: 6500 });
  return data?.ok === false ? null : data;
}

export async function getOutfitFor(slug: string): Promise<OutfitSet | null> {
  const data: any = await requestJson(`/api/outfits/${encodeURIComponent(slug)}`, { timeoutMs: 6500 });
  return data?.ok === false ? null : data;
}
