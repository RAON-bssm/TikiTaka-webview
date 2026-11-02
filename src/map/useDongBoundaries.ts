import { useEffect, useMemo, useState } from 'react';
import type { LatLng } from '../bridge/bridge';
import { log } from '../bridge/transport';

/** 폴리곤 하나(= `<Polygon path={...}>` 하나) 분량의 링 배열. `[0]`이 외곽선, 나머지는 구멍. */
type Rings = LatLng[][];

/**
 * 동 하나의 경계. `parts`가 여러 개면 섬처럼 떨어진 영역이 있는 동이다(그런 동은
 * `<Polygon>`을 파트 수만큼 나눠 그려야 한다).
 */
export interface DongBoundary {
  gu: string;
  dong: string;
  parts: Rings[];
}

const GEOJSON_URL = '/geojson/busan_dong.geojson';

/** [lng, lat] 쌍의 배열(링 하나)을 LatLng 배열로 바꾼다. 순서가 반대라 뒤집어야 한다. */
function toRing(raw: unknown): LatLng[] | null {
  if (!Array.isArray(raw)) return null;
  const ring: LatLng[] = [];
  for (const point of raw) {
    if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number') {
      return null;
    }
    ring.push({ lat: point[1], lng: point[0] });
  }
  return ring;
}

function toRings(raw: unknown): Rings | null {
  if (!Array.isArray(raw)) return null;
  const rings: Rings = [];
  for (const ringRaw of raw) {
    const ring = toRing(ringRaw);
    if (!ring) return null;
    rings.push(ring);
  }
  return rings;
}

/** GeoJSON Polygon(`Ring[]`)·MultiPolygon(`Ring[][]`) coordinates를 파트 배열로 통일한다. */
function toParts(geometry: unknown): Rings[] | null {
  if (typeof geometry !== 'object' || geometry === null) return null;
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(coordinates)) return null;

  if (type === 'Polygon') {
    const rings = toRings(coordinates);
    return rings ? [rings] : null;
  }
  if (type === 'MultiPolygon') {
    const parts: Rings[] = [];
    for (const polygon of coordinates) {
      const rings = toRings(polygon);
      if (!rings) return null;
      parts.push(rings);
    }
    return parts;
  }
  return null;
}

function parseFeatureCollection(data: unknown): DongBoundary[] {
  if (typeof data !== 'object' || data === null || !('features' in data)) return [];
  const { features } = data as { features: unknown };
  if (!Array.isArray(features)) return [];

  const boundaries: DongBoundary[] = [];
  for (const feature of features) {
    if (typeof feature !== 'object' || feature === null) continue;
    const { properties, geometry } = feature as { properties?: unknown; geometry?: unknown };
    if (typeof properties !== 'object' || properties === null) continue;
    const { gu, dong } = properties as { gu?: unknown; dong?: unknown };
    if (typeof gu !== 'string' || typeof dong !== 'string') continue;

    const parts = toParts(geometry);
    if (!parts) continue;
    boundaries.push({ gu, dong, parts });
  }
  return boundaries;
}

let cache: Promise<DongBoundary[]> | null = null;

/** 모든 동 경계를 한 번만 받아 메모리에 캐시한다(지도를 여러 번 새로 그려도 재요청하지 않음). */
function loadAll(): Promise<DongBoundary[]> {
  if (!cache) {
    cache = fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => parseFeatureCollection(data))
      .catch((error: unknown) => {
        cache = null;
        const message = error instanceof Error ? error.message : String(error);
        log('warn', `동 경계 로드 실패: ${message}`);
        return [];
      });
  }
  return cache;
}

/** `gu`(구/군 이름, 예: '북구')에 속한 동 경계만 돌려준다. */
export function useDongBoundaries(gu: string): DongBoundary[] {
  const [all, setAll] = useState<DongBoundary[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAll().then((result) => {
      if (!cancelled) setAll(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => all.filter((boundary) => boundary.gu === gu), [all, gu]);
}
