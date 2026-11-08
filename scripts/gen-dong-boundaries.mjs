// 땅따먹기 동 경계를 만든다. 실행: pnpm gen:dong-boundaries
// - 원본: scripts/data/busan_dong.geojson (행정동 경계, properties.adm_cd2)
//   앱 레포(TikiTaka-app)의 scripts/data/territory/busan_dong.geojson과 같은 버전이어야 한다.
//   서버 시드(동 목록)와 버전이 다르면 서버가 주는 dongCode의 경계를 못 찾아 그 동이 지도에서 빠진다.
// - 출력: public/territory/dong-boundaries.json
//   { version, dongs: { [adm_cd2]: Polygon[] } }, Polygon = Ring[] (첫 링이 외곽선, 나머지는 구멍),
//   Ring = [lng, lat, lng, lat, ...]. 땅따먹기가 열릴 때만 받도록 번들이 아니라 public에 둔다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(__dirname, 'data/busan_dong.geojson');
const OUT = path.join(ROOT, 'public/territory/dong-boundaries.json');

const SOURCE_VERSION = 'ver20261001';
// 약 10m. 동네 단위 지도에서 눈에 띄지 않고, 점 수를 크게 줄인다.
const SIMPLIFY_TOLERANCE = 0.0001;
const COORD_DIGITS = 5;

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

/** Douglas–Peucker */
function simplify(points) {
  if (points.length <= 3) return points;
  let maxDistance = 0;
  let maxIndex = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  if (maxDistance <= SIMPLIFY_TOLERANCE) return [points[0], points[last]];
  return [
    ...simplify(points.slice(0, maxIndex + 1)).slice(0, -1),
    ...simplify(points.slice(maxIndex)),
  ];
}

const round = (value) => Number(value.toFixed(COORD_DIGITS));

/** 너무 작아져 면이 사라진 링은 버린다. */
function flattenRing(ring) {
  const simplified = simplify(ring);
  if (simplified.length < 4) return null;
  return simplified.flatMap(([lng, lat]) => [round(lng), round(lat)]);
}

function toPolygons(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((rings) => rings.map(flattenRing).filter(Boolean))
    .filter((rings) => rings.length > 0 && rings[0] !== undefined);
}

function build() {
  const geojson = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const dongs = {};
  for (const feature of geojson.features) {
    const code = String(Number(feature.properties.adm_cd2));
    if (dongs[code]) throw new Error(`adm_cd2가 중복됩니다: ${code}`);
    const polygons = toPolygons(feature.geometry);
    if (polygons.length === 0) throw new Error(`경계가 비었습니다: ${code}`);
    dongs[code] = polygons;
  }
  return { version: SOURCE_VERSION, dongs };
}

const output = `${JSON.stringify(build())}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== output) {
    console.error('dong-boundaries.json이 원본과 다릅니다. pnpm gen:dong-boundaries를 실행하세요.');
    process.exit(1);
  }
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, output);
  const data = JSON.parse(output);
  const points = Object.values(data.dongs)
    .flat(2)
    .reduce((sum, ring) => sum + ring.length / 2, 0);
  console.log(
    `동 ${Object.keys(data.dongs).length}개, 경계 점 ${points}개, ${output.length} bytes`,
  );
}
