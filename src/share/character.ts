import * as z from 'zod/mini';
import type { CharacterConfig } from '../bridge/bridge';
import { DEFAULT_CHARACTER_CONFIG } from '../character/layers';
import { toWebColorId, toWebPartId } from '../character/partId';

/**
 * `GET /api/equipment/{userId}`(작성자 착용 정보). 앱 `src/types/equipment.ts`의 Equipment와 같은 모양이고,
 * 착용하지 않은 슬롯은 키가 빠진다. 공유 페이지는 로그인이 없어 서버가 이 API를 공개(permitAll)해야 받을 수 있다.
 * 막혀 있으면(401 등) 기본 캐릭터를 그린다.
 */
const ItemSchema = z.object({ product_id: z.string() });
const EquipmentSchema = z.object({
  body: z.optional(ItemSchema),
  accessory: z.optional(ItemSchema),
  clothing: z.optional(ItemSchema),
  eyes: z.optional(ItemSchema),
  hair_front: z.optional(ItemSchema),
  hair_back: z.optional(ItemSchema),
  mouth: z.optional(ItemSchema),
  hair_color: z.optional(z.nullable(z.string())),
  eyes_color: z.optional(z.nullable(z.string())),
});
const ResponseSchema = z.object({ data: EquipmentSchema });

type Equipment = z.infer<typeof EquipmentSchema>;
type ShapeSlot = 'body' | 'accessory' | 'clothing' | 'eyes' | 'hair_front' | 'hair_back' | 'mouth';
type ShapeKey = Exclude<keyof CharacterConfig, 'eyesColor' | 'hairColor'>;

const SLOT_TO_KEY: Record<ShapeSlot, ShapeKey> = {
  body: 'body',
  accessory: 'accessory',
  clothing: 'clothing',
  eyes: 'eyes',
  hair_front: 'hairFront',
  hair_back: 'hairBack',
  mouth: 'mouth',
};

/**
 * 앱 `equipmentToConfig`와 같은 규칙. 서버 색 코드는 대문자('BLACK'), 웹 에셋은 소문자다.
 * 웹에 없는 파츠·색은 `resolvePart`가 슬롯별로 기본 캐릭터 것으로 바꿔 그린다.
 */
function toConfig(equipment: Equipment): CharacterConfig {
  const config: CharacterConfig = { ...DEFAULT_CHARACTER_CONFIG };
  for (const slot of Object.keys(SLOT_TO_KEY) as ShapeSlot[]) {
    const item = equipment[slot];
    if (!item) continue;
    const key = SLOT_TO_KEY[slot];
    config[key] = toWebPartId(key, item.product_id);
  }
  if (equipment.hair_color) config.hairColor = toWebColorId(equipment.hair_color);
  if (equipment.eyes_color) config.eyesColor = toWebColorId(equipment.eyes_color);
  return config;
}

/** 실패하면(비공개 401, 탈퇴 404, 네트워크 등) 기본 캐릭터를 쓰도록 `null`을 돌려준다. */
export async function fetchAuthorCharacter(userId: string): Promise<CharacterConfig | null> {
  try {
    const response = await fetch(`/api/equipment/${encodeURIComponent(userId)}`);
    if (!response.ok) return null;
    const json: unknown = await response.json();
    return toConfig(ResponseSchema.parse(json).data);
  } catch {
    return null;
  }
}
