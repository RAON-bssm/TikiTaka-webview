// 앱 레포(TikiTaka-app)와 동기화 필요: 앱의 지도 브리지 메시지 타입 파일
// 규약 원본: docs/map-web-plan.md 4장. 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.

export const BRIDGE_VERSION = 1;

export type LatLng = { lat: number; lng: number };

export interface CharacterConfig {
  body: string;
  eyes: string;
  eyesColor: string;
  mouth: string;
  hairBack: string;
  hairFront: string;
  /** 앞/뒤 머리 공유 */
  hairColor: string;
  clothing?: string;
  accessory?: string;
}

/** 파츠 경로 키 → HTTPS URL. 예: 'hair-back/bob/pink' */
export type PartUrlMap = Record<string, string>;

export interface MapCharacter {
  /** 탭 이벤트로 되돌려줄 식별자 (NPC id 또는 user_id) */
  id: string;
  /** 말풍선·이름표 표시용 */
  name: string;
  config: CharacterConfig;
  kind: 'npc' | 'user';
}

export interface Neighborhood {
  locationId: number;
  /** '부산광역시' */
  cityName: string;
  /** '북구' */
  name: string;
  /** 서버가 주면 사용, 없으면 웹이 geocoder로 계산 */
  center?: LatLng;
}

export interface PlacedSticker {
  /** 배치 인스턴스 id (웹이 생성: crypto.randomUUID) */
  id: string;
  /** 스티커 종류 id */
  stickerId: string;
  position: LatLng;
  /** deg */
  rotation: number;
  /** 1 = 기본 크기 */
  scale: number;
}

/**
 * 땅따먹기 땅 하나. 팀 개념은 앱이 계산해 `tone`으로만 넘긴다.
 * - mine: 내 땅, team: 우리 팀(본진 구) 땅, rival: 다른 팀 땅, neutral: 주인 없는 땅
 * 경계는 웹이 `dongCode`(행정동 코드 adm_cd2)로 번들 GeoJSON에서 찾는다.
 */
export interface MapTerritory {
  dongCode: number;
  tone: 'mine' | 'team' | 'rival' | 'neutral';
  /** 차단한 유저의 땅 */
  blocked?: boolean;
}

/** RN → 웹 */
export type ToWeb =
  | {
      v: 1;
      type: 'init';
      neighborhood: Neighborhood;
      characters: MapCharacter[];
      partUrls: PartUrlMap;
    }
  | { v: 1; type: 'setNeighborhood'; neighborhood: Neighborhood; characters: MapCharacter[] }
  | { v: 1; type: 'upsertCharacters'; characters: MapCharacter[]; partUrls?: PartUrlMap }
  /** persistent: true면 durationMs를 무시하고 hideBubble이나 다음 말풍선이 올 때까지 남긴다 */
  | {
      v: 1;
      type: 'showBubble';
      characterId: string;
      text: string;
      durationMs?: number;
      persistent?: boolean;
    }
  /** 답을 기다리는 동안 '…' 말풍선. showBubble이 오면 교체되고, hideBubble로 지운다 */
  | { v: 1; type: 'showTyping'; characterId: string }
  | { v: 1; type: 'hideBubble'; characterId: string }
  /**
   * 대화 시작. 이 캐릭터로 확대하고 clearFocus가 올 때까지 멈춘다.
   * bottomInsetPx: WebView 아래 끝에서 RN 패널이 가리는 높이(CSS px)
   */
  | { v: 1; type: 'focusCharacter'; characterId: string; bottomInsetPx?: number }
  /** 대화 종료. 멈춤을 풀어 다시 돌아다니게 한다 */
  | { v: 1; type: 'clearFocus' }
  // (추후) 스티커
  | { v: 1; type: 'setStickers'; stickers: PlacedSticker[]; stickerUrls: Record<string, string> }
  | { v: 1; type: 'setEditMode'; enabled: boolean }
  /** 땅따먹기 땅 전체를 바꿔 칠한다. 빈 배열이면 지운다. */
  | { v: 1; type: 'setTerritories'; territories: MapTerritory[] }
  /**
   * 고른 동을 강조하고 RN 시트에 가리지 않는 곳으로 옮긴다. dongCode가 없으면 강조를 푼다.
   * bottomInsetPx: WebView 아래 끝에서 RN 시트가 가리는 높이(CSS px)
   */
  | { v: 1; type: 'selectDong'; dongCode?: number; bottomInsetPx?: number };

export type MapErrorCode = 'SDK_LOAD_FAILED' | 'GEOCODE_FAILED' | 'UNKNOWN';

/** 웹 → RN */
export type ToRN =
  /** SDK 로드 + 수신 함수 등록 완료 */
  | { v: 1; type: 'ready' }
  /** 첫 화면 렌더 완료 (RN 로딩 UI 해제) */
  | { v: 1; type: 'mapLoaded' }
  | { v: 1; type: 'characterTap'; characterId: string }
  /** 캐릭터가 아닌 빈 지도를 탭함(드래그·핀치 제외) */
  | { v: 1; type: 'mapTap' }
  /** 사용자가 드래그·핀치로 지도를 움직이기 시작함. focusCharacter 확대처럼 웹이 스스로 움직일 때는 보내지 않는다 */
  | { v: 1; type: 'mapMoveStart' }
  | { v: 1; type: 'mapError'; code: MapErrorCode; message?: string }
  /** 땅따먹기 동을 탭함. 캐릭터 위를 탭하면 characterTap이 먼저다. 동을 탭하면 mapTap은 보내지 않는다. */
  | { v: 1; type: 'dongTap'; dongCode: number }
  /** 개발용 */
  | { v: 1; type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  // (추후) 스티커
  | { v: 1; type: 'stickersChanged'; stickers: PlacedSticker[] };
