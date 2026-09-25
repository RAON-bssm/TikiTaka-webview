// 앱 레포(TikiTaka-app)와 동기화 필요: src/constants/character/types.ts (LAYERS), src/constants/character/assets.ts (DEFAULT_CHARACTER_CONFIG)
// 규칙 원본: docs/map-web-plan.md 2.4절

import type { CharacterConfig } from '../bridge/bridge';

type ShapeKey = 'body' | 'mouth' | 'clothing' | 'accessory' | 'eyes' | 'hairBack' | 'hairFront';
type ColorKey = 'eyesColor' | 'hairColor';

/** 모양 파츠 레이어. group에서 모양 id를, color가 있으면 색상 id를 읽는다. */
export interface ShapeLayerDef {
  group: ShapeKey;
  color?: ColorKey;
}

/** 색상만으로 이미지를 고르는 레이어 (머리 하이라이트) */
export interface TintLayerDef {
  tint: 'hairHighlights';
  color: ColorKey;
}

export type LayerDef = ShapeLayerDef | TintLayerDef;

/** 그리는 순서(아래 → 위) */
export const LAYERS: readonly LayerDef[] = [
  { group: 'hairBack', color: 'hairColor' },
  { group: 'body' },
  { group: 'clothing' },
  { group: 'eyes', color: 'eyesColor' },
  { group: 'mouth' },
  { group: 'hairFront', color: 'hairColor' },
  { group: 'accessory' },
  { tint: 'hairHighlights', color: 'eyesColor' },
];

/** 없으면 폴백하지 않고 건너뛰는 슬롯 */
export const OPTIONAL_GROUPS: ReadonlySet<ShapeKey> = new Set(['clothing', 'accessory']);

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  body: 'body02',
  eyes: 'eyes01',
  eyesColor: 'orange',
  mouth: 'mouth01',
  hairBack: 'long',
  hairFront: 'basic',
  hairColor: 'black',
  clothing: 'clothing01',
};

export function layerKey(layer: LayerDef): string {
  return 'tint' in layer ? layer.tint : layer.group;
}
