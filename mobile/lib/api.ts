import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const USER_ID = 'demo-minh';

// Token JWT của phiên đăng nhập thật (xem lib/auth.tsx). requestJson tự đính
// kèm Authorization cho mọi request — không cần sửa từng lời gọi API riêng lẻ.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

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

export type CheerUp = { message: string; joke: string; destination: string };
export type StylistRecommendation = {
  summary: string;
  tags: string[];
  products: ApiProductRef[];
  accessories: ApiProductRef[];
  /** Lý do gợi ý từng món, khoá theo slug — dùng cho cả trang phục lẫn phụ kiện. */
  reasons: Record<string,string>;
  mood: string|null;
  moodLabel: string|null;
  ageRange: string|null;
  cheerUp: CheerUp|null;
};

export type SizeFit = {
  chosen: string;
  recommended: string|null;
  delta: number;
  verdict: 'good'|'tight'|'loose'|'unknown';
  message: string;
};
export type TryOnGarment = { slug:string; name:string; zone:'upper'|'lower'|'overall' };
export type TryOnResult = {
  imageUrl: string;
  message: string;
  recommendedSize?: string;
  engine?: string;
  sizeFit?: SizeFit;
  warning?: string;
  /** Những món THỰC SỰ lên được ảnh — có thể ít hơn số món đã chọn. */
  garments: TryOnGarment[];
  /** Món đã chọn nhưng AI không ghép được, để nói thật với người dùng. */
  skippedGarments: string[];
  appliedAccessories: string[];
  skippedAccessories: string[];
};
export type MotionPreset = { id:string; label:string; icon:string };

export type ProductAiDescription = {
  headline: string;
  visualSummary: string;
  details: string[];
  stylingTip: string;
  purchaseReason: string;
  confidence: string;
  engine: string;
};

// Quỹ tích luỹ của một mục tiêu mua sắm. Đây là SỔ THEO DÕI: JAPANO không giữ
// tiền của khách, mỗi khoản chỉ là một dòng ghi nhận tiến độ tiết kiệm.
export type GoalDeposit = { id:string; amount:number; note?:string; at:number };
export type GoalFund = {
  target:number; saved:number; remaining:number; percent:number;
  deposits:GoalDeposit[];
  status:'saving'|'completed'|'achieved';
  rewardPercent:number;
  completedAt:number|null;
  rewardVoucherCode:string|null;
  achievedOrderId:string|null;
  achievedOrderCode:string|null;
  achievedAt:number|null;
};
export type GoalFundConfig = { rewardPercent:number; rewardValidityDays:number; maxDepositPerEntry:number; isLedgerOnly:boolean };
export type ApiGoal = {
  id:string; userId:string; productId:string;
  product:{ slug:string; name:string; price:number; image?:string };
  input:Record<string,number|undefined>;
  plan:GoalPlan; fund:GoalFund|null; createdAt:number; updatedAt:number;
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

export type VipMembership = {
  id:string; userId:string; qualifyingPeriod:string; qualifyingOrderIds:string[];
  qualifiedSpend:number; threshold:number; discountPercent:number; discountedUnitsPerOrder:number;
  startedAt:number; expiresAt:number; status:'active'|'expired';
};

export type VipStatus = {
  userId:string; isVip:boolean; tier:'VIP'|'Thành viên'; membership:VipMembership|null;
  startedAt:number|null; expiresAt:number|null; daysRemaining:number;
  currentMonth:{key:string;startsAt:number;endsAt:number;spend:number;threshold:number;remaining:number;progressPercent:number};
  benefit:{available:boolean;discountPercent:number;discountedUnitsPerOrder:number;description:string};
};

export type VipStatusResponse = {
  ok:boolean;
  config:{monthlySpendThreshold:number;validityDays:number;discountPercent:number;discountedUnitsPerOrder:number};
  status:VipStatus;
};

export function getVipStatus(userId:string):Promise<VipStatusResponse>{
  return requestJson(`/api/vip/status/${encodeURIComponent(userId)}`,{timeoutMs:8000});
}

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

export function apiBaseCandidates() {
  const env = trim(process.env.EXPO_PUBLIC_API_URL);
  const port = trim(process.env.EXPO_PUBLIC_API_PORT) || '4100';
  const dev = expoDevHost();
  const list = [
    env,
    dev && `http://${dev}:${port}`,
    // Máy ảo Android ánh xạ máy chủ qua 10.0.2.2; máy thật dùng IP LAN ở `dev`.
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
      if (authToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${authToken}`);
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

export type ApiAuthUser = { id: string; name: string; email: string; role: 'customer' | 'staff' | 'admin' | 'super_admin'; vip: string };
export type ApiAuthResponse = { ok: boolean; token: string; user: ApiAuthUser };

export function apiRegister(input: { name: string; email: string; password: string }) {
  return jsonPost<ApiAuthResponse>('/api/auth/register', input, 15000);
}
export function apiLogin(input: { email: string; password: string }) {
  return jsonPost<ApiAuthResponse>('/api/auth/login', input, 15000);
}
export function apiMe() {
  return requestJson<{ ok: boolean; user: ApiAuthUser }>('/api/auth/me', { timeoutMs: 10000 });
}
// Ứng dụng chỉ chuyển tiếp token của Google; backend mới là nơi kiểm chữ ký,
// audience và email_verified (xem backend/lib/googleAuth.js).
export function apiGoogleLogin(tokens: { idToken?: string; accessToken?: string }) {
  return jsonPost<ApiAuthResponse & { isNew?: boolean }>('/api/auth/google', tokens, 15000);
}
// Hỏi máy chủ có bật đăng nhập Google chưa, để không hiện nút dẫn tới ngõ cụt.
export function apiAuthProviders() {
  return requestJson<{ ok: boolean; password: boolean; google: boolean }>('/api/auth/providers', { timeoutMs: 8000 });
}
export function apiForgotPassword(email: string) {
  return jsonPost<{ ok: boolean; message: string; sandboxPreviewUrl?: string; expiresInSeconds?: number; resendAfterSeconds?: number }>('/api/auth/forgot-password', { email }, 15000);
}
export function apiResetPassword(input: { email: string; code: string; newPassword: string }) {
  return jsonPost<{ ok: boolean; message: string }>('/api/auth/reset-password', input, 15000);
}

export function registerPushToken(token: string, platform: string) {
  return jsonPost('/api/push/register', { token, platform }, 10000);
}

const arrayFrom = (data: any) => Array.isArray(data) ? data : (data?.items || data?.products || data?.data || []);
const refKey = (ref: ApiProductRef) => typeof ref === 'string'
  ? ref
  : String(ref.slug || ref.productId || ref.id || ref._id || '');

// Báo cho backend biết người dùng đang ở màn hình nào để nó ưu tiên GPU cho
// đúng tính năng đó và nhả VRAM của các tính năng còn lại. Gọi "bắn rồi quên":
// lỗi mạng ở đây không được phép ảnh hưởng tới màn hình đang mở.
export type GpuFocus = 'tryon' | 'motion' | 'chat' | 'home' | 'browse';
export function reportGpuFocus(focus: GpuFocus) {
  return jsonPost('/api/gpu/focus', { focus }, 8000).catch(() => undefined);
}

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

// Sổ địa chỉ lưu trên backend (ERD v2: bảng addresses) — đồng bộ đa thiết bị.
export type ApiAddress = { id:string; userId:string; title:string; name:string; phone:string; street:string; wardCode:string; ward:string; provinceCode:string; province:string; isDefault:boolean; updatedAt:number };
export async function apiListAddresses(userId=USER_ID):Promise<ApiAddress[]>{
  const data:any=await requestJson(`/api/addresses?userId=${encodeURIComponent(userId)}`,{timeoutMs:8000});
  return data?.addresses||[];
}
export async function apiCreateAddress(payload:Partial<ApiAddress>,userId=USER_ID):Promise<ApiAddress>{
  const data:any=await jsonPost('/api/addresses',{userId,...payload},8000);
  return data.address;
}
export async function apiUpdateAddress(id:string,payload:Partial<ApiAddress>,userId=USER_ID):Promise<ApiAddress>{
  const data:any=await requestJson(`/api/addresses/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({userId,...payload}),timeoutMs:8000});
  return data.address;
}
export async function apiDeleteAddress(id:string,userId=USER_ID):Promise<void>{
  await requestJson(`/api/addresses/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,{method:'DELETE',timeoutMs:8000});
}
export async function apiSetDefaultAddress(id:string,userId=USER_ID):Promise<void>{
  await jsonPost(`/api/addresses/${encodeURIComponent(id)}/default`,{userId},8000);
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

// Ghi MỌI lượt tìm kiếm kể cả 0 kết quả — khác trackInteraction(type:'search')
// vốn chỉ gắn vào sản phẩm được trả về (nuôi engine gợi ý), không thấy được
// những từ khoá khách tìm mà app không có sản phẩm nào khớp.
export function logSearch(payload: { userId?: string; query: string; resultCount: number }) {
  return jsonPost('/api/search-log', { userId: USER_ID, ...payload }, 6000);
}

export function syncCart(userId:string,items:Array<{slug:string;color:string;size:string;qty:number}>){
  return jsonPost('/api/carts/sync',{userId,items},8000);
}

// Wishlist lưu trên backend (ERD v2: bảng wishlists) — đồng bộ đa thiết bị.
export async function getWishlist(userId=USER_ID):Promise<string[]>{
  const data:any=await requestJson(`/api/wishlist?userId=${encodeURIComponent(userId)}`,{timeoutMs:8000});
  return Array.isArray(data?.wishlist)?data.wishlist:[];
}
export function syncWishlist(userId:string,slugs:string[]){
  return jsonPost('/api/wishlist/sync',{userId,slugs},8000);
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
    reasons: (result?.reasons && typeof result.reasons === 'object') ? result.reasons as Record<string,string> : {},
    mood: data?.mood || null,
    moodLabel: data?.moodLabel || null,
    ageRange: data?.ageRange || null,
    cheerUp: data?.cheerUp || null,
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
    garments: Array.isArray(data?.garments) ? data.garments as TryOnGarment[] : [],
    skippedGarments: Array.isArray(data?.skippedGarments) ? data.skippedGarments.map(String) : [],
    appliedAccessories: Array.isArray(data?.appliedAccessories) ? data.appliedAccessories.map((item:any)=>String(item?.name||item?.id||'')).filter(Boolean) : [],
    skippedAccessories: Array.isArray(data?.skippedAccessories) ? data.skippedAccessories.map(String) : [],
  };
}

export async function getTryOnMotionPresets():Promise<{ready:boolean;engine:string;presets:MotionPreset[]}> {
  const data:any=await requestJson('/api/tryon/motion/presets',{timeoutMs:8000});
  return {ready:Boolean(data?.ready),engine:String(data?.engine||''),presets:Array.isArray(data?.presets)?data.presets:[]};
}

export async function generateTryOnMotion(imageBase64:string,motion:string):Promise<{videoUrl:string;engine:string}> {
  const data:any=await jsonPost('/api/tryon/motion',{userId:USER_ID,imageBase64,motion},750000);
  return {videoUrl:resolveApiMediaUrl(String(data?.videoUrl||'')),engine:String(data?.engine||'one-to-all-animation-1.3b-v2')};
}

export async function getProductAiDescription(slug:string):Promise<ProductAiDescription>{
  return requestJson(`/api/products/${encodeURIComponent(slug)}/ai-description`,{timeoutMs:135000});
}

// userId lấy từ phiên đăng nhập ở backend, không tin tham số client gửi lên.
export async function createGoalPlan(payload:Record<string,unknown>):Promise<{ok:boolean;goal:ApiGoal;fundConfig:GoalFundConfig}>{
  return jsonPost('/api/goals/plan',payload,110000);
}

export async function getGoals(userId:string):Promise<{ok:boolean;goals:ApiGoal[];fundConfig:GoalFundConfig}>{
  return requestJson(`/api/goals/${encodeURIComponent(userId)}`,{timeoutMs:8000});
}

export function depositToGoal(goalId:string,payload:{amount:number;note?:string}):Promise<{ok:boolean;goal:ApiGoal;justCompleted:boolean;rewardVoucher:ApiVoucher|null}>{
  return jsonPost(`/api/goals/${encodeURIComponent(goalId)}/deposits`,payload,12000);
}

export function removeGoalDeposit(goalId:string,depositId:string):Promise<{ok:boolean;goal:ApiGoal}>{
  return requestJson(`/api/goals/${encodeURIComponent(goalId)}/deposits/${encodeURIComponent(depositId)}`,{method:'DELETE',timeoutMs:12000});
}

export type ReviewMedia = { url:string; kind:'video'|'audio'; publicId?:string } | null;
export type JapanSpotReview = { id:string; place:string; prefecture:string; userName:string; rating:number; comment:string; media?:ReviewMedia; createdAt:number };
export async function getJapanSpotReviews(place:string,prefecture:string):Promise<{reviews:JapanSpotReview[];average:number;count:number}>{
  const data:any=await requestJson(`/api/japan-spots/reviews?place=${encodeURIComponent(place)}&prefecture=${encodeURIComponent(prefecture)}`,{timeoutMs:8000});
  return { reviews:data?.reviews||[], average:Number(data?.average||0), count:Number(data?.count||0) };
}
export async function postJapanSpotReview(payload:{place:string;prefecture:string;rating:number;comment:string;userName?:string;media?:string;mediaKind?:'video'|'audio'}):Promise<JapanSpotReview>{
  const data:any=await jsonPost('/api/japan-spots/reviews',{userId:USER_ID,...payload},90000);
  return data.review;
}
// Đóng góp địa điểm chụp ảnh mới: được quản trị viên duyệt thì nhận voucher
// giảm tiền — mức thưởng lấy từ backend để app không hiển thị con số tự chế.
export type SpotRewardConfig = { amount:number; minOrder:number; validityDays:number; label:string };
export type SpotSuggestionReward = { status:'pending'|'approved'|'rejected'; voucherCode?:string; amount?:number; minOrder?:number; expiry?:string; note?:string };
export type JapanSpotSuggestion = { id:string; prefecture:string; userName:string; suggestion:string; createdAt:number; mine?:boolean; reward?:SpotSuggestionReward|null };
export async function getJapanSpotSuggestions(prefecture:string,userId=''):Promise<{suggestions:JapanSpotSuggestion[];rewardConfig:SpotRewardConfig|null}>{
  const data:any=await requestJson(`/api/japan-spots/suggestions?prefecture=${encodeURIComponent(prefecture)}&userId=${encodeURIComponent(userId)}`,{timeoutMs:8000});
  return { suggestions:data?.suggestions||[], rewardConfig:data?.rewardConfig||null };
}
export async function postJapanSpotSuggestion(payload:{prefecture:string;suggestion:string;place?:string;userName?:string;userId:string}):Promise<JapanSpotSuggestion>{
  const data:any=await jsonPost('/api/japan-spots/suggestions',payload,8000);
  return data.suggestion;
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
    engine: String(result?.engine || ''),
    intent: String(result?.intent || ''),
    confidence: Number(result?.confidence || 0),
    models: Array.isArray(result?.models) ? result.models.map(String) : [],
  };
}

export function createOrder(payload: any) {
  return jsonPost('/api/orders', { userId:USER_ID, ...payload }, 15000);
}

export type StripePaymentRecord = {
  id:string; code:string; orderId:string; orderCode:string; userId:string;
  provider:string; method:string; status:string; amount:number; currency:string;
  transactionCode?:string; paymentIntentId?:string; checkoutSessionId?:string;
  originalAmount?:number; discount?:number; voucherDiscount?:number; paymentDiscount?:number; vipDiscount?:number; promotionCode?:string;
  vipPromotion?:ApiOrder['vipPromotion'];
  refundable?:boolean; refundedAmount?:number; pendingRefundAmount?:number; refundId?:string;
  chargeId?:string; receiptUrl?:string; paymentMethodType?:string;
  customer?:{name?:string;email?:string;phone?:string;address?:Record<string,string>|null};
  card?:{brand?:string;last4?:string;funding?:string};
  vnpTransactionNo?:string; vnpBankCode?:string; vnpCardType?:string;
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

export type StripeConfig = {
  ok:boolean; enabled:boolean; mode:'test'|'disabled'; publishableKey:string;
  currency:string; merchantDisplayName:string;
};

export type StripePaymentIntentResult = {
  ok:boolean; reused?:boolean; clientSecret:string; paymentIntentId?:string; intentStatus:string; mode:'test';
  order:ApiOrder; payment:StripePaymentRecord;
  flagcardEligibility?:{qualifiesByAmount:boolean;threshold:number;awarded:boolean};
};

export function getStripeConfig():Promise<StripeConfig>{
  return requestJson('/api/stripe/config',{timeoutMs:10000});
}

export function createStripePaymentIntent(payload:any):Promise<StripePaymentIntentResult>{
  return jsonPost('/api/stripe/payment-intent',{userId:USER_ID,...payload},30000);
}

export type SavedCard = { id:string; brand:string; last4:string; expMonth:number; expYear:number };
export async function getSavedCards():Promise<SavedCard[]>{
  const data:any=await requestJson('/api/stripe/cards',{timeoutMs:10000});
  return data?.cards||[];
}
export function deleteSavedCard(id:string):Promise<void>{
  return requestJson(`/api/stripe/cards/${encodeURIComponent(id)}`,{method:'DELETE',timeoutMs:10000});
}

export function confirmStripePaymentIntent(paymentIntentId:string,orderId:string):Promise<{ok:boolean;payment:StripePaymentRecord;order:ApiOrder}>{
  return jsonPost('/api/stripe/payment-intent/confirm',{paymentIntentId,orderId},30000);
}

export function getPaymentStatus(id:string):Promise<{ok:boolean;payment:StripePaymentRecord;order:ApiOrder}>{
  return requestJson(`/api/payments/${encodeURIComponent(id)}`,{timeoutMs:10000});
}

export type VnpayConfig = {
  ok:boolean; enabled:boolean; mode:'test'|'disabled';
  currency:string; merchantDisplayName:string; returnUrlMarker:string;
};
export function getVnpayConfig():Promise<VnpayConfig>{
  return requestJson('/api/vnpay/config',{timeoutMs:10000});
}

export type VnpayPaymentUrlResult = {
  ok:boolean; paymentUrl:string; returnUrlMarker:string; mode:'test';
  order:ApiOrder; payment:StripePaymentRecord;
  flagcardEligibility?:{qualifiesByAmount:boolean;threshold:number;awarded:boolean};
};
export function createVnpayPaymentUrl(payload:any):Promise<VnpayPaymentUrlResult>{
  return jsonPost('/api/vnpay/payment-url',{userId:USER_ID,...payload},30000);
}

// App bắt URL return ngay trong WebView và gửi lại toàn bộ query VNPay trả về
// để backend tự đối soát chữ ký + số tiền (không cần IPN public trong LAN).
export function confirmVnpayReturn(params:Record<string,string>):Promise<{ok:boolean;status:string;payment:StripePaymentRecord;order:ApiOrder}>{
  return jsonPost('/api/vnpay/return',params,20000);
}

export type ReturnItem = { productId:string; slug:string; name:string; size:string; colorName:string; qty:number; price:number };
export type ReturnRequest = {
  id:string; kind:'cancel'|'return'; code:string; orderId:string; orderCode:string; userId:string; paymentId:string; paymentCode:string;
  status:'requested'|'approved'|'shipped_back'|'received'|'refund_pending'|'refunded'|'refund_failed'|'rejected'|'cancelled';
  reason:string; note?:string; adminNote?:string; photos?:string[]; codManualRefund?:boolean; amount:number; currency:string; refundId?:string; refundStatus?:string;
  items?:ReturnItem[]; coversWholeOrder?:boolean; shipBackDeadline?:number|null;
  shipBack?:{carrier:string;trackingCode:string;note?:string;at:number}|null;
  refundBreakdown?:{itemsValue:number;discountAllocated:number;vipDiscountAllocated:number;shipRefunded:number;orderSubtotal:number};
  createdAt:number; updatedAt:number; timeline:Array<{s:string;at:number;refundId?:string;note?:string}>;
};

// Một sản phẩm trong đơn kèm số lượng còn có thể yêu cầu trả.
export type ReturnableItem = ApiOrder['items'][number] & { returnedQty:number; remainingQty:number };
export type ReturnWindow = { days:number; startedAt:number; deadline:number; expired:boolean };
export function getReturnableItems(orderId:string):Promise<{ok:boolean;items:ReturnableItem[];window:ReturnWindow;eligible:boolean}>{
  return requestJson(`/api/orders/${encodeURIComponent(orderId)}/returnable`,{timeoutMs:10000});
}

// Chính khách xác nhận đã nhận đúng hàng sau khi bên vận chuyển báo đã giao.
export function confirmOrderReceived(orderId:string):Promise<{ok:boolean;order:ApiOrder}>{
  return jsonPost(`/api/orders/${encodeURIComponent(orderId)}/confirm-received`,{},12000);
}
export function shipBackReturn(returnId:string,payload:{carrier:string;trackingCode:string;note?:string}):Promise<{ok:boolean;returnRequest:ReturnRequest;order:ApiOrder}>{
  return jsonPost(`/api/returns/${encodeURIComponent(returnId)}/ship-back`,payload,12000);
}
export function withdrawReturnRequest(returnId:string):Promise<{ok:boolean;returnRequest:ReturnRequest;order:ApiOrder}>{
  return jsonPost(`/api/returns/${encodeURIComponent(returnId)}/withdraw`,{},12000);
}

// Quy trình mua → giao → nhận → đổi/trả lấy từ backend (lib/fulfillmentPolicy.js)
// để app, trang quản trị và tài liệu luôn mô tả đúng một quy trình.
export type PolicyStage = { status:string; label:string; actor:string; description:string; optional?:boolean; customerCan?:string[]; timerDays?:number };
export type FulfillmentPolicy = {
  version:string;
  actors:Record<string,string>;
  timers:{autoConfirmDays:number;returnWindowDays:number;shipBackDays:number;inspectionDays:number;refundSettlementDays:number};
  order:{stages:PolicyStage[];terminal:PolicyStage[]};
  return:{stages:PolicyStage[];terminal:PolicyStage[];conditions:string[]};
  cancel:{allowedStatuses:string[];description:string};
};
export async function getFulfillmentPolicy():Promise<FulfillmentPolicy>{
  const data:any=await requestJson('/api/policies/fulfillment',{timeoutMs:8000});
  return data.policy;
}

export type ProductReview={id:string;productId:string;userName:string;rating:number;comment:string;media?:ReviewMedia;verifiedPurchase:boolean;createdAt:number;updatedAt:number;helpful:number;notHelpful:number;myReaction:'helpful'|'not_helpful'|null};
export type ProductReviews={ok:boolean;productId:string;summary:{average:number;count:number;distribution:Array<{rating:number;count:number}>};eligibility:{canReview:boolean;purchased:boolean;alreadyReviewed:boolean;orderIds:string[]};reviews:ProductReview[]};
export function getProductReviews(slug:string,userId=''):Promise<ProductReviews>{
  return requestJson(`/api/products/${encodeURIComponent(slug)}/reviews?userId=${encodeURIComponent(userId)}`,{timeoutMs:10000});
}
export function createProductReview(slug:string,payload:{userId:string;userName?:string;rating:number;comment:string;media?:string;mediaKind?:'video'|'audio'}):Promise<{ok:boolean;status:string;message:string;review:ProductReview|null}>{
  return jsonPost(`/api/products/${encodeURIComponent(slug)}/reviews`,payload,90000);
}
export function reactToReview(reviewId:string,userId:string,value:'helpful'|'not_helpful'):Promise<{ok:boolean;review:ProductReview}>{
  return jsonPost(`/api/reviews/${encodeURIComponent(reviewId)}/reaction`,{userId,value},10000);
}

export function getOrderDetail(id:string):Promise<{ok:boolean;order:ApiOrder;payment:StripePaymentRecord|null;returnRequest:ReturnRequest|null;returnRequests?:ReturnRequest[]}>{
  return requestJson(`/api/orders/${encodeURIComponent(id)}`,{timeoutMs:10000});
}

// items rỗng = trả toàn bộ phần chưa yêu cầu; có items = chỉ trả đúng những
// sản phẩm đó trong đơn nhiều món.
export function createReturnRequest(orderId:string,payload:{reason:string;note?:string;photos:string[];items?:Array<{slug:string;colorName:string;size:string;qty:number}>}):Promise<{ok:boolean;order:ApiOrder;payment:StripePaymentRecord;returnRequest:ReturnRequest}>{
  return jsonPost(`/api/orders/${encodeURIComponent(orderId)}/returns`,payload,30000);
}

export function createCancelRequest(orderId:string,payload:{reason:string;note?:string}):Promise<{ok:boolean;order:ApiOrder;returnRequest:ReturnRequest}>{
  return jsonPost(`/api/orders/${encodeURIComponent(orderId)}/cancel-request`,payload,15000);
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
  subtotal:number; discount:number; voucherDiscount?:number; paymentDiscount?:number; vipDiscount?:number; discountCode?:string; total:number; ship:number;
  vipPromotion?:{membershipId:string;code:string;label:string;percent:number;productId:string;productName:string;colorName?:string;size?:string;discountedUnits:number;originalUnitPrice:number;discount:number}|null;
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
