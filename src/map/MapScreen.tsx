import { useEffect, useRef } from 'react';
import { Map } from 'react-kakao-maps-sdk';
import type { Neighborhood } from '../bridge/bridge';
import { send } from '../bridge/transport';
import useNeighborhoodCenter from './useNeighborhoodCenter';

/** 초기 줌 레벨(숫자가 작을수록 확대). TODO: 디자인 확인 후 minLevel/maxLevel과 함께 확정 */
const INITIAL_LEVEL = 6;

const MAP_STYLE = { width: '100%', height: '100%' };

interface MapScreenProps {
  neighborhood: Neighborhood;
}

export default function MapScreen({ neighborhood }: MapScreenProps) {
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

  return (
    <Map
      center={centerState.center}
      level={INITIAL_LEVEL}
      style={MAP_STYLE}
      onTileLoaded={handleTileLoaded}
    />
  );
}
