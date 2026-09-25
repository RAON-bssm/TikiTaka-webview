# TikiTaka 동네 지도 웹 (WebView) 구현 계획

> 이 문서는 **지도 웹 레포**에서 작업을 시작할 때 필요한 결정 사항, 앱 현황, 브리지 규약, 구현 명세, 마일스톤을 정리한 것이다.
> 앱 레포: `TikiTaka-app` (Expo). 작성 기준: 2026-09-25, 앱 브랜치 `feat/TK-99`.

---

## 0. 한눈에 보기

- 앱의 새 **지도 탭**은 WebView 하나이고, 그 안에 이 웹 페이지(카카오맵)를 띄운다.
- 웹은 **지도와 지도 위에서 움직이는 것**(캐릭터, 말풍선, 추후 스티커)만 그린다.
- **데이터와 나머지 UI**(인증, API 호출, 챗봇 화면, 바텀시트, 꾸미기 도구)는 앱(RN)이 담당한다.
- 웹과 앱은 JSON 메시지로만 통신한다(4장). 웹은 **백엔드 API를 직접 호출하지 않는다.**

```
┌──────────────── 앱 (Expo / RN) ────────────────┐
│  지도 탭 화면                                   │
│  ├ TanStack Query로 내 정보·동네·캐릭터·파츠 조회 │
│  ├ 챗봇 화면 / 바텀시트 / 동네 토글 (RN UI)      │
│  └ WebView ───────────────────────────────┐    │
│       ▲ injectJavaScript(RN → 웹)          │    │
│       │ ReactNativeWebView.postMessage(웹 → RN)│
└───────┼────────────────────────────────────┼────┘
        ▼                                    │
┌──────────────── 지도 웹 (이 레포) ──────────┴────┐
│  Vite + React + TS, Vercel 배포                  │
│  ├ 카카오맵 JS API (react-kakao-maps-sdk)        │
│  ├ 캐릭터 렌더러 (파츠 레이어 합성)               │
│  ├ 캐릭터 이동/애니메이션, 말풍선                 │
│  └ (추후) 스티커 레이어/편집 모드                  │
└──────────────────────────────────────────────────┘
```

---

## 1. 확정된 결정 사항

| 항목            | 결정                                                                        | 이유                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 지도            | 카카오맵 **JavaScript API**                                                 | RN용 카카오맵 네이티브 래퍼 중 쓸 만한 것이 없다. `@react-native-kakao/map`은 2025-03 저장소에서 제거됐고, 나머지는 수년간 관리되지 않았다. |
| 앱 통합         | `react-native-webview`로 호스팅된 페이지를 띄움                             | 캐릭터와 스티커는 지도 좌표를 따라 움직여야 하므로 지도와 같은 레이어(웹)에서 그려야 한다.                                                  |
| 웹 스택         | **Vite + React + TypeScript**                                               | SSR·SEO가 필요 없고, 카카오 SDK는 브라우저 전용이다. Next.js는 이득 없이 제약만 는다.                                                       |
| 지도 라이브러리 | [`react-kakao-maps-sdk`](https://github.com/JaeSeoKim/react-kakao-maps-sdk) | `Map`, `CustomOverlayMap`, `useKakaoLoader`를 제공하고 유지보수 중이다.                                                                     |
| 배포            | Vercel (고정 도메인)                                                        | push하면 배포된다. 카카오 콘솔에는 고정 도메인만 등록한다.                                                                                  |
| 데이터          | 앱이 조회해 메시지로 전달                                                   | 토큰과 재발급 로직을 웹에 복제하지 않는다. 인증은 앱 한 곳에서만 관리한다.                                                                  |
| 캐릭터 파츠     | **하이브리드**: 기본 파츠는 프론트에 번들, 추가 파츠는 백엔드가 관리(URL)   | 팀 결정 사항. 5장 참고.                                                                                                                     |

---

## 2. 현재 앱 상황 (웹 구현에 필요한 것만)

### 2.1 스택 · 구조

- Expo SDK 56, Expo Router, React 19.2, RN 0.85(New Architecture), TS 6, NativeWind v4, TanStack Query v5, axios.
- 패키지 매니저는 **pnpm**. 새 네이티브 의존성은 `pnpm expo install`로 추가한다.
- **`react-native-webview`는 아직 설치되어 있지 않다.** 앱 쪽 작업 1순위다.
- 탭 구성: `홈 | 랭킹 | 카메라 | 피드 | 상점`. **피드 탭 자리를 지도로 교체할 예정**이다. 피드는 홈의 "더보기"로 계속 들어갈 수 있다.
- 바텀바(`src/components/ui/AppBar.tsx`)는 카메라 화면에서만 숨기도록 하드코딩되어 있다. 지도 꾸미기 모드를 넣을 때 "숨김 라우트 목록"으로 일반화한다.

### 2.2 백엔드 / 네트워크

- API 서버는 현재 **평문 HTTP**다(`EXPO_PUBLIC_API_URL=http://...`). 앱은 iOS ATS 예외를 따로 설정해서 쓰고 있다.
- **웹 페이지는 HTTPS(Vercel)이므로, HTTP 이미지는 혼합 콘텐츠로 차단된다.** 서버 파츠·스티커 이미지는 반드시 **HTTPS URL**(S3 + CloudFront 등)로 받아야 한다. 백엔드 협의 1순위.
- 게시물 이미지는 S3 key → presigned URL(유효 10분) 방식이다. **파츠에 이 방식을 쓰면 지도를 켜둔 동안 만료돼 깨진다.** 파츠·스티커는 만료 없는 공개 CDN URL이어야 한다.
- 응답 공통 규칙: 값이 없는 필드는 null이 아니라 **키가 빠진다**. 일시는 타임존 없는 KST 문자열이다.

### 2.3 동네 데이터

```ts
// GET /api/user/me 의 main_location / sub_location
interface UserLocation {
  location_id: number;
  location_city_name: string; // '부산광역시'
  location_name: string; // '북구'
}
```

- **좌표(위경도)와 경계 데이터가 없다.** 당장은 카카오 geocoder로 `'부산광역시 북구'` → 좌표를 구하고, 나중에 서버 필드로 교체한다.
- 표시·비교용 전체 이름은 `시/도 + ' ' + 동네`다(`formatLocationName`). **'북구'처럼 이름이 같은 구가 여러 시/도에 있으므로** 동네명만으로 식별하지 말 것.
- 이번 라운드 대결은 `GET /api/board`의 `team1_name`/`team2_name`으로 알 수 있다(전체 이름 형태). `my_match: true`인 항목이 내 동네의 대결이다.

### 2.4 캐릭터 시스템 (웹 렌더러가 똑같이 따라야 하는 규칙)

**데이터**: 캐릭터는 이미지가 아니라 파츠 id의 JSON이다.

```ts
interface CharacterConfig {
  body: string; // 'body02'
  eyes: string; // 'eyes01'
  eyesColor: string; // 'orange'
  mouth: string; // 'mouth01'
  hairBack: string; // 'long'
  hairFront: string; // 'basic'
  hairColor: string; // 'black'  (앞/뒤 머리 공유)
  clothing?: string; // 'clothing01'
  accessory?: string; // 'glasses'
}
```

**그리는 순서** (아래 → 위, 앱 `src/constants/character/types.ts`의 `LAYERS`):

| #   | 레이어          | 모양 키     | 색상 키     | 파일 경로                     |
| --- | --------------- | ----------- | ----------- | ----------------------------- |
| 1   | 뒷머리          | `hairBack`  | `hairColor` | `hair-back/<모양>/<색>.webp`  |
| 2   | 몸              | `body`      | —           | `body/<모양>.webp`            |
| 3   | 코스튬          | `clothing`  | —           | `clothing/<모양>.webp`        |
| 4   | 눈              | `eyes`      | `eyesColor` | `eyes/<모양>/<색>.webp`       |
| 5   | 입              | `mouth`     | —           | `mouth/<모양>.webp`           |
| 6   | 앞머리          | `hairFront` | `hairColor` | `hair-front/<모양>/<색>.webp` |
| 7   | 악세서리        | `accessory` | —           | `accessory/<모양>.webp`       |
| 8   | 머리 하이라이트 | (없음)      | `eyesColor` | `hair-highlights/<색>.webp`   |

- 폴더명은 그룹명의 kebab-case다(`hairBack` → `hair-back`). id = 파일명(확장자 제외).
- 값이 없거나 파일이 없는 레이어는 **건너뛴다**(에러 아님). 예: 악세서리 미착용.
- 하이라이트는 **눈 색**을 따른다(머리 색 아님).

**렌더링 기하** (앱 `src/components/character/Character.tsx`와 동일해야 앱과 크기·위치가 같다):

- 모든 파츠는 **1440×1440 투명 WebP**이고 정위치에 그려져 있다. 같은 크기로 겹치기만 하면 정렬된다.
- 캐릭터 본체는 중앙 **1024** 영역에 있고, 바깥 여백은 넓은 헤어용이다. 이 1024 영역이 컨테이너를 채우도록 확대한다.

```
OVERSCALE = 1440 / 1024 = 1.40625
정사각형 컨테이너(size×size) 안에 레이어 박스를
  position:absolute; top/left = -20.3125%; width/height = 140.625%
로 두고, 각 레이어 <img>는 박스를 꽉 채운다(absolute, 100%, object-fit: contain).
헤어는 컨테이너 밖으로 넘칠 수 있으므로 overflow는 보이게 둔다.
```

**기본 config** (앱 `DEFAULT_CHARACTER_CONFIG`, 파츠 폴백 기준):

```ts
{ body: 'body02', eyes: 'eyes01', eyesColor: 'orange', mouth: 'mouth01',
  hairBack: 'long', hairFront: 'basic', hairColor: 'black', clothing: 'clothing01' }
```

**현재 앱에 번들된 파츠** (`TikiTaka-app/assets/character/`):

- body: `body01`, `body02` / mouth: `mouth01`, `mouth02` / clothing: `clothing01`~`clothing06`
- accessory: `glasses`, `plaster`, `red-glasses`, `red-glasses-hair-pin`
- eyes: `eyes01` × {`blue`, `green`, `orange`, `pink`, `sky`}
- hair-back: `bob`, `long`, `low-pigtails`, `low-tail`, `puff`, `short`, `side-bob`, `side-tail`, `side-wave`, `wave` × {`black`, `blond`, `brown`, `pink`}
- hair-front: `basic` × {`black`, `blond`, `brown`, `pink`}
- hair-highlights: `blue`, `green`, `orange`, `pink`, `sky`
- `footrest.webp`: 꾸미기 화면의 발판 이미지(파츠 아님)

> 하이브리드 전환 후 "어떤 파츠가 기본(번들)인지"는 **아직 확정되지 않았다.** 확정되면 이 목록을 갱신하고, 웹 `public/parts/`와 앱 번들을 같은 목록으로 맞춘다.

**서버 측 현황**

- 상점 상품의 `product_name`이 곧 파츠 id다(합의 사항). `product_type`은 snake_case(`hair_back`, `hair_front`)다.
- 서버에는 **색상 개념이 없다.** 착용 API(`/api/equipment`)는 `product_id` 기반이다.
- 현재 앱은 캐릭터 config를 **기기 로컬(SecureStore)에만** 저장한다. **다른 유저의 캐릭터를 주는 API는 없다.** 랭킹 아바타도 앱이 무작위 풀(`src/constants/ranking.ts`의 `pickRankingCharacter`)로 채우고 있다.

### 2.5 디자인 토큰 (웹도 같은 값 사용)

- 색상 원본: 앱 `src/constants/colors.js`
  - primary 600 `#FC8253`(주황, 브랜드), secondary 500 `#4078FF`(파랑)
  - gray 50 `#F8F9FB` ~ 800 `#1A202C`, 흰색은 `#FFFFFF`
- 폰트: Pretendard(Regular/Medium/Bold, 본문), **OkDanDan-Bold**(제목·캐릭터 이름 등 강조). 앱 `assets/fonts/`의 파일을 `public/fonts/`에 둔다.
  - OkDanDan(Ok단단체, © OKTICON)은 웹사이트·임베딩 사용 허용, 폰트 파일 수정·재배포 금지다([눈누](https://noonnu.cc/en/font_page/1664)). 그래서 **변환·서브셋 없이 원본 TTF**(458KB)를 쓴다.
  - Pretendard(OFL, 예약 글꼴 이름 'Pretendard')는 직접 수정한 파일을 쓸 수 없으므로 **공식 동적 서브셋 WOFF2**를 그대로 쓴다. 현재 SemiBold(600)만 넣었다(말풍선).
- 간격: 4 / 8 / 12 / 16 / 20 / 24 / 40 / 48px. 반경: 4 / 8 / 12 / 16 / 24px.

---

## 3. 카카오 개발자 콘솔 설정

1. 앱 → **JavaScript 키** 확인. 로그인에 쓰는 네이티브 앱 키와는 다른 키다.
2. 플랫폼 → **Web** → 사이트 도메인 등록
   - `https://<프로젝트>.vercel.app` (또는 커스텀 도메인)
   - `http://localhost:5173` (로컬 개발)
3. Vercel **프리뷰 배포 URL은 매번 바뀌어 등록할 수 없다.** 프리뷰에서는 지도가 안 뜨는 게 정상이다. 앱 연동 확인은 고정 도메인으로 한다.
4. JS 키는 등록 도메인에서만 동작하는 공개 키다. 코드에 들어가도 되지만 `VITE_KAKAO_JS_KEY` 환경변수로 관리한다.
5. 카카오맵 API 무료 호출 한도와 쿼터를 확인해 둔다(지도 로드·geocoder 호출 수).

---

## 4. 브리지 규약 (RN ↔ 웹)

### 4.1 전송 방식

- **웹 → RN**: `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`
- **RN → 웹**: RN이 `webViewRef.injectJavaScript("window.__tikitaka.receive(" + JSON.stringify(msg) + "); true;")`를 호출한다.
  - `webView.postMessage`는 iOS와 Android에서 이벤트가 붙는 대상(window/document)이 달라, 전역 수신 함수 방식으로 통일한다.
- 모든 메시지는 `{ v: 1, type: string, ... }` 형태다. 규약이 바뀌면 `v`를 올리고, 모르는 `type`은 무시한다(앱과 웹의 배포 시점이 다르기 때문).
- **메시지 타입 파일(`bridge.ts`)은 앱과 웹이 같은 내용을 복사해 쓴다.** 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.

### 4.2 메시지 정의 (v1 초안)

```ts
type LatLng = { lat: number; lng: number };

/** 파츠 경로 키 → HTTPS URL. 키 규칙은 5.2 참고. 예: 'hair-back/bob/pink' */
type PartUrlMap = Record<string, string>;

interface MapCharacter {
  id: string; // 탭 이벤트로 되돌려줄 식별자 (NPC id 또는 user_id)
  name: string; // 말풍선·이름표 표시용
  config: CharacterConfig;
  kind: 'npc' | 'user'; // 추후 동작 차이용
}

interface Neighborhood {
  locationId: number;
  cityName: string; // '부산광역시'
  name: string; // '북구'
  center?: LatLng; // 서버가 주면 사용, 없으면 웹이 geocoder로 계산
}

// RN → 웹
type ToWeb =
  | {
      v: 1;
      type: 'init';
      neighborhood: Neighborhood;
      characters: MapCharacter[];
      partUrls: PartUrlMap;
    }
  | { v: 1; type: 'setNeighborhood'; neighborhood: Neighborhood; characters: MapCharacter[] }
  | { v: 1; type: 'upsertCharacters'; characters: MapCharacter[]; partUrls?: PartUrlMap }
  | { v: 1; type: 'showBubble'; characterId: string; text: string; durationMs?: number }
  | { v: 1; type: 'focusCharacter'; characterId: string }
  // (추후) 스티커
  | { v: 1; type: 'setStickers'; stickers: PlacedSticker[]; stickerUrls: Record<string, string> }
  | { v: 1; type: 'setEditMode'; enabled: boolean };

// 웹 → RN
type ToRN =
  | { v: 1; type: 'ready' } // SDK 로드 + 수신 함수 등록 완료
  | { v: 1; type: 'mapLoaded' } // 첫 화면 렌더 완료 (RN 로딩 UI 해제)
  | { v: 1; type: 'characterTap'; characterId: string }
  | {
      v: 1;
      type: 'mapError';
      code: 'SDK_LOAD_FAILED' | 'GEOCODE_FAILED' | 'UNKNOWN';
      message?: string;
    }
  | { v: 1; type: 'log'; level: 'info' | 'warn' | 'error'; message: string } // 개발용
  // (추후) 스티커
  | { v: 1; type: 'stickersChanged'; stickers: PlacedSticker[] };

interface PlacedSticker {
  id: string; // 배치 인스턴스 id (웹이 생성: crypto.randomUUID)
  stickerId: string; // 스티커 종류 id
  position: LatLng;
  rotation: number; // deg
  scale: number; // 1 = 기본 크기
}
```

### 4.3 수명 주기

```
RN: WebView 마운트 (RN은 로딩 Skeleton 표시)
웹: SDK 로드 → window.__tikitaka.receive 등록 → 'ready' 전송
RN: 'ready' 수신 → 'init' 전송
웹: 좌표 결정 → 지도·캐릭터 렌더 → 'mapLoaded' 전송
RN: 로딩 UI 해제
실패 시 웹 → 'mapError' → RN이 ErrorRetry 표시 → 재시도는 WebView reload
```

- **`ready` 전에 RN이 보낸 메시지는 유실된다.** RN은 `ready`를 받기 전까지 보내지 않는다.
- WebView가 재로드되면(메모리 부족으로 인한 프로세스 종료 포함) `ready`가 다시 오므로, RN은 그때마다 `init`을 다시 보낸다.
- 웹은 받은 메시지를 런타임에 검증한다(`zod/mini`, `src/bridge/schema.ts`). 형식이 잘못되면 메시지 전체를 무시하고 `log`(warn)로 오류 위치를 알린다. 모르는 `type`은 로그 없이 무시하고, 객체의 모르는 필드는 버린다.

---

## 5. 하이브리드 파츠 처리

### 5.1 원칙

- **기본 파츠**: 웹 레포 `public/parts/`에 앱과 같은 폴더 구조로 번들한다. 앱 번들 목록과 같게 유지한다.
- **추가 파츠**: 백엔드가 HTTPS 공개 URL로 제공한다. 웹은 RN이 넘긴 `partUrls`로만 알 수 있다.
- 웹에는 **기본 파츠 매니페스트**(`src/parts/manifest.ts`, 번들된 경로 목록)를 둔다. 경로 존재 여부를 네트워크 요청 없이 판단하기 위해서다.

### 5.2 경로 키 규칙

레이어 하나를 그릴 때 config로부터 아래 키를 만든다. 번들 파일 경로(확장자 제외)와 같다.

```
SIMPLE: '<그룹 폴더>/<모양>'          예) 'accessory/glasses'
COLOR : '<그룹 폴더>/<모양>/<색>'     예) 'hair-back/bob/pink'
TINT  : '<그룹 폴더>/<색>'            예) 'hair-highlights/sky'
```

> 서버 파츠 카탈로그 API의 형태가 정해지면, **RN이 이 키 형태로 변환해서** `partUrls`를 넘긴다. 웹은 서버 스키마를 몰라도 된다.

### 5.3 해석 순서

```
key = 위 규칙으로 생성
1) manifest에 key가 있으면     → `/parts/${key}.webp`
2) partUrls[key]가 있으면       → 그 URL
3) 둘 다 없으면                 → 기본 config의 같은 슬롯 값으로 key를 다시 만들어 1)부터
4) 그래도 없으면                → 레이어 건너뜀
이미지 로드 실패(onerror)       → 3)과 같은 폴백
```

- 옵셔널 슬롯(`clothing`, `accessory`)이 config에 **없으면** 폴백하지 않고 건너뛴다. 3)은 "값은 있는데 이미지가 없는 경우"에만 적용한다.
- 로드 실패한 URL은 세션 동안 기억해 두고 다시 요청하지 않는다.

### 5.4 캐시 · 프리로드

- 같은 파츠를 여러 캐릭터가 공유하므로 URL 단위로 `Image` 객체를 캐시한다.
- `init`을 받으면 필요한 URL을 모아 병렬로 미리 불러온 뒤 캐릭터를 표시한다. 일부가 늦으면 폴백 규칙대로 먼저 그리고, 로드되면 교체한다.
- 서버 파츠 응답에는 긴 `Cache-Control`을 요청한다(백엔드 협의).

---

## 6. 기능 명세

### 6.1 지도

- SDK 로드: `useKakaoLoader({ appkey, libraries: ['services'] })`.
- 초기 중심: `neighborhood.center`가 있으면 사용하고, 없으면 `new kakao.maps.services.Geocoder().addressSearch('<시/도> <동네>')` 결과를 쓴다. 실패하면 `mapError(GEOCODE_FAILED)`를 보낸다.
- geocoder 결과는 `locationId` 기준으로 `localStorage`에 캐시한다(쿼터 절약). 실패해도 동작해야 하므로 try/catch로 감싼다.
- 줌: 별도 제한 작업은 두지 않는다. 캐릭터가 알아보기 어려울 만큼 멀어지면 캐릭터를 숨기는 기준 레벨(6.2)과 함께, 필요하면 `maxLevel` 하나만 둔다. 값은 디자인 확인 후 정한다.
- 이동 범위: **제한하지 않는다.** 카카오 JS API에는 "최대 경계" 옵션이 없어 `dragend`에서 되돌리는 방식밖에 없는데, 손을 뗄 때 지도가 튕겨 돌아가 사용감이 나쁘다. 옆 동네를 둘러봐도 깨지는 것이 없다. 멀리 벗어났을 때는 RN의 "우리 동네로" 버튼 등으로 동네 중심에 돌아오게 한다(필요해지면 브리지 메시지 추가).
- 동네 전환(`setNeighborhood`): 캐릭터를 비우고, 새 중심으로 `panTo`한 뒤 새 캐릭터를 배치한다.
- **지도 자체의 색이나 스타일은 바꿀 수 없다**(카카오 JS API 제약). 앱 느낌은 오버레이로 낸다.
- 경계 폴리곤(마일스톤 M5): 행정구역 경계 GeoJSON이 필요하다. 출처와 라이선스(통계청 SGIS, 공공데이터 등)를 정한 뒤 `Polygon`으로 그린다. 경계가 생기면 캐릭터 이동 범위(목표 지점)를 폴리곤 기준으로 바꾼다. 사용자의 지도 이동은 제한하지 않는다.
- 카카오 로고와 저작권 표기는 가리지 않는다(약관).

### 6.2 캐릭터 렌더러

- `<CharacterSprite config size />`: 2.4의 기하 규칙대로 `<img>` 레이어를 합성한다.
- 지도에는 `CustomOverlayMap`(`clickable: true`)으로 올리고, **발 위치가 좌표에 오도록** 하단 중앙을 기준점(`yAnchor: 1`)으로 둔다.
- 줌 레벨에 따라 크기를 조절한다. 현재 임시값: 레벨 6 이하 64px, 7~8은 40px, 9 이상은 숨김(DOM에서 제거). 디자인 확인 후 확정한다.
- 이름표: 캐릭터 발밑에 OkDanDan 폰트로 표시한다. `absolute`로 붙여 오버레이 높이에 넣지 않아야 발 위치(`yAnchor: 1`)가 유지된다. 디자인이 없어 반투명(60%) 검은(`gray-800`) 둥근 네모(`radius-xs`) + 흰 글씨로 임시 구현했다.
- 겹침: 위도가 낮을수록(화면 아래일수록) 앞에 그린다(`zIndex`를 위도로 계산).
- 첫 배치: 동네 중심 반경(`CHARACTER_AREA_RADIUS_M`, 임시 1500m) 안에서 캐릭터 id를 시드로 위치를 뽑는다. 앞서 선 캐릭터와 최소 간격(임시 300m)을 두려고 후보를 여러 개 뽑아 고른다. 같은 id 목록이면 항상 같은 자리다.
  - 강·산 위에 설 수 있다. 땅 위로 제한하려면 별도 데이터가 필요하므로 경계 폴리곤(M5) 때 함께 검토한다.
- 동시 표시 상한: RN이 보낸 순서대로 앞에서 15명.

### 6.3 돌아다니기

- 상태 머신: `idle(2~5초) → walking(목표 지점까지) → idle ...`
- 목표 지점: 캐릭터 이동 허용 영역 안의 무작위 좌표. 경계가 생기기 전에는 중심에서 반경 N m 안으로 제한한다.
- 이동: 초당 이동 거리를 고정하고, `requestAnimationFrame` 안에서 **10~15fps 정도로만** `setPosition`을 갱신한다. 걷는 느낌은 CSS 애니메이션(상하 흔들림)으로 낸다.
- 진행 방향에 따라 좌우를 반전한다(`scaleX(-1)`). 파츠가 좌우 대칭이 아니면 디자이너와 확인한다.
- 성능 규칙:
  - 동시 표시 캐릭터 상한(초기값 15, 실기기 측정 후 조정)
  - 화면 밖 캐릭터는 이동 계산만 하고 DOM은 갱신하지 않거나 정지
  - `document.visibilityState`가 hidden이면 전체 정지(탭 전환이나 백그라운드 시)
- 캐릭터를 탭하면 걷기를 멈추고 살짝 튀는 애니메이션 → `characterTap` 전송. 챗봇 UI는 RN이 띄운다.
  - 탭과 튀는 모션(Web Animations API, `transform`만)은 구현됨. 걷기 멈춤은 돌아다니기와 함께 한다.

### 6.4 말풍선

- `showBubble`을 받으면 캐릭터 머리 위에 표시하고, `durationMs`(기본 4초) 후 사라진다.
- 긴 텍스트는 2줄에서 말줄임한다. 전체 대화는 RN 챗봇 화면의 몫이다.
- 한 캐릭터에 새 말풍선이 오면 이전 것을 교체한다.
- 구현 메모
  - 타이머는 마커가 아니라 `useBubbles`에 둔다. 줌아웃으로 캐릭터가 숨어 있어도 시간이 되면 사라진다.
  - 말풍선이 뜬 캐릭터는 다른 캐릭터보다 앞에 그린다(`zIndex`를 올린다).
  - 화면에 없는 캐릭터 id의 말풍선은 그리지 않고, 시간이 되면 지운다. `init`/`setNeighborhood`를 받으면 모두 지운다.
  - 카카오 오버레이 컨테이너가 `white-space: nowrap`을 걸어 두므로 말풍선에서 `normal`로 되돌린다.
  - 모양은 디자인이 없어 흰 둥근 상자 + 꼬리로 임시 구현했다(11장 #9).

### 6.5 스티커 꾸미기 (마일스톤 M6, 추후)

- `setStickers`: 스티커를 `CustomOverlayMap`으로 표시한다. 이미지 해석은 5장의 파츠 규칙을 재사용한다(기본 스티커는 번들, 추가 스티커는 URL).
- `setEditMode(true)`: `map.setDraggable(false)`로 지도 드래그를 끄고(안 끄면 스티커를 끌 때 지도가 같이 움직인다) 캐릭터를 숨기거나 흐리게 한다. 스티커 선택·이동·회전·크기 조절 핸들을 표시한다.
- 스티커를 끌 때는 화면 좌표 → 위경도 변환(`map.getProjection().coordsFromContainerPoint`)을 쓴다.
- 변경이 끝날 때마다(드래그 종료 등) `stickersChanged`를 보낸다. **저장은 RN이** 서버에 한다.
- 스티커 목록(인벤토리) UI와 "저장/취소" 버튼은 RN이 담당한다.

---

## 7. 웹 공통 요구사항

- **viewport**: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- **터치 UX**: 텍스트 선택, 롱프레스 메뉴, 탭 하이라이트를 끈다(`user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`). 이미지 드래그를 막는다(`draggable={false}`).
- **배경**: 지도 로드 전 배경을 앱 배경색(`#F8F9FB`)으로 둬서 흰 화면이 번쩍이지 않게 한다.
- **Safe area**: 웹은 전체 화면을 채우고, 상단 UI(동네 토글 등)는 RN이 WebView 위에 올린다. 웹 안에 고정 UI를 두지 않는다.
- **보안**: 웹은 토큰이나 개인정보를 받지 않는다. 메시지에는 표시용 이름과 공개 이미지 URL만 담는다. 외부 스크립트는 카카오 SDK만 쓴다.
- **다크 모드**: 앱이 라이트 모드 전용이므로 웹도 라이트 모드로 고정한다.
- **브라우저 단독 실행**: 앱 없이 열리면(`window.ReactNativeWebView`가 없으면) 목 데이터로 `init`을 스스로 호출한다. 개발용이며 운영에서도 해가 없다.

---

## 8. 웹 레포 구조 제안

```
tikitaka-map/
├ public/
│  ├ parts/                 # 기본 파츠 (앱 assets/character와 같은 구조)
│  └ fonts/
├ src/
│  ├ main.tsx
│  ├ App.tsx                # 브리지 초기화 + MapScreen
│  ├ bridge/
│  │  ├ bridge.ts           # 메시지 타입 (앱과 동일 내용 유지)
│  │  ├ schema.ts           # 수신 메시지 zod 스키마 (bridge.ts 타입과 일치 검사)
│  │  ├ transport.ts        # receive 등록, postMessage 래퍼
│  │  └ mock.ts             # 브라우저 단독 실행용 목 init
│  ├ map/
│  │  ├ MapScreen.tsx
│  │  ├ useNeighborhoodCenter.ts   # geocoder + 캐시
│  │  ├ CharacterMarker.tsx # 캐릭터 + 이름표 오버레이
│  │  ├ placement.ts        # 첫 배치 (최소 간격)
│  │  └ bounds.ts           # 캐릭터 이동 허용 영역 (반경 → 경계 폴리곤)
│  ├ character/
│  │  ├ layers.ts           # LAYERS, 기하 상수 (앱과 동일)
│  │  ├ resolvePart.ts      # 5장 해석 규칙
│  │  ├ imageCache.ts
│  │  ├ CharacterSprite.tsx
│  │  ├ RoamingCharacter.tsx
│  │  └ useRoaming.ts       # 이동 상태 머신
│  ├ bubble/               # SpeechBubble.tsx, useBubbles.ts (캐릭터별 말풍선 + 타이머)
│  ├ sticker/               # M6
│  ├ parts/manifest.ts      # 번들된 파츠 경로 목록 (스크립트로 생성)
│  └ styles/tokens.css      # 앱 colors.js 값
└ .env.example              # VITE_KAKAO_JS_KEY=
```

- `manifest.ts`는 `public/parts`를 읽어 만드는 스크립트(`pnpm gen:manifest`, `scripts/gen-manifest.mjs`)로 생성해 수동 누락을 막는다. `pnpm build`가 `--check`로 최신인지 확인한다.
- 앱과 복사해서 맞춰야 하는 파일은 `bridge.ts`, `layers.ts`, `public/parts/`, `tokens.css`다. 파일 상단에 "앱 레포와 동기화 필요"를 명시한다.

---

## 9. 개발 · 테스트 방법

- **로컬**: `pnpm dev` → `http://localhost:5173`. 목 브리지로 바로 동작한다. 모바일 화면 크기로 확인한다.
- **앱 연동**: 앱의 WebView URL을 환경변수로 받아 `http://<내 PC IP>:5173`(개발) 또는 Vercel 고정 도메인을 넣는다.
  - 개발 PC IP를 카카오 콘솔에 등록하거나, 등록된 도메인으로 테스트한다.
  - iOS에서 HTTP 개발 서버를 WebView로 열려면 ATS 예외가 필요할 수 있다. 앱 쪽 설정을 확인한다.
- **디버깅**
  - Android: WebView 디버깅을 켜고 `chrome://inspect`
  - iOS: `webviewDebuggingEnabled` prop을 켜고 Mac Safari → 개발 메뉴
  - 웹 → RN `log` 메시지를 RN 콘솔에 찍어 두면 편하다.
- **실기기 필수 점검**
  - 안드로이드 저사양 기기에서 캐릭터 15명이 돌아다닐 때 프레임
  - 핀치 줌 중 오버레이 흔들림
  - 앱 백그라운드 복귀 시 상태 유지 / 재로드 시 `ready` → `init` 재수행

---

## 10. 마일스톤

| 단계                    | 내용                                                                                          | 완료 기준                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **M0** 검증             | Vite 프로젝트, Vercel 배포, 카카오 도메인 등록, 앱 WebView에서 지도 표시, `ready`↔`init` 왕복 | iOS·Android 실기기에서 지도가 뜨고 RN 로그에 `ready`가 찍힌다            |
| **M1** 브리지           | 4장 메시지 전체, 검증, 목 브리지, 에러 전달                                                   | 잘못된 메시지를 무시하고, SDK 실패 시 RN에 `mapError`가 온다             |
| **M2** 캐릭터 1명       | 렌더러(기본 파츠만), 동네 중심 geocoding                                                      | 앱 `Character`와 같은 config가 같은 모습으로 보인다(스크린샷 비교)       |
| **M3** 돌아다니기 + 탭  | 이동 상태 머신, 성능 규칙, `characterTap`, 말풍선                                             | 15명이 저사양 안드로이드에서 끊김 없이 움직이고, 탭하면 RN 챗봇이 열린다 |
| **M4** 서버 파츠        | `partUrls` 해석, 프리로드, 폴백                                                               | 서버 파츠를 입은 캐릭터가 보이고, URL 실패 시 기본 파츠로 대체된다       |
| **M5** 동네 경계 · 전환 | GeoJSON 경계, 캐릭터 이동 영역을 경계 기준으로, `setNeighborhood`                             | 메인/서브/상대 동네를 전환할 수 있고, 캐릭터가 경계 밖으로 나가지 않는다 |
| **M6** 스티커           | 표시, 편집 모드, `stickersChanged`                                                            | 배치한 스티커가 저장 후 다시 열어도 같은 위치에 있다                     |

---

## 11. 미결 사항 · 외부 의존

| #   | 항목                                                                                            | 담당          | 막히는 단계 |
| --- | ----------------------------------------------------------------------------------------------- | ------------- | ----------- |
| 1   | ~~지도 웹 도메인 확정~~ → `https://tiki-taka-webview.vercel.app` (2026-09-25)                   | 프론트        | M0          |
| 2   | 서버 파츠 **HTTPS 공개 URL** 제공 방식 (S3+CloudFront 등, presigned 금지)                       | 백엔드        | M4          |
| 3   | 서버 파츠 카탈로그 API (id, 그룹, 색상, URL) 스키마                                             | 백엔드        | M4          |
| 4   | 기본(번들) 파츠 목록 확정                                                                       | 기획·디자인   | M2          |
| 5   | 지도에 돌아다닐 캐릭터가 누구인가: NPC / 실제 주민. 주민이면 **다른 유저 착용 정보 API**가 필요 | 기획·백엔드   | M3          |
| 6   | 챗봇 API (대화, 말풍선 한마디 제공 여부)                                                        | 백엔드        | M3 (RN)     |
| 7   | 동네 중심 좌표 / 경계 데이터 출처(서버 필드 or GeoJSON 번들)                                    | 백엔드·프론트 | M5          |
| 8   | 스티커 상품 타입(`product_type`), 배치 저장 API                                                 | 백엔드        | M6          |
| 9   | 지도 화면 디자인: 줌 범위, 캐릭터 크기, 이름표, 말풍선                                          | 디자인        | M2~M3       |
| 10  | ~~폰트 웹 사용 라이선스(OkDanDan)~~ → 웹 사용 허용, 파일 수정 금지. 원본 TTF 사용 (2026-09-25)  | 프론트        | M2          |
| 11  | Vercel 요금제 (Hobby는 비상업용 조건)                                                           | 팀            | 출시 전     |

---

## 12. 참고: 앱 레포에서 함께 할 작업

웹 담당이 알고 있어야 하는 앱 쪽 작업이다(이 레포의 작업 아님).

1. `pnpm expo install react-native-webview`
2. 탭 교체: `(tabs)/_layout.tsx`에서 피드 대신 `map`, `AppBar`의 `TAB_CONFIG` 수정(피드는 `TAB_CONFIG`에서만 빼면 경로는 유지)
3. 라우트: `src/app/(tabs)/map/_layout.tsx`, `index.tsx`(WebView), `chat/[id].tsx`(챗봇), 추후 `decorate.tsx`
4. `src/components/map/`, `src/hooks/map/`, `src/api/map.ts`: AGENTS.md 10장 규약(api → 훅 → 화면)
5. 브리지 훅(`useMapBridge`): `ready` 대기, `init` 전송, 재로드 시 재전송, 메시지 검증
6. 로딩은 `Skeleton`, 실패는 `ErrorRetry`(WebView reload)
7. 하이브리드 파츠: 앱 `Character`도 서버 파츠 URL을 그릴 수 있게 확장하고, AGENTS.md 7장을 갱신
8. 바텀바 숨김 로직 일반화(꾸미기 모드용)
9. 다른 화면에서 지도로 들어오는 링크: 홈 대결 카드 → 대결 동네, 랭킹 동네 행 → 해당 동네, 상점 스티커 구매 → "지도에 붙이기"
