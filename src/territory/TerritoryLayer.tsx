import { memo, useCallback } from 'react';
import { Polygon } from 'react-kakao-maps-sdk';
import type { MapTerritory } from '../bridge/bridge';
import type { DongBoundaries, PolygonPath } from './useDongBoundaries';

/**
 * 폴리곤 색은 CSS가 아니라 카카오 SDK 옵션(`#xxxxxx`)으로만 받아 변수를 쓸 수 없다.
 * 값은 styles/tokens.css와 같아야 한다(앱 colors.js 기준).
 * 16개 구를 팀 색으로 나누면 구분이 안 돼, 나와의 관계 4가지로만 칠한다(앱 계획 문서).
 */
const TONE_STYLE: Record<MapTerritory['tone'], { fill: string; stroke: string; opacity: number }> =
  {
    mine: { fill: '#fc8253', stroke: '#e5764c', opacity: 0.45 }, // primary-600 / primary-700
    team: { fill: '#fec6b0', stroke: '#fc8253', opacity: 0.4 }, // primary-300 / primary-600
    rival: { fill: '#6693ff', stroke: '#4078ff', opacity: 0.3 }, // secondary-400 / secondary-500
    neutral: { fill: '#c4ccda', stroke: '#9daabb', opacity: 0.2 }, // gray-300 / gray-400
  };
/** 차단한 유저의 땅은 팀과 관계없이 회색 점선으로 칠한다 */
const BLOCKED_STYLE = { fill: '#6e7d94', stroke: '#6e7d94', opacity: 0.25 }; // gray-500

const STROKE_WEIGHT = 1.5;
const SELECTED_STROKE_WEIGHT = 4;
const SELECTED_OPACITY_BOOST = 0.2;
/** 고른 동의 굵은 테두리가 옆 동 테두리에 덮이지 않게 위로 올린다 */
const SELECTED_Z_INDEX = 2;

interface DongPolygonProps {
  dongCode: number;
  polygons: PolygonPath[];
  tone: MapTerritory['tone'];
  blocked: boolean;
  selected: boolean;
  onTap: (dongCode: number) => void;
}

/** 고른 동이 바뀌어도 그 두 동만 다시 그리도록 동마다 memo로 나눈다 */
const DongPolygon = memo(function DongPolygon({
  dongCode,
  polygons,
  tone,
  blocked,
  selected,
  onTap,
}: DongPolygonProps) {
  const style = blocked ? BLOCKED_STYLE : TONE_STYLE[tone];
  const handleClick = useCallback(() => onTap(dongCode), [onTap, dongCode]);

  return (
    <>
      {polygons.map((path, index) => (
        <Polygon
          key={index}
          path={path}
          fillColor={style.fill}
          fillOpacity={style.opacity + (selected ? SELECTED_OPACITY_BOOST : 0)}
          strokeColor={style.stroke}
          strokeOpacity={0.9}
          strokeWeight={selected ? SELECTED_STROKE_WEIGHT : STROKE_WEIGHT}
          strokeStyle={blocked ? 'shortdash' : 'solid'}
          zIndex={selected ? SELECTED_Z_INDEX : 1}
          onClick={handleClick}
        />
      ))}
    </>
  );
});

interface TerritoryLayerProps {
  territories: MapTerritory[];
  boundaries: DongBoundaries;
  selectedDong: number | null;
  onDongTap: (dongCode: number) => void;
}

/** 땅따먹기 땅을 관계 색으로 칠한다. 경계 데이터에 없는 동은 건너뛴다(데이터 버전이 다를 때). */
export default function TerritoryLayer({
  territories,
  boundaries,
  selectedDong,
  onDongTap,
}: TerritoryLayerProps) {
  return (
    <>
      {territories.map((territory) => {
        const boundary = boundaries.get(territory.dongCode);
        if (!boundary) return null;
        return (
          <DongPolygon
            key={territory.dongCode}
            dongCode={territory.dongCode}
            polygons={boundary.polygons}
            tone={territory.tone}
            blocked={territory.blocked === true}
            selected={territory.dongCode === selectedDong}
            onTap={onDongTap}
          />
        );
      })}
    </>
  );
}
