import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { apiAuthProviders } from './api';

// Client ID lấy từ app.json (`extra.google`) và cho phép ghi đè bằng biến môi
// trường khi build, để đổi dự án Google Cloud mà không phải sửa source.
const googleExtra = ((Constants.expoConfig as any)?.extra?.google || {}) as Record<string, string>;
const ANDROID_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleExtra.androidClientId || '').trim();
const WEB_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || googleExtra.webClientId || '').trim();

type GoogleTokens = { idToken?: string; accessToken?: string };

type NativeGoogleModule = {
  GoogleSignin: {
    configure: (options?: Record<string, unknown>) => void;
    hasPlayServices: (options: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
    signIn: () => Promise<{ type: 'success' | 'cancelled'; data: { idToken?: string | null } | null }>;
    getTokens: () => Promise<{ idToken?: string | null; accessToken?: string | null }>;
  };
  statusCodes?: Record<string, string>;
};

let nativeGoogle: NativeGoogleModule | null = null;
let nativeError = '';

try {
  // Google đã ngừng hỗ trợ callback custom URI cho luồng OAuth trình duyệt
  // trên Android. Dùng SDK native để Google Play Services trả kết quả thẳng
  // về Activity, không phụ thuộc trình duyệt hay callback qua Tailscale.
  nativeGoogle = require('@react-native-google-signin/google-signin') as NativeGoogleModule;
  // Trên Android, Google Play Services nhận diện ứng dụng bằng package + vân
  // tay SHA-1 chứ không bằng ID nào truyền vào đây, nên `signIn()` chạy được kể
  // cả khi thiếu `webClientId`. Nhưng THIẾU `webClientId` thì Google chỉ trả
  // access token, không trả idToken — backend vẫn nhận, chỉ là đường xác minh
  // yếu hơn. Khai báo khi có để lấy idToken.
  nativeGoogle.GoogleSignin.configure({
    offlineAccess: false,
    ...(WEB_CLIENT_ID ? { webClientId: WEB_CLIENT_ID } : {}),
  });
} catch (error: any) {
  nativeGoogle = null;
  nativeError = String(error?.message || error || 'thiếu module Google Sign-In native');
}

const nativeReady = Boolean(nativeGoogle?.GoogleSignin);

export function googleConfigured(): boolean {
  return nativeReady;
}

export type GoogleSignInState = {
  available: boolean;
  busy: boolean;
  unavailableReason: string;
  promptAsync: () => Promise<GoogleTokens | null>;
};

function friendlyGoogleError(error: any): string {
  const code = String(error?.code || '');
  const status = nativeGoogle?.statusCodes || {};
  if (code && code === status.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services trên OPPO chưa có hoặc cần cập nhật.';
  }
  if (code && code === status.IN_PROGRESS) {
    return 'Một lượt đăng nhập Google khác đang chạy. Vui lòng chờ một chút.';
  }
  if (code === '10' || /DEVELOPER_ERROR/i.test(String(error?.message || ''))) {
    // Lỗi hay gặp nhất và cũng mơ hồ nhất: nói thẳng phải thêm gì vào đâu.
    return 'Google Cloud chưa nhận APK này. Thêm OAuth client Android cho package '
      + 'vn.japano.app kèm vân tay SHA-1 của khoá ký APK, rồi cài lại app.';
  }
  return String(error?.message || 'Không mở được đăng nhập Google trên thiết bị.');
}

/**
 * Đăng nhập Google native trên Android rồi chuyển token về backend JAPANO.
 * Backend vẫn là nơi kiểm chữ ký, audience và email_verified.
 */
export function useGoogleSignIn(
  onTokens?: (tokens: GoogleTokens) => void | Promise<void>,
): GoogleSignInState {
  const [serverReady, setServerReady] = useState(false);
  const [serverChecked, setServerChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const onTokensRef = useRef(onTokens);

  useEffect(() => { onTokensRef.current = onTokens; });

  // Hỏi lại máy chủ cho tới khi có câu trả lời, thay vì tắt Google vĩnh viễn
  // sau một lần gọi hụt.
  //
  // Màn hình đăng nhập dựng lên ngay lúc app khởi động, đúng lúc đường mạng còn
  // chưa sẵn sàng (adb reverse vừa dựng lại, Wi-Fi vừa đổi, backend vừa restart).
  // Bản đầu chỉ hỏi một lần rồi thôi, nên chỉ cần trượt đúng nhịp đó là nút
  // Google xám suốt phiên dù máy chủ hoàn toàn bình thường — đã gặp thật khi
  // test trên Redmi.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hoi = (lan: number) => {
      apiAuthProviders()
        .then((data) => {
          if (!live) return;
          const san = Boolean(data?.google);
          setServerReady(san);
          setServerChecked(true);
          if (!san && lan < 5) timer = setTimeout(() => hoi(lan + 1), 4000);
        })
        .catch(() => {
          if (!live) return;
          setServerChecked(true);
          if (lan < 5) timer = setTimeout(() => hoi(lan + 1), Math.min(2000 * (lan + 1), 8000));
        });
    };
    hoi(0);

    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);

  const run = async (): Promise<GoogleTokens | null> => {
    if (!nativeGoogle?.GoogleSignin) return null;
    if (!serverReady) {
      // Người dùng bấm nút là lúc đáng hỏi lại nhất: mạng có thể vừa lên.
      const lai = await apiAuthProviders().catch((error: any) => {
        throw new Error(`Không hỏi được máy chủ về đăng nhập Google: ${String(error?.message || error).slice(0, 90)}`);
      });
      if (!lai?.google) throw new Error('Máy chủ báo chưa bật đăng nhập Google (thiếu GOOGLE_CLIENT_ID).');
      setServerReady(true);
    }
    setBusy(true);
    try {
      await nativeGoogle.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await nativeGoogle.GoogleSignin.signIn();
      if (response.type !== 'success') {
        // Trước đây trả null lặng lẽ: người dùng bấm nút và KHÔNG có gì xảy ra,
        // không cách nào biết vì sao. Đây đúng là trạng thái đã gặp trên Redmi.
        throw new Error(
          'Google đóng cửa sổ đăng nhập mà không trả tài khoản. Thường là do Google Cloud '
          + 'chưa có OAuth client khớp package vn.japano.app + SHA-1 của APK, hoặc thiếu Web client ID.',
        );
      }

      const fetched = await nativeGoogle.GoogleSignin.getTokens();
      const idToken = String(response.data?.idToken || fetched.idToken || '').trim() || undefined;
      const accessToken = String(fetched.accessToken || '').trim() || undefined;
      if (!idToken && !accessToken) {
        throw new Error('Google không trả token đăng nhập. Hãy kiểm tra cấu hình OAuth Android.');
      }

      const tokens = { idToken, accessToken };
      await onTokensRef.current?.(tokens);
      return tokens;
    } catch (error: any) {
      // Chỉ log mã/trạng thái kỹ thuật, không log token hay thông tin tài khoản.
      // Release-device log là bằng chứng duy nhất để phân biệt lỗi OAuth/SHA-1
      // với lỗi mạng trước khi request kịp tới backend.
      console.error('[GOOGLE SIGNIN]', {
        code: String(error?.code || ''),
        message: String(error?.message || error || '').slice(0, 180),
        androidClientConfigured: Boolean(ANDROID_CLIENT_ID),
        webClientConfigured: Boolean(WEB_CLIENT_ID),
      });
      throw new Error(friendlyGoogleError(error));
    } finally {
      setBusy(false);
    }
  };

  let unavailableReason = '';
  if (!nativeReady) {
    unavailableReason = `Cần cài APK mới có Google Sign-In native${nativeError ? `: ${nativeError.slice(0, 80)}` : '.'}`;
  }

  // Nút chỉ bị KHOÁ khi thiếu module native — thứ duy nhất khiến bấm cũng vô
  // ích. Phép dò `/api/auth/providers` chỉ là dự đoán: nó trượt bất cứ khi nào
  // mạng chớp tắt lúc màn hình vừa dựng, và khi trượt thì nút xám vĩnh viễn dù
  // Google hoàn toàn dùng được. Nay cứ cho bấm, rồi báo đúng lý do thật lấy từ
  // Google Play Services hoặc từ máy chủ.
  return {
    available: nativeReady,
    busy,
    unavailableReason,
    promptAsync: run,
  };
}
