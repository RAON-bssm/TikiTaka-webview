import { useEffect, useMemo, useState } from 'react';
import type { LatLng, Neighborhood } from '../bridge/bridge';

type CenterState =
  | { status: 'loading' }
  | { status: 'success'; center: LatLng }
  | { status: 'error'; message: string };

const CACHE_PREFIX = 'tikitaka:geocode:';

/** 동네명만으로는 식별할 수 없다('북구'가 여러 시/도에 있다). 항상 시/도를 붙인다. */
function toQuery(neighborhood: Neighborhood): string {
  return `${neighborhood.cityName} ${neighborhood.name}`;
}

function readCache(neighborhood: Neighborhood): LatLng | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + neighborhood.locationId);
    if (!raw) return undefined;
    const cached: unknown = JSON.parse(raw);
    if (
      typeof cached === 'object' &&
      cached !== null &&
      'query' in cached &&
      'lat' in cached &&
      'lng' in cached &&
      cached.query === toQuery(neighborhood) &&
      typeof cached.lat === 'number' &&
      typeof cached.lng === 'number'
    ) {
      return { lat: cached.lat, lng: cached.lng };
    }
  } catch {
    // localStorage가 막혀 있거나 값이 깨졌으면 캐시 없이 진행한다
  }
  return undefined;
}

function writeCache(neighborhood: Neighborhood, center: LatLng): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + neighborhood.locationId,
      JSON.stringify({ query: toQuery(neighborhood), ...center }),
    );
  } catch {
    // 캐시는 쿼터 절약용이므로 실패해도 무시한다
  }
}

/**
 * 동네 중심 좌표. neighborhood.center → localStorage 캐시 → 카카오 geocoder 순으로 찾는다.
 * 카카오 SDK(services 라이브러리)가 로드된 뒤에만 호출해야 한다.
 */
export default function useNeighborhoodCenter(neighborhood: Neighborhood): CenterState {
  const { locationId, cityName, name, center } = neighborhood;
  const query = toQuery(neighborhood);
  const cached = useMemo(
    () => (center ? undefined : readCache({ locationId, cityName, name })),
    [center, locationId, cityName, name],
  );
  const needsGeocode = !center && !cached;
  /** geocoder 결과. 어떤 query의 결과인지 함께 들고 있어 동네가 바뀌면 자동으로 무효가 된다. */
  const [geocoded, setGeocoded] = useState<{ query: string; state: CenterState } | null>(null);

  useEffect(() => {
    if (!needsGeocode) return;
    let cancelled = false;
    new kakao.maps.services.Geocoder().addressSearch(query, (result, status) => {
      if (cancelled) return;
      const first = result[0];
      if (status !== kakao.maps.services.Status.OK || !first) {
        setGeocoded({
          query,
          state: { status: 'error', message: `'${query}' 좌표를 찾지 못했습니다 (${status})` },
        });
        return;
      }
      const found = { lat: Number(first.y), lng: Number(first.x) };
      writeCache({ locationId, cityName, name }, found);
      setGeocoded({ query, state: { status: 'success', center: found } });
    });
    return () => {
      cancelled = true;
    };
  }, [needsGeocode, query, locationId, cityName, name]);

  if (center) return { status: 'success', center };
  if (cached) return { status: 'success', center: cached };
  if (geocoded?.query === query) return geocoded.state;
  return { status: 'loading' };
}
