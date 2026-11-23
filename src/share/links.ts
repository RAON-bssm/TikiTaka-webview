// 앱 레포(TikiTaka-app)와 동기화 필요: app.json의 scheme·ios.bundleIdentifier·android.package, src/app/+native-intent.tsx
const APP_SCHEME = 'tikitaka';
const ANDROID_PACKAGE = 'com.tikitaka.raon';

export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6822633977';
/** Android는 원스토어로만 배포한다. 비어 있으면 Android에서 설치 버튼을 숨긴다. */
export const ONE_STORE_URL = '';

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return 'android';
  // iPadOS 13+ Safari는 데스크톱 UA(Macintosh)를 보내서 터치 지원으로 구분한다.
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
}

export function getStoreUrl(platform: Platform): string | null {
  if (platform === 'ios') return APP_STORE_URL;
  if (platform === 'android') return ONE_STORE_URL || null;
  return null;
}

/**
 * 같은 도메인의 페이지 안에서 누른 링크는 iOS가 유니버설 링크로 열지 않아, 커스텀 스킴으로 연다.
 * Android는 intent URL로 열면 앱이 없을 때 Chrome·카톡 인앱 브라우저가 스토어로 대신 보낸다.
 */
export function getOpenAppUrl(platform: Platform, postId: string): string {
  const path = `p/${encodeURIComponent(postId)}`;
  if (platform !== 'android') return `${APP_SCHEME}://${path}`;

  const storeUrl = getStoreUrl(platform);
  const fallback = storeUrl ? `S.browser_fallback_url=${encodeURIComponent(storeUrl)};` : '';
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};${fallback}end`;
}
