import type { LatLng } from '../bridge/bridge';

// 동네 크기(수 km)에서 쓰는 평면 근사. 이 범위에서는 오차가 무시할 만하다.

const METERS_PER_DEGREE_LAT = 111_320;

function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

/** 두 좌표 사이 거리(m) */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * metersPerDegreeLng(a.lat);
  return Math.hypot(dLat, dLng);
}

/** from에서 동쪽으로 eastM, 북쪽으로 northM(m) 옮긴 좌표 */
export function offsetM(from: LatLng, eastM: number, northM: number): LatLng {
  return {
    lat: from.lat + northM / METERS_PER_DEGREE_LAT,
    lng: from.lng + eastM / metersPerDegreeLng(from.lat),
  };
}

/** from에서 to 쪽으로 최대 stepM(m) 옮긴 좌표. 남은 거리가 stepM 이하면 to */
export function moveToward(from: LatLng, to: LatLng, stepM: number): LatLng {
  const distance = distanceM(from, to);
  if (distance <= stepM) return to;
  const ratio = stepM / distance;
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}
