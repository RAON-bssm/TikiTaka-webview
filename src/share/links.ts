// 앱 레포(TikiTaka-app)와 동기화 필요: app.json의 scheme·ios.bundleIdentifier·android.package, src/app/+native-intent.tsx
const APP_SCHEME = 'tikitaka';
const ANDROID_PACKAGE = 'com.tikitaka.raon';

export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6822633977';
/** Android는 원스토어로만 배포한다. 비어 있으면 앱이 없을 때 Chrome 기본 동작(Play 스토어 검색)으로 넘어간다. */
export const ONE_STORE_URL = '';

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  // iPadOS 13+ Safari는 데스크톱 UA(Macintosh)를 보내서 터치 지원으로 구분한다.
  if (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
}

/**
 * 앱이 있으면 앱의 게시글로, 없으면 스토어로 보내는 주소.
 * - Android: intent URL. 앱이 없으면 Chrome·카톡 인앱 브라우저가 `browser_fallback_url`(원스토어)로 보낸다.
 * - iOS: 같은 도메인 페이지 안에서 누른 링크는 유니버설 링크로 열리지 않아 커스텀 스킴을 쓴다.
 *   앱이 없을 때 스토어로 넘기는 건 `main.ts`의 타이머가 한다.
 * - 그 밖(PC 등): 앱을 열 수 없으니 App Store 페이지로 보낸다.
 */
export function getOpenAppUrl(platform: Platform, postId: string): string {
  const path = `p/${encodeURIComponent(postId)}`;
  if (platform === 'ios') return `${APP_SCHEME}://${path}`;
  if (platform === 'other') return APP_STORE_URL;

  const fallback = ONE_STORE_URL
    ? `S.browser_fallback_url=${encodeURIComponent(ONE_STORE_URL)};`
    : '';
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};${fallback}end`;
}
