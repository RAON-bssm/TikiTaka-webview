# TikiTaka-webview

TikiTaka 앱의 **지도 탭 WebView 안에 뜨는 카카오맵 웹**입니다. 지도와 그 위의 캐릭터·말풍선·스티커만 그리고, 데이터와 나머지 UI는 앱(`TikiTaka-app`)이 담당합니다.

- 설계·브리지 규약·마일스톤: [`docs/map-web-plan.md`](docs/map-web-plan.md)
- 코딩 규약: [`AGENTS.md`](AGENTS.md)

## 커밋 컨벤션

`태그:: 설명` 형식으로 작성합니다. 예: `feat:: 캐릭터 파츠 레이어 합성 추가`

| 태그 이름 | 설명                                                                      |
| --------- | ------------------------------------------------------------------------- |
| Feat      | 새로운 기능을 추가할 경우                                                 |
| Fix       | 버그를 고친 경우                                                          |
| Style     | 코드 포맷 변경, 세미 콜론 누락, 코드 수정이 없는 경우                     |
| Design    | UI/UX 디자인 변경                                                         |
| Refactor  | 프로덕션 코드 리팩토링                                                    |
| Docs      | 문서를 수정한 경우                                                        |
| Chore     | 빌드 태스트 업데이트, 패키지 매니저를 설정하는 경우(프로덕션 코드 변경 X) |

---

## 시작하기 (Getting Started)

### 1. 패키지 설치

Husky 설정이 포함되어 있어 설치 후 자동으로 git hook(커밋 전 oxlint·Prettier)이 활성화됩니다.

```bash
pnpm install
```

### 2. 환경변수

```bash
cp .env.example .env
```

`.env`의 `VITE_KAKAO_JS_KEY`에 카카오 **JavaScript 키**를 넣습니다. (아래 카카오 설정 참고)

### 3. 개발 서버 실행

```bash
pnpm dev   # http://localhost:5173
```

앱 없이 브라우저로 열면 목 데이터(`src/bridge/mock.ts`)로 동작합니다. 브라우저 개발자 도구를 모바일 화면 크기로 두고 확인하세요. 웹 → 앱 메시지는 콘솔에 `[bridge → RN]`으로 찍힙니다.

---

## 카카오맵 설정 (Kakao Map)

[Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → tikitaka 앱에서 설정합니다.

1. **JavaScript 키**를 사용합니다. 로그인에 쓰는 네이티브 앱 키, REST API 키와 다른 키입니다. (셋 다 32자라 헷갈리기 쉽습니다)
2. 그 JavaScript 키의 **JavaScript SDK 도메인**에 지도를 띄울 주소를 등록합니다.
   - `http://localhost:5173` (로컬 개발, 포트까지 정확히)
   - Vercel 고정 도메인 `https://tiki-taka-webview.vercel.app`
3. **제품 설정 → 카카오맵 → 사용 설정**을 켭니다.

### 자주 만나는 에러

`pnpm dev` 화면이 비어 있고 콘솔에 `mapError SDK_LOAD_FAILED`가 찍히면, SDK 응답을 직접 확인합니다.

| 응답                                               | 원인 · 해결                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `AccessDeniedError: domain mismatched! caller=...` | 지금 연 주소(포트 포함)가 JavaScript SDK 도메인에 없음. 포트가 5174 등으로 바뀌었는지도 확인 |
| `NotAuthorizedError: disabled OPEN_MAP_AND_LOCAL`  | 카카오맵 사용 설정이 꺼져 있음                                                               |

> **Vercel 프리뷰 배포 URL은 매번 바뀌어 등록할 수 없습니다.** 프리뷰에서 지도가 안 뜨는 것은 정상이며, 확인은 고정 도메인으로 합니다.

---

## 주요 명령어 (Scripts)

- `pnpm dev`: 로컬 개발 서버 실행
- `pnpm build`: 타입 검사 + 프로덕션 빌드
- `pnpm preview`: 빌드 결과 확인
- `pnpm typecheck`: TypeScript 타입 검사
- `pnpm lint`: oxlint 검사
- `pnpm lint:fix`: oxlint 검사 및 자동 교정
- `pnpm format`: Prettier 코드 포맷팅
