# TikiTaka-webview 에이전트 가이드라인 (Agent Guidelines)

당신은 `TikiTaka-webview` 개발을 돕는 AI 어시스턴트(에이전트)입니다. 이 레포는 TikiTaka 앱(`TikiTaka-app`, Expo)의 **지도 탭 WebView 안에 뜨는 카카오맵 웹 페이지**입니다. 이 작업 공간에서 코드를 작성하거나 명령어를 실행할 때 다음 가이드라인을 지켜 주세요.

> 전체 설계·브리지 규약·마일스톤은 **`docs/map-web-plan.md`** 에 있습니다. 작업 전에 해당 장을 먼저 읽으세요. 이 문서와 계획 문서가 충돌하면 계획 문서를 기준으로 하고, 이 문서를 함께 고칩니다.

---

## 1. 서비스 & 역할 원칙 (Service & Responsibility)

- **서비스 컨셉:** 동네 경쟁 앱 서비스. 이 웹은 그 안의 "동네 지도" 화면입니다.
- **웹은 지도와 지도 위에서 움직이는 것만 그립니다.** 지도, 캐릭터, 말풍선, (추후) 스티커가 전부입니다.
- **데이터와 나머지 UI는 앱(RN)이 담당합니다.** 인증, API 호출, 챗봇 화면, 바텀시트, 동네 토글, 꾸미기 도구, 저장/취소 버튼은 웹에 만들지 마세요.
- **웹은 백엔드 API를 직접 호출하지 않습니다.** 필요한 데이터는 모두 브리지 메시지(`init` 등)로 받습니다. 토큰·개인정보도 받지 않습니다.
- **웹 안에 고정 UI(헤더, 버튼, 토스트 등)를 두지 않습니다.** 웹은 전체 화면을 지도로 채우고, 상단 UI와 Safe area는 RN이 WebView 위에 올려 처리합니다.
- **크로스 플랫폼 일치성:** iOS(WKWebView)와 Android(Chromium WebView)에서 같은 모습과 동작이어야 합니다. 한쪽 WebView에서만 되는 API나 CSS는 피하세요.
- **라이트 모드 고정.** 앱이 라이트 모드 전용이므로 다크 모드 스타일을 만들지 않습니다.

---

## 2. 개발 환경 및 기술 스택 (Environment & Tech Stack)

- **빌드/런타임:** Vite + React + TypeScript (SPA, SSR 없음)
- **지도:** 카카오맵 JavaScript API + [`react-kakao-maps-sdk`](https://github.com/JaeSeoKim/react-kakao-maps-sdk)
- **메시지 검증:** `zod`
- **린트:** oxlint (`.oxlintrc.json`)
- **패키지 매니저:** **pnpm** (절대 `npm`, `yarn`, `bun`을 사용하지 마세요)
- **배포:** Vercel (고정 도메인). `main`에 push하면 배포됩니다.

### 핵심 패키지 버전 (package.json 기준)

> 패키지를 추가·업그레이드한 경우 아래 표도 함께 갱신해 주세요. 전체 목록은 `package.json` 참고.

| 패키지                 | 버전       | 비고                        |
| ---------------------- | ---------- | --------------------------- |
| `vite`                 | `^8.3.0`   |                             |
| `@vitejs/plugin-react` | `^6.1.1`   |                             |
| `react`                | `^19.2.8`  |                             |
| `react-dom`            | `^19.2.8`  |                             |
| `typescript`           | `~6.0.2`   |                             |
| `oxlint`               | `^1.81.0`  |                             |
| `react-kakao-maps-sdk` | (설치 예정) | M0에서 추가                 |
| `zod`                  | (설치 예정) | M1에서 추가, 브리지 검증용 |

### 명령어

```bash
pnpm dev      # http://localhost:5173 (앱 없이 열면 목 브리지로 동작)
pnpm build    # tsc -b && vite build
pnpm lint     # oxlint
pnpm preview  # 빌드 결과 확인
```

- 작업을 마치면 `pnpm build`와 `pnpm lint`가 통과하는지 확인하세요.

---

## 3. 패키지 및 의존성 규칙 (Package & Dependency Rules)

- **`npm install`, `yarn add` 등 pnpm이 아닌 명령어를 실행하지 마세요.** 항상 `pnpm add <패키지>` / `pnpm add -D <패키지>`를 사용합니다.
- **외부 스크립트는 카카오 SDK만 사용합니다.** CDN 스크립트, 분석 도구, 외부 폰트 CDN 등을 추가하지 마세요. 폰트는 `public/fonts/`에 직접 둡니다.
- 번들 크기가 WebView 첫 로딩 시간에 직결됩니다. 큰 라이브러리(애니메이션, 상태 관리, UI 키트 등)를 추가하기 전에 꼭 필요한지 먼저 확인하세요.

---

## 4. 디렉토리 구조 (Directory Structure)

기능(도메인) 단위로 폴더를 나눕니다. 자세한 설명은 계획 문서 8장을 참고하세요.

```
public/
├ parts/                 # 기본 캐릭터 파츠 (앱 assets/character와 같은 구조)
└ fonts/                 # Pretendard, OkDanDan-Bold 웹폰트
src/
├ main.tsx
├ App.tsx                # 브리지 초기화 + MapScreen
├ bridge/                # bridge.ts(메시지 타입), transport.ts(수신/전송/검증), mock.ts(단독 실행용)
├ map/                   # MapScreen, 동네 중심 좌표(geocoder+캐시), 이동 범위 제한
├ character/             # layers.ts, resolvePart.ts, imageCache.ts, CharacterSprite, RoamingCharacter, useRoaming
├ bubble/                # 말풍선
├ sticker/               # (M6) 스티커 레이어·편집 모드
├ parts/manifest.ts      # 번들 파츠 경로 목록 (자동 생성)
└ styles/tokens.css      # 디자인 토큰 (앱 colors.js 값)
docs/map-web-plan.md     # 구현 계획 (설계 기준 문서)
```

- 여러 기능에서 쓰는 순수 유틸은 `src/utils/`, 공용 훅은 `src/hooks/`에 둡니다.
- 한 파일에만 쓰이는 작은 헬퍼는 그 파일 안에 둡니다.

---

## 5. 코딩 및 스타일 가이드라인 (Coding & Styling Style)

- 함수형 컴포넌트, 훅, 명확한 TypeScript 타입/인터페이스를 사용하세요. `any`를 쓰지 마세요. 외부에서 들어오는 값(브리지 메시지, `localStorage`)은 `unknown`으로 받고 검증 후 사용합니다.
- **컴포넌트 선언은 `export default function Name() {}` 형태로 통일합니다.** (앱과 동일)
  - **예외:** `memo`, `forwardRef` 등으로 감싸야 하는 경우에만 `const Name = memo(...)` + 별도 export를 사용합니다. 파일 내부 전용 작은 헬퍼 컴포넌트는 `const` 화살표 함수도 허용합니다.
- **포맷은 앱 레포 Prettier 설정과 같게 맞춥니다:** 작은따옴표, 세미콜론, trailing comma `all`, 들여쓰기 2칸, `printWidth` 100, 화살표 함수 인자 괄호 항상.
- **스타일은 CSS 파일 + CSS 변수 토큰**(`src/styles/tokens.css`)으로 작성합니다. 색상·간격·반경에 임의값을 직접 쓰지 말고 토큰(`var(--color-primary-600)` 등)을 사용하세요. 새 값이 필요하면 토큰을 먼저 추가합니다.
  - 캐릭터 좌표처럼 매 프레임 바뀌는 값은 인라인 스타일/`transform`을 써도 됩니다.
- **React Compiler는 켜져 있지 않습니다.** 앱과 달리, 참조 동일성이 필요한 곳(지도 이벤트 핸들러, 오버레이 props 등)에는 `useMemo`/`useCallback`을 명시적으로 사용하세요. 단, 습관적으로 남발하지는 마세요.
- 코드 내 기존 주석이나 문서(Docstring)는 훼손하지 않고 보존합니다.
- **앱 레포와 동기화해야 하는 파일**(7장)은 파일 상단에 `// 앱 레포(TikiTaka-app)와 동기화 필요: <앱 쪽 경로>` 주석을 둡니다.

---

## 6. 브리지 규약 (RN ↔ 웹)

메시지 정의와 수명 주기는 계획 문서 **4장**이 기준입니다. 코드를 짤 때 다음을 지키세요.

- **웹 → RN:** `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`. 직접 호출하지 말고 `src/bridge/transport.ts`의 전송 함수를 사용합니다.
- **RN → 웹:** RN이 `window.__tikitaka.receive(msg)`를 호출합니다. 이 전역 함수는 `transport.ts`에서만 등록합니다. (`window.addEventListener('message')` 방식은 쓰지 않습니다. iOS/Android에서 이벤트 대상이 다르기 때문입니다.)
- 모든 메시지는 `{ v: 1, type: string, ... }` 형태입니다.
  - **모르는 `type`은 조용히 무시합니다.** 앱과 웹의 배포 시점이 다르기 때문입니다. 에러를 던지지 마세요.
  - 받은 메시지는 **`zod`로 런타임 검증**하고, 형식이 잘못되면 무시한 뒤 `log`(level `warn`) 메시지로 RN에 알립니다.
  - 규약에 호환되지 않는 변경이 생기면 `v`를 올립니다.
- **수명 주기:** SDK 로드 → `receive` 등록 → `ready` 전송 → `init` 수신 → 지도·캐릭터 렌더 → `mapLoaded` 전송. 실패하면 `mapError`(`SDK_LOAD_FAILED` / `GEOCODE_FAILED` / `UNKNOWN`)를 보냅니다.
  - WebView가 재로드되면 이 과정 전체가 다시 실행됩니다. 전역 상태가 한 번만 초기화된다고 가정하지 마세요.
- **메시지 타입 파일(`src/bridge/bridge.ts`)은 앱과 같은 내용을 유지합니다.** 메시지를 추가·변경하면 앱 레포의 같은 파일과 계획 문서 4.2절도 함께 고치고, 변경 사실을 사용자에게 알려 주세요.
- **브라우저 단독 실행:** `window.ReactNativeWebView`가 없으면 `src/bridge/mock.ts`의 목 데이터로 `init`을 스스로 호출합니다. 전송 함수는 이때 `console`에 출력합니다.

---

## 7. 캐릭터 렌더링 (Character Rendering)

캐릭터는 이미지가 아니라 `CharacterConfig`(파츠 id의 JSON)로 전달되며, 웹이 파츠 이미지를 겹쳐 합성합니다. **앱의 `Character` 컴포넌트와 같은 모습·크기·위치로 보여야 합니다.** 규칙의 원본은 앱 레포 `AGENTS.md` 7장과 계획 문서 2.4절·5장입니다.

### 7.1 그리는 순서 (아래 → 위)

`src/character/layers.ts`의 `LAYERS` 배열 하나로 관리하며, 앱 `src/constants/character/types.ts`와 같아야 합니다.

1. 뒷머리 `hair-back/<hairBack>/<hairColor>`
2. 몸 `body/<body>`
3. 코스튬 `clothing/<clothing>` (옵셔널)
4. 눈 `eyes/<eyes>/<eyesColor>`
5. 입 `mouth/<mouth>`
6. 앞머리 `hair-front/<hairFront>/<hairColor>`
7. 악세서리 `accessory/<accessory>` (옵셔널)
8. 머리 하이라이트 `hair-highlights/<eyesColor>` — **눈 색**을 따릅니다(머리 색 아님)

- 폴더명은 config 키의 kebab-case(`hairBack` → `hair-back`), id = 파일명(확장자 제외)입니다.
- 값이 없거나 이미지를 찾지 못한 레이어는 **건너뜁니다**(에러 아님).

### 7.2 기하 규칙

- 모든 파츠는 **1440×1440 투명 WebP**이며 정위치에 그려져 있습니다. 같은 크기로 겹치기만 하면 정렬됩니다.
- 정사각형 컨테이너 안에 레이어 박스를 `position: absolute; top/left: -20.3125%; width/height: 140.625%`로 두고, 각 `<img>`는 박스를 꽉 채웁니다(`object-fit: contain`). 헤어가 넘칠 수 있으므로 `overflow`는 보이게 둡니다.
- 이 상수(`OVERSCALE = 1440 / 1024`)를 임의로 바꾸지 마세요. 앱과 크기가 달라집니다.

### 7.3 파츠 해석 (하이브리드)

`src/character/resolvePart.ts`에서 레이어마다 경로 키(`'hair-back/bob/pink'` 형태)를 만들고 다음 순서로 이미지를 찾습니다.

1. `src/parts/manifest.ts`에 키가 있으면 → `/parts/<key>.webp` (번들)
2. RN이 넘긴 `partUrls[key]`가 있으면 → 그 URL
3. 둘 다 없으면 → 기본 config(`DEFAULT_CHARACTER_CONFIG`)의 같은 슬롯 값으로 다시 1)부터
4. 그래도 없으면 → 레이어 건너뜀

- 이미지 로드 실패(`onerror`)도 3)과 같이 폴백하고, 실패한 URL은 세션 동안 다시 요청하지 않습니다.
- 옵셔널 슬롯(`clothing`, `accessory`)이 config에 **없으면** 폴백하지 않고 건너뜁니다.
- **서버 파츠 URL은 HTTPS 공개 URL만 받습니다.** HTTP URL은 혼합 콘텐츠로 차단되고, presigned URL은 만료되어 깨집니다.

### 7.4 기본 파츠 추가 방법

1. 앱 `assets/character/`와 같은 경로 규칙으로 `public/parts/`에 WebP를 넣습니다. (앱 번들 목록과 같게 유지)
2. `pnpm gen:manifest`로 `src/parts/manifest.ts`를 재생성하고 함께 커밋합니다. **manifest를 손으로 고치지 마세요.**

### 7.5 앱 레포와 동기화해야 하는 것

| 웹                        | 앱 (`TikiTaka-app`)                                                 |
| ------------------------- | ------------------------------------------------------------------- |
| `src/bridge/bridge.ts`    | 앱의 브리지 메시지 타입 파일                                        |
| `src/character/layers.ts` | `src/constants/character/types.ts`의 `LAYERS`, 기본 config          |
| `public/parts/`           | `assets/character/`                                                 |
| `src/styles/tokens.css`   | `src/constants/colors.js`, `tailwind.config.js`의 간격·반경·폰트 크기 |

한쪽을 바꾸면 다른 쪽도 바꿔야 합니다. 앱 레포 파일은 이 레포에서 수정하지 말고, 바뀐 내용을 사용자에게 알려 주세요.

---

## 8. 디자인 토큰 (Design Tokens)

앱과 같은 값을 `src/styles/tokens.css`에 CSS 변수로 정의해 사용합니다.

- **색상:** `primary-600` `#FC8253`(주황, 브랜드), `secondary-500` `#4078FF`(파랑), `gray-50` `#F8F9FB` ~ `gray-800` `#1A202C`, 흰색 `#FFFFFF`. 각 팔레트의 전체 스케일은 앱 `src/constants/colors.js` 기준입니다.
- **간격:** `xs` 4 / `sm` 8 / `md` 12 / `lg` 16 / `xl` 20 / `2xl` 24 / `3xl` 40 / `4xl` 48 (px)
- **반경:** `xs` 4 / `sm` 8 / `md` 12 / `lg` 16 / `xl` 24 / `full` 9999 (px)
- **폰트:** Pretendard(Regular/Medium/Bold, 본문), OkDanDan-Bold(캐릭터 이름표·강조). 웹폰트로 변환해 `public/fonts/`에 둡니다.
- 지도 로드 전 배경은 `gray-50`(`#F8F9FB`)입니다. 흰 화면이 번쩍이지 않게 `html`, `body`, `#root`에 지정합니다.

---

## 9. WebView · 카카오맵 주의사항 (WebView & Kakao Map)

- **viewport:** `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`. 페이지 확대 대신 지도 줌만 동작해야 합니다.
- **터치 UX:** `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`를 유지하고, 이미지에는 `draggable={false}`를 줍니다.
- **카카오 JS 키**는 `VITE_KAKAO_JS_KEY` 환경변수로 읽습니다. `.env`는 커밋하지 않고, 새 환경변수를 추가하면 `.env.example`도 갱신합니다.
- 카카오 콘솔에 등록된 도메인에서만 지도가 뜹니다. **Vercel 프리뷰 배포에서 지도가 안 뜨는 것은 정상입니다.**
- **지도 자체의 색·스타일은 바꿀 수 없습니다.** 앱 느낌은 오버레이로만 냅니다. **카카오 로고와 저작권 표기를 가리지 마세요**(약관).
- 지도 위 요소는 `CustomOverlayMap`으로 올립니다. 캐릭터는 발 위치가 좌표에 오도록 `yAnchor: 1`로 둡니다.
- geocoder 결과는 `localStorage`에 캐시하되, `localStorage` 접근은 항상 `try/catch`로 감쌉니다(WebView에서 막혀 있을 수 있음).
- 동네는 동네명만으로 식별하지 마세요. `'북구'`처럼 같은 이름이 여러 시/도에 있습니다. `locationId` 또는 `시/도 + ' ' + 동네` 전체 이름을 씁니다.

### 9.1 성능 규칙

저사양 Android WebView에서도 끊기지 않아야 합니다.

- 캐릭터 위치 갱신은 `requestAnimationFrame` 안에서 **10~15fps 정도로만** 합니다. 걷는 흔들림은 CSS 애니메이션으로 냅니다.
- 동시 표시 캐릭터 상한(초기값 15)을 둡니다.
- 화면 밖 캐릭터는 DOM을 갱신하지 않습니다. `document.visibilityState`가 `hidden`이면 전체를 멈춥니다.
- 파츠 이미지는 URL 단위로 캐시해 여러 캐릭터가 같은 `Image`를 공유합니다.
- 애니메이션은 `transform`/`opacity`만 바꿉니다. `top`/`left`/`width` 등 레이아웃을 유발하는 속성을 매 프레임 바꾸지 마세요.

---

## 10. 작업 흐름 (Workflow)

- 마일스톤(M0~M6) 순서와 완료 기준은 계획 문서 **10장**을 따릅니다. 현재 마일스톤 범위를 벗어나는 기능은 미리 만들지 마세요.
- 계획 문서 **11장(미결 사항)** 에 걸린 부분(파츠 카탈로그 스키마, 경계 데이터 등)은 추측해서 구현하지 말고 사용자에게 확인합니다.
- 결정 사항이 바뀌거나 새로 확정되면 `docs/map-web-plan.md`와 이 문서를 함께 갱신합니다.
- 변경 후 `pnpm dev`로 브라우저(모바일 화면 크기)에서 목 브리지 동작을 확인합니다. 실기기에서만 확인 가능한 부분(WebView 동작, 프레임)은 확인하지 못했다고 명시합니다.
