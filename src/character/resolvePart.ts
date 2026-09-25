import type { CharacterConfig, PartUrlMap } from '../bridge/bridge';
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

/** HTTPS만 받는다. HTTP는 혼합 콘텐츠로 막히고, 잘못된 문자열은 이미지로 쓸 수 없다. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 레이어 이미지 URL (계획 5.3). config의 파츠를 번들 manifest → RN이 넘긴 partUrls 순으로 찾고,
 * 없으면 기본 config의 같은 슬롯으로 다시 찾는다. 그래도 없으면 null(레이어 건너뜀).
 * TODO(M4): 프리로드, 이미지 로드 실패(onerror) 폴백
 */
export function resolvePart(
  config: CharacterConfig,
  layer: LayerDef,
  partUrls: PartUrlMap = {},
): string | null {
  if (!('tint' in layer) && OPTIONAL_GROUPS.has(layer.group) && !config[layer.group]) return null;

  for (const candidate of [config, DEFAULT_CHARACTER_CONFIG]) {
    const key = partKey(candidate, layer);
    if (!key) continue;
    if (BUNDLED_PARTS.has(key)) return `/parts/${key}.webp`;
    const url = partUrls[key];
    if (url && isHttpsUrl(url)) return url;
  }
  return null;
}
