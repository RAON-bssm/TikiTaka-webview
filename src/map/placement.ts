import type { LatLng } from '../bridge/bridge';
import { seededRandom } from '../utils/seededRandom';
import { pointInArea } from './bounds';

/** 캐릭터끼리 이 거리(m)보다 가까이 서지 않게 한다. TODO: 줌·캐릭터 크기 확정 후 조정 */
const MIN_GAP_M = 300;
/** 캐릭터마다 뽑아 보는 후보 위치 수 */
const CANDIDATES = 12;

const METERS_PER_DEGREE_LAT = 111_320;

/** 가까운 거리용 근사 (동네 크기에서는 오차가 무시할 만하다) */
function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * 첫 배치 위치. 캐릭터마다 자기 id로 후보를 뽑고, 앞서 선 캐릭터와 MIN_GAP_M 이상 떨어진 첫 후보에 선다.
 * 모두 가까우면 가장 멀리 떨어진 후보를 고른다.
 * 같은 순서의 같은 id 목록이면 항상 같은 결과가 나온다(새로고침해도 같은 자리).
 */
export function placeCharacters(center: LatLng, ids: readonly string[]): LatLng[] {
  const placed: LatLng[] = [];
  for (const id of ids) {
    const random = seededRandom(id);
    let best: LatLng | null = null;
    let bestGap = -1;
    for (let i = 0; i < CANDIDATES; i += 1) {
      const candidate = pointInArea(center, random);
      const gap = Math.min(Infinity, ...placed.map((other) => distanceM(candidate, other)));
      if (gap > bestGap) {
        best = candidate;
        bestGap = gap;
      }
      if (gap >= MIN_GAP_M) break;
    }
    placed.push(best ?? center);
  }
  return placed;
}
