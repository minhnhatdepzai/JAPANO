import { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { apiAuthProviders } from './api';

// ---------------------------------------------------------------------------
// Vì sao dùng require() trong try/catch thay vì import thẳng
//
// expo-auth-session kéo theo expo-web-browser và expo-crypto — đều là module
// NATIVE. Dev client cài trên máy được build từ trước khi có chúng, nên phần
// native không tồn tại và lời gọi requireNativeModule() sẽ ném lỗi NGAY LÚC NẠP
// MODULE. Vì `import` của ES chạy vô điều kiện khi module được nạp, chỉ cần
// màn đăng nhập import file này là cả màn hình chết — dù người dùng chưa hề
// chạm vào nút Google.
//
// require() trong try/catch cho phép bắt lỗi đó và hạ cấp êm: nút Google tự mờ
// đi kèm lời giải thích, phần còn lại của app chạy bình thường. Sau khi build
// lại dev client, nhánh này tự nhiên chạy đủ mà không phải sửa gì thêm.
// ---------------------------------------------------------------------------

type AuthRequestHook = (config: any) => [any, any, () => Promise<any>];

let googleProvider: any = null;
let nativeError = '';

try {
  const webBrowser = require('expo-web-browser');
  googleProvider = require('expo-auth-session/providers/google');
  // Đóng tab đăng nhập của Google và trả quyền điều khiển lại cho app.
  webBrowser.maybeCompleteAuthSession();
} catch (error: any) {
  googleProvider = null;
  nativeError = String(error?.message || error || 'thiếu module native');
}

const nativeReady = Boolean(googleProvider);

// Client id nằm ở app.json → extra.google.* (không phải bí mật: OAuth client id
// cho ứng dụng di động vốn công khai, phần bảo vệ nằm ở việc backend đối chiếu
// audience — xem backend/lib/googleAuth.js).
//
// Nguồn ƯU TIÊN là biến EXPO_PUBLIC_*, không phải app.json.
//
// Lý do rất thực tế: dev client đọc app config từ bản NƯỚNG SẴN trong APK lúc
// build, chứ không lấy theo Metro (đo thực tế trên máy: Constants.manifest2 là
// null, expoConfig.extra chỉ còn 'router'). Nghĩa là điền Client ID vào
// app.json xong thì app vẫn KHÔNG thấy cho tới khi build lại APK — một cái bẫy
// im lặng và rất tốn thời gian.
//
// Ngược lại, Metro nhúng thẳng mọi biến EXPO_PUBLIC_* vào bundle lúc đóng gói,
// nên chỉ cần khởi động lại Metro là app thấy giá trị mới. Đây cũng đúng cách
// dự án đang truyền EXPO_PUBLIC_API_URL (xem lib/api.ts và start-all.sh).
//
// Vẫn giữ nhánh Constants làm dự phòng cho bản build release, nơi app.json thực
// sự được nướng vào app đúng thời điểm.
function clientIds() {
  const C: any = Constants as any;
  const fromConfig = [
    C?.expoConfig?.extra?.google,
    C?.manifest2?.extra?.expoClient?.extra?.google,
    C?.manifest?.extra?.google,
    C?.expoGoConfig?.extra?.google,
  ].find((cfg) => cfg && (cfg.androidClientId || cfg.iosClientId || cfg.webClientId)) || {};

  const pick = (envValue: string | undefined, configValue: unknown) =>
    String(envValue || '').trim() || String(configValue || '').trim() || undefined;

  return {
    androidClientId: pick(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID, fromConfig.androidClientId),
    iosClientId: pick(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS, fromConfig.iosClientId),
    webClientId: pick(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB, fromConfig.webClientId),
  };
}

const CLIENT_IDS = clientIds();
const configured = Boolean(CLIENT_IDS.androidClientId || CLIENT_IDS.iosClientId || CLIENT_IDS.webClientId);

// Việc "đọc được client id hay không" từng im lặng hỏng theo hai cách khác nhau
// (thiếu module native, và đọc sai nhánh manifest trên dev client). Một dòng log
// lúc chạy dev nói thẳng trạng thái, đỡ phải đoán mò lần sau.
if (__DEV__) {
  const id = CLIENT_IDS.androidClientId || CLIENT_IDS.iosClientId || CLIENT_IDS.webClientId;
  console.log(`[JAPANO] Google auth — native:${nativeReady ? 'ok' : 'THIẾU'} `
    + `clientId:${id ? `${id.slice(0, 14)}…` : 'KHÔNG ĐỌC ĐƯỢC'}`
    + `${nativeError ? ` err:${nativeError.slice(0, 60)}` : ''}`);
}

export function googleConfigured(): boolean {
  return configured;
}

// Chọn implementation MỘT LẦN lúc nạp module, không phải mỗi lần render. Nhờ
// vậy số lượng và thứ tự hook luôn cố định — đúng Rules of Hooks.
//
// Điều kiện `configured` ở đây là bắt buộc, không phải cho đẹp: khi thiếu
// client id, useAuthRequest của expo-auth-session NÉM LỖI ngay trong lúc render
// (invariantClientId), làm sập nguyên màn đăng nhập. Phải chặn TRƯỚC khi gọi
// hook thì phần "nút mờ kèm lý do" bên dưới mới có cơ hội chạy.
const useAuthRequest: AuthRequestHook = nativeReady && configured
  ? googleProvider.useAuthRequest
  : () => [null, null, async () => ({ type: 'dismiss' })];

export type GoogleSignInState = {
  /** Nút chỉ nên bấm được khi app, máy chủ VÀ dev client đều đã sẵn sàng. */
  available: boolean;
  busy: boolean;
  /** Vì sao chưa dùng được — để màn hình nói đúng thứ đang thiếu. */
  unavailableReason: string;
  promptAsync: () => Promise<{ idToken?: string; accessToken?: string } | null>;
};

/**
 * Bọc expo-auth-session để phần còn lại của app không phải biết chi tiết OAuth.
 *
 * Token tới qua callback `onTokens` chứ KHÔNG phải giá trị trả về của
 * promptAsync — xem chú thích ở useEffect bên dưới, đây là chỗ rất dễ làm sai.
 *
 * Ưu tiên idToken (backend kiểm được chữ ký ngay tại chỗ), không có thì dùng
 * accessToken để backend hỏi thẳng Google. Cả hai đường đều được backend xác
 * minh; app không bao giờ tự khai email/tên.
 */
export function useGoogleSignIn(
  onTokens?: (tokens: { idToken?: string; accessToken?: string }) => void | Promise<void>,
): GoogleSignInState {
  const [serverReady, setServerReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = useAuthRequest({
    ...CLIENT_IDS,
    scopes: ['openid', 'profile', 'email'],
  });

  // Giữ callback trong ref để useEffect dưới chỉ phụ thuộc `response`; nếu đưa
  // callback vào mảng phụ thuộc, mỗi lần màn hình vẽ lại là đăng nhập chạy lại.
  const onTokensRef = useRef(onTokens);
  useEffect(() => { onTokensRef.current = onTokens; });

  useEffect(() => {
    let live = true;
    apiAuthProviders()
      .then((data) => { if (live) setServerReady(Boolean(data?.google)); })
      .catch(() => { if (live) setServerReady(false); });
    return () => { live = false; };
  }, []);

  // ĐÂY là chỗ lấy token, không phải chỗ trả về của promptAsync().
  //
  // Trên thiết bị, expo-auth-session dùng luồng Code + PKCE: promptAsync() giải
  // quyết ngay khi Google trả về, lúc đó mới chỉ có `params.code`, còn
  // `authentication` vẫn null. Việc đổi code lấy token diễn ra SAU ĐÓ trong một
  // useEffect của thư viện và kết quả chỉ xuất hiện ở `response`.
  //
  // Đọc token từ giá trị trả về của promptAsync() nên luôn rỗng — đăng nhập
  // Google chạy xong xuôi mà app im lặng không vào được, không báo lỗi gì.
  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') { setBusy(false); return; }
    const idToken = (response.params as any)?.id_token || (response as any)?.authentication?.idToken;
    const accessToken = (response as any)?.authentication?.accessToken;
    // Lần cập nhật đầu chỉ có `code`; chờ lần sau khi đã đổi xong token.
    if (!idToken && !accessToken) return;
    setBusy(false);
    void onTokensRef.current?.({ idToken, accessToken });
  }, [response]);

  const run = async () => {
    if (!request) return null;
    setBusy(true);
    const result = await promptAsync();
    // Khách tự đóng cửa sổ Google thì không có gì để chờ nữa.
    if (result?.type !== 'success') setBusy(false);
    return null;
  };

  let unavailableReason = '';
  if (!nativeReady) unavailableReason = 'Cần build lại dev client để có expo-web-browser và expo-crypto.';
  else if (!configured) unavailableReason = 'Chưa điền Google Client ID trong app.json (extra.google).';
  else if (!serverReady) unavailableReason = 'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID_*.';
  else if (!request) unavailableReason = 'Đang chuẩn bị phiên đăng nhập Google…';

  return {
    available: nativeReady && googleConfigured() && serverReady && Boolean(request),
    busy,
    unavailableReason,
    promptAsync: run,
  };
}
