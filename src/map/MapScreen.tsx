import { useEffect, useRef } from 'react';
import { CustomOverlayMap, Map } from 'react-kakao-maps-sdk';
import type { MapCharacter, Neighborhood } from '../bridge/bridge';
import { send } from '../bridge/transport';
import CharacterSprite from '../character/CharacterSprite';
import useNeighborhoodCenter from './useNeighborhoodCenter';

/** 초기 줌 레벨(숫자가 작을수록 확대). TODO: 디자인 확인 후 확정 (캐릭터 숨김 기준 레벨과 함께) */
const INITIAL_LEVEL = 6;

const MAP_STYLE = { width: '100%', height: '100%' };

/** 캐릭터 한 변(px). TODO: 줌 레벨별 크기는 디자인 확인 후 (계획 6.2) */
const CHARACTER_SIZE = 72;

/** 돌아다니기(M3) 전 임시 배치: 중심에서 캐릭터마다 경도로 조금씩 띄운다 */
const TEMP_SPACING_LNG = 0.004;

interface MapScreenProps {
  neighborhood: Neighborhood;
  characters: MapCharacter[];
}

export default function MapScreen({ neighborhood, characters }: MapScreenProps) {
  const centerState = useNeighborhoodCenter(neighborhood);
  /** mapLoaded는 동네마다 한 번만 보낸다 (타일은 이동할 때마다 다시 로드된다) */
  const loadedFor = useRef<number | null>(null);

  useEffect(() => {
    if (centerState.status === 'error') {
      send({ type: 'mapError', code: 'GEOCODE_FAILED', message: centerState.message });
    }
  }, [centerState]);

  if (centerState.status !== 'success') return null;

  const handleTileLoaded = () => {
    if (loadedFor.current === neighborhood.locationId) return;
    loadedFor.current = neighborhood.locationId;
    send({ type: 'mapLoaded' });
  };

  const { center } = centerState;

  return (
    <Map center={center} level={INITIAL_LEVEL} style={MAP_STYLE} onTileLoaded={handleTileLoaded}>
      {characters.map((character, index) => (
        <CustomOverlayMap
          key={character.id}
          position={{
            lat: center.lat,
            lng: center.lng + (index - (characters.length - 1) / 2) * TEMP_SPACING_LNG,
          }}
          yAnchor={1}
        >
          <CharacterSprite config={character.config} size={CHARACTER_SIZE} seed={character.id} />
        </CustomOverlayMap>
      ))}
    </Map>
  );
}
