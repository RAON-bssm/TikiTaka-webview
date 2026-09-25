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
  | { v: 1; type: 'showBubble'; characterId: string; text: string; durationMs?: number }
  | { v: 1; type: 'focusCharacter'; characterId: string }
  // (추후) 스티커
  | { v: 1; type: 'setStickers'; stickers: PlacedSticker[]; stickerUrls: Record<string, string> }
  | { v: 1; type: 'setEditMode'; enabled: boolean };

export type MapErrorCode = 'SDK_LOAD_FAILED' | 'GEOCODE_FAILED' | 'UNKNOWN';

/** 웹 → RN */
export type ToRN =
  /** SDK 로드 + 수신 함수 등록 완료 */
  | { v: 1; type: 'ready' }
  /** 첫 화면 렌더 완료 (RN 로딩 UI 해제) */
  | { v: 1; type: 'mapLoaded' }
  | { v: 1; type: 'characterTap'; characterId: string }
  | { v: 1; type: 'mapError'; code: MapErrorCode; message?: string }
  /** 개발용 */
  | { v: 1; type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  // (추후) 스티커
  | { v: 1; type: 'stickersChanged'; stickers: PlacedSticker[] };
