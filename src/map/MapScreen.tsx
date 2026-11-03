import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map } from 'react-kakao-maps-sdk';
import type { MapCharacter, Neighborhood, PartUrlMap } from '../bridge/bridge';
import { log, send } from '../bridge/transport';
import type { Bubble } from '../bubble/useBubbles';
import CharacterMarker from './CharacterMarker';
import { placeCharacters } from './placement';
import useRoaming from './useRoaming';
import useNeighborhoodCenter from './useNeighborhoodCenter';

/** 초기 줌 레벨(숫자가 작을수록 확대). TODO: 디자인 확인 후 확정 (캐릭터 숨김 기준 레벨과 함께) */
const INITIAL_LEVEL = 6;

const MAP_STYLE = { width: '100%', height: '100%' };

/** 대화를 시작하면 이 레벨까지 확대한다. 이미 더 확대돼 있으면 그대로 둔다. TODO: 디자인 확인 후 확정 */
const FOCUS_LEVEL = 4;
const FOCUS_ZOOM_MS = 300;

/** 동시에 그리는 캐릭터 상한. RN이 보낸 순서대로 앞에서부터 그린다. TODO: 실기기 측정 후 조정 */
const MAX_VISIBLE_CHARACTERS = 15;

/**
 * 줌 레벨별 캐릭터 한 변(px). null이면 너무 멀어서 숨긴다.
 * TODO: 디자인 확인 후 확정 (계획 6.2, 11장 #9)
 */
function characterSizeAt(level: number): number | null {
  if (level <= 6) return 64;
  if (level <= 8) return 40;
  return null;
}

/** 대화 중인 캐릭터 (RN focusCharacter) */
export interface Focus {
  characterId: string;
  /** WebView 아래 끝에서 RN 패널이 가리는 높이(CSS px) */
  bottomInsetPx: number;
}

/** 지도를 움직여 position이 패널에 가려지지 않은 영역(위쪽)의 가운데에 오게 한다 */
function centerAbovePanel(map: kakao.maps.Map, position: kakao.maps.LatLng, bottomInsetPx: number) {
  const projection = map.getProjection();
  const node = map.getNode();
  const point = projection.containerPointFromCoords(position);
  const visibleHeight = Math.max(node.clientHeight - bottomInsetPx, 0);
  // 캐릭터가 (가로 가운데, 보이는 영역 세로 가운데)에 오도록 새 지도 중심을 잡는다
  const center = projection.coordsFromContainerPoint(
    new kakao.maps.Point(point.x, point.y + (node.clientHeight - visibleHeight) / 2),
  );
  map.panTo(center);
}

interface MapScreenProps {
  neighborhood: Neighborhood;
  characters: MapCharacter[];
  /** 캐릭터 id → 말풍선 */
  bubbles: Record<string, Bubble>;
  focus: Focus | null;
  /** 파츠 경로 키 → 서버 URL (번들에 없는 파츠용) */
  partUrls: PartUrlMap;
}

export default function MapScreen({
  neighborhood,
  characters,
  bubbles,
  focus,
  partUrls,
}: MapScreenProps) {
  const centerState = useNeighborhoodCenter(neighborhood);
  const [level, setLevel] = useState(INITIAL_LEVEL);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  /** mapLoaded는 동네마다 한 번만 보낸다 (타일은 이동할 때마다 다시 로드된다) */
  const loadedFor = useRef<number | null>(null);

  const center = centerState.status === 'success' ? centerState.center : null;
  const centerLat = center?.lat;
  const centerLng = center?.lng;

  /** 첫 배치 위치. 캐릭터 id로 정하므로 다시 그리거나 새로고침해도 같은 자리에 선다. */
  const placed = useMemo(() => {
    if (centerLat === undefined || centerLng === undefined) return [];
    const visible = characters.slice(0, MAX_VISIBLE_CHARACTERS);
    const positions = placeCharacters(
      { lat: centerLat, lng: centerLng },
      visible.map((character) => character.id),
    );
    return visible.map((character, index) => ({ character, position: positions[index] }));
  }, [characters, centerLat, centerLng]);

  const areaCenter = useMemo(
    () =>
      centerLat === undefined || centerLng === undefined
        ? null
        : { lat: centerLat, lng: centerLng },
    [centerLat, centerLng],
  );
  const placements = useMemo(
    () => placed.map(({ character, position }) => ({ id: character.id, position })),
    [placed],
  );
  const busyIds = useMemo(() => new Set(Object.keys(bubbles)), [bubbles]);
  const roaming = useRoaming(map, areaCenter, placements, busyIds, focus?.characterId ?? null);

  // 포커스가 올 때 한 번만 확대·이동한다. 그 뒤 사용자가 지도를 움직여도 다시 끌어오지 않는다
  useEffect(() => {
    if (!focus || !map || !roaming) return;
    const position = roaming.positionOf(focus.characterId);
    // 표시 상한 밖이거나 줌아웃으로 숨겨진 캐릭터는 옮기지 않는다 (멈춤은 엔진에 걸어 둔다)
    if (!position || characterSizeAt(map.getLevel()) === null) {
      log('info', `보이지 않는 캐릭터라 포커스 이동을 건너뜀: ${focus.characterId}`);
      return;
    }
    const latLng = new kakao.maps.LatLng(position.lat, position.lng);
    if (map.getLevel() <= FOCUS_LEVEL) {
      centerAbovePanel(map, latLng, focus.bottomInsetPx);
      return;
    }
    // 캐릭터를 화면에 고정한 채 확대하고, 확대가 끝나면 패널 위 가운데로 옮긴다
    const handleZoomed = () => {
      kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomed);
      centerAbovePanel(map, latLng, focus.bottomInsetPx);
    };
    kakao.maps.event.addListener(map, 'zoom_changed', handleZoomed);
    map.setLevel(FOCUS_LEVEL, { anchor: latLng, animate: { duration: FOCUS_ZOOM_MS } });
    return () => kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomed);
  }, [focus, map, roaming]);

  useEffect(() => {
    if (centerState.status === 'error') {
      send({ type: 'mapError', code: 'GEOCODE_FAILED', message: centerState.message });
    }
  }, [centerState]);

  /** 동네가 바뀌면 Map이 새로 만들어져 INITIAL_LEVEL로 돌아가므로, 만들어질 때도 레벨을 다시 읽는다 */
  const syncLevel = useCallback((created: kakao.maps.Map) => setLevel(created.getLevel()), []);
  const handleCreate = useCallback((created: kakao.maps.Map) => {
    setMap(created);
    setLevel(created.getLevel());
  }, []);

  if (!center) return null;

  const handleTileLoaded = () => {
    if (loadedFor.current === neighborhood.locationId) return;
    loadedFor.current = neighborhood.locationId;
    send({ type: 'mapLoaded' });
  };

  const size = characterSizeAt(level);

  return (
    <Map
      center={center}
      level={INITIAL_LEVEL}
      style={MAP_STYLE}
      onTileLoaded={handleTileLoaded}
      onCreate={handleCreate}
      onZoomChanged={syncLevel}
    >
      {size !== null &&
        placed.map(({ character, position }) => (
          <CharacterMarker
            key={character.id}
            character={character}
            position={position}
            size={size}
            bubble={bubbles[character.id]}
            partUrls={partUrls}
            roaming={roaming}
          />
        ))}
    </Map>
  );
}
