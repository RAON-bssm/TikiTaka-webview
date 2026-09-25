import type { CharacterConfig } from '../bridge/bridge';
import { BUNDLED_PARTS } from '../parts/manifest';
import { DEFAULT_CHARACTER_CONFIG, OPTIONAL_GROUPS, type LayerDef } from './layers';

const toKebab = (value: string) => value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** 레이어의 경로 키. 예: 'hair-back/bob/pink'. 값이 없으면 null */
function partKey(config: CharacterConfig, layer: LayerDef): string | null {
  if ('tint' in layer) {
    const color = config[layer.color];
    return color ? `${toKebab(layer.tint)}/${color}` : null;
  }
  const shape = config[layer.group];
  if (!shape) return null;
  const color = layer.color ? config[layer.color] : undefined;
  if (layer.color && !color) return null;
  return [toKebab(layer.group), shape, color].filter(Boolean).join('/');
}

/**
 * 레이어 이미지 URL. 번들 manifest → 기본 config 순으로 찾고, 없으면 null(레이어 건너뜀).
 * TODO(M4): RN이 넘긴 partUrls, 로드 실패 폴백
 */
export function resolvePart(config: CharacterConfig, layer: LayerDef): string | null {
  if (!('tint' in layer) && OPTIONAL_GROUPS.has(layer.group) && !config[layer.group]) return null;

  for (const candidate of [config, DEFAULT_CHARACTER_CONFIG]) {
    const key = partKey(candidate, layer);
    if (key && BUNDLED_PARTS.has(key)) return `/parts/${key}.webp`;
  }
  return null;
}
