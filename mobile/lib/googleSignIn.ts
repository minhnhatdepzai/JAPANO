import { useEffect, useRef, useState } from 'react';
import { apiAuthProviders } from './api';

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
  nativeGoogle.GoogleSignin.configure({ offlineAccess: false });
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
    return 'Google Cloud chưa khớp package vn.japano.app và SHA-1 của APK này.';
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

  useEffect(() => {
    let live = true;
    apiAuthProviders()
      .then((data) => {
        if (!live) return;
        setServerReady(Boolean(data?.google));
        setServerChecked(true);
      })
      .catch(() => {
        if (!live) return;
        setServerReady(false);
        setServerChecked(true);
      });
    return () => { live = false; };
  }, []);

  const run = async (): Promise<GoogleTokens | null> => {
    if (!nativeGoogle?.GoogleSignin || !serverReady) return null;
    setBusy(true);
    try {
      await nativeGoogle.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await nativeGoogle.GoogleSignin.signIn();
      if (response.type !== 'success') return null;

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
      throw new Error(friendlyGoogleError(error));
    } finally {
      setBusy(false);
    }
  };

  let unavailableReason = '';
  if (!nativeReady) {
    unavailableReason = `Cần cài APK mới có Google Sign-In native${nativeError ? `: ${nativeError.slice(0, 80)}` : '.'}`;
  } else if (!serverChecked) {
    unavailableReason = 'Đang kiểm tra cấu hình Google trên máy chủ…';
  } else if (!serverReady) {
    unavailableReason = 'Máy chủ chưa cấu hình Google hoặc OPPO chưa kết nối được qua Tailscale.';
  }

  return {
    available: nativeReady && serverReady,
    busy,
    unavailableReason,
    promptAsync: run,
  };
}
