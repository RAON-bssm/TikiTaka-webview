import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map } from 'react-kakao-maps-sdk';
import type { MapCharacter, Neighborhood } from '../bridge/bridge';
import { send } from '../bridge/transport';
import type { Bubble } from '../bubble/useBubbles';
import CharacterMarker from './CharacterMarker';
import { placeCharacters } from './placement';
import useNeighborhoodCenter from './useNeighborhoodCenter';

/** 초기 줌 레벨(숫자가 작을수록 확대). TODO: 디자인 확인 후 확정 (캐릭터 숨김 기준 레벨과 함께) */
const INITIAL_LEVEL = 6;

const MAP_STYLE = { width: '100%', height: '100%' };

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

interface MapScreenProps {
  neighborhood: Neighborhood;
  characters: MapCharacter[];
  /** 캐릭터 id → 말풍선 */
  bubbles: Record<string, Bubble>;
}

export default function MapScreen({ neighborhood, characters, bubbles }: MapScreenProps) {
  const centerState = useNeighborhoodCenter(neighborhood);
  const [level, setLevel] = useState(INITIAL_LEVEL);
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

  useEffect(() => {
    if (centerState.status === 'error') {
      send({ type: 'mapError', code: 'GEOCODE_FAILED', message: centerState.message });
    }
  }, [centerState]);

  /** 동네가 바뀌면 Map이 새로 만들어져 INITIAL_LEVEL로 돌아가므로, 만들어질 때도 레벨을 다시 읽는다 */
  const syncLevel = useCallback((map: kakao.maps.Map) => setLevel(map.getLevel()), []);

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
      onCreate={syncLevel}
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
          />
        ))}
    </Map>
  );
}
