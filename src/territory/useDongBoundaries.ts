import { useEffect, useState } from 'react';
import type { LatLng } from '../bridge/bridge';
import { log } from '../bridge/transport';

/** `<Polygon path>` 하나 분량. `[0]`이 외곽선, 나머지는 구멍이다. */
export type PolygonPath = LatLng[][];

export interface DongBoundary {
  /** 섬처럼 떨어진 영역이 있으면 여러 개다. `<Polygon>`을 파트마다 따로 그린다. */
  polygons: PolygonPath[];
  /** 가장 큰 파트의 경계 상자 가운데. 동을 고르면 이 점을 시트 위로 옮긴다. */
  center: LatLng;
}

export type DongBoundaries = ReadonlyMap<number, DongBoundary>;

/** scripts/gen-dong-boundaries.mjs가 만든다 */
const BOUNDARIES_URL = '/territory/dong-boundaries.json';

/** 링은 [lng, lat, lng, lat, ...] */
type FlatRing = number[];

function isFlatRings(value: unknown): value is FlatRing[] {
  return (
    Array.isArray(value) &&
    value.every(
      (ring) => Array.isArray(ring) && ring.length >= 6 && ring.every((n) => typeof n === 'number'),
    )
  );
}

function toPath(ring: FlatRing): LatLng[] {
  const path: LatLng[] = [];
  for (let i = 0; i + 1 < ring.length; i += 2) path.push({ lat: ring[i + 1], lng: ring[i] });
  return path;
}

function centerOf(polygons: FlatRing[][]): LatLng {
  const outer = polygons
    .map((rings) => rings[0])
    .reduce((largest, ring) => (ring.length > largest.length ? ring : largest));
  let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < outer.length; i += 2) {
    minLng = Math.min(minLng, outer[i]);
    maxLng = Math.max(maxLng, outer[i]);
    minLat = Math.min(minLat, outer[i + 1]);
    maxLat = Math.max(maxLat, outer[i + 1]);
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

function parse(data: unknown): Map<number, DongBoundary> {
  const result = new Map<number, DongBoundary>();
  if (typeof data !== 'object' || data === null) return result;
  const { dongs } = data as { dongs?: unknown };
  if (typeof dongs !== 'object' || dongs === null) return result;

  for (const [code, value] of Object.entries(dongs)) {
    if (!Array.isArray(value) || value.length === 0 || !value.every(isFlatRings)) continue;
    const polygons = value as FlatRing[][];
    result.set(Number(code), {
      polygons: polygons.map((rings) => rings.map(toPath)),
      center: centerOf(polygons),
    });
  }
  return result;
}

let cache: Promise<Map<number, DongBoundary>> | null = null;

/** WebView가 다시 로드되기 전까지는 한 번만 받는다. 실패하면 다음에 다시 시도한다. */
function load(): Promise<Map<number, DongBoundary>> {
  cache ??= fetch(BOUNDARIES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then(parse)
    .catch((error: unknown) => {
      cache = null;
      log(
        'warn',
        `동 경계를 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
      );
      return new Map<number, DongBoundary>();
    });
  return cache;
}

const EMPTY: DongBoundaries = new Map();

/** 땅따먹기가 열렸을 때(enabled)만 경계를 받는다. 첫 로딩 시간에 영향을 주지 않기 위해서다. */
export default function useDongBoundaries(enabled: boolean): DongBoundaries {
  const [boundaries, setBoundaries] = useState<DongBoundaries>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void load().then((loaded) => {
      if (!cancelled) setBoundaries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return boundaries;
}
