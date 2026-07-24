import { router } from 'expo-router';

/**
 * Expo Router warns when router.back() is called on a screen that was opened
 * as the first route, for example when restoring the last product page after
 * app restart. This helper avoids the GO_BACK warning by replacing to a safe
 * fallback route when there is no navigation history.
 */
export function goBackOrReplace(fallback: string = '/(tabs)') {
  const canGoBack = typeof (router as any).canGoBack === 'function' ? (router as any).canGoBack() : false;
  if (canGoBack) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
