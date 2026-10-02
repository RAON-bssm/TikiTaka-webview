import { useEffect, useMemo } from 'react';
import type { LatLng } from '../bridge/bridge';
import { RoamingEngine } from './roaming';

/**
 * 지도가 만들어지면 돌아다니기 엔진을 띄운다. 지도가 새로 만들어지면(동네 전환 등) 엔진도 새로 만든다.
 * placements가 바뀌면 첫 배치 위치에서 다시 시작하고, 말풍선이 뜬 캐릭터와 포커스된 캐릭터는 멈춘다.
 */
export default function useRoaming(
  map: kakao.maps.Map | null,
  center: LatLng | null,
  placements: readonly { id: string; position: LatLng }[],
  busyIds: ReadonlySet<string>,
  focusedId: string | null,
): RoamingEngine | null {
  const engine = useMemo(() => (map ? new RoamingEngine(map) : null), [map]);

  useEffect(() => {
    if (!engine) return;
    engine.start();
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    if (engine && center) engine.reset(center, placements);
  }, [engine, center, placements]);

  useEffect(() => {
    engine?.setBusy(busyIds);
  }, [engine, busyIds]);

  useEffect(() => {
    engine?.setFocus(focusedId);
  }, [engine, focusedId]);

  return engine;
}
