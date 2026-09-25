import type { LatLng } from '../bridge/bridge';

/**
 * 캐릭터 이동 허용 영역: 동네 중심에서 이 반경(m) 안.
 * 경계 폴리곤(M5)이 생기면 폴리곤 기준으로 바꾼다. TODO: 실기기·디자인 확인 후 조정
 */
export const CHARACTER_AREA_RADIUS_M = 1500;

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * 0 이상 1 미만의 수 두 개를 영역 안의 좌표로 바꾼다.
 * 반지름에 제곱근을 씌워야 중심에 몰리지 않고 원 안에 고르게 퍼진다.
 */
export function pointInArea(center: LatLng, random: () => number): LatLng {
  const distance = CHARACTER_AREA_RADIUS_M * Math.sqrt(random());
  const angle = 2 * Math.PI * random();
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
  return {
    lat: center.lat + (distance * Math.sin(angle)) / METERS_PER_DEGREE_LAT,
    lng: center.lng + (distance * Math.cos(angle)) / metersPerDegreeLng,
  };
}
