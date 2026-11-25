import type { CharacterConfig } from '../bridge/bridge';

type ShapeKey = Exclude<keyof CharacterConfig, 'eyesColor' | 'hairColor'>;

/** 이 접두사가 붙은 새 id는 접두사를 떼면 웹 에셋 이름이 된다. 예: 'hair-back-long' → 'long' */
const PREFIXED: Partial<Record<ShapeKey, string>> = {
  accessory: 'accessory-',
  hairBack: 'hair-back-',
  hairFront: 'hair-front-',
};

/**
 * 앱·서버는 파츠 id를 `종류-이름`(예: 'body-02', 'hair-back-long')으로 바꿨지만, 웹 `public/parts/`는 아직
 * 옛 이름('body02', 'long')이다. 옛 id가 오면 그대로 둔다. 앱 `src/constants/character/legacyIds.ts`의 반대 방향이다.
 */
export function toWebPartId(key: ShapeKey, id: string): string {
  const prefix = PREFIXED[key];
  if (prefix) return id.startsWith(prefix) ? id.slice(prefix.length) : id;
  return id.replace(/-(\d+)$/, '$1');
}

/** 서버·앱 색 코드는 대문자('BLACK'), 웹 에셋 파일명은 소문자다. */
export function toWebColorId(color: string): string {
  return color.toLowerCase();
}
