import * as z from 'zod/mini';
import type { ToWeb } from './bridge';

// RN → 웹 메시지(ToWeb)의 런타임 검증 스키마. 타입의 원본은 bridge.ts이며,
// 아래 타입 검사로 스키마가 bridge.ts와 어긋나면 빌드가 실패한다.
// 객체에 모르는 필드가 있으면 버린다(앱이 먼저 필드를 추가해도 깨지지 않도록).

const LatLng = z.object({ lat: z.number(), lng: z.number() });

const CharacterConfig = z.object({
  body: z.string(),
  eyes: z.string(),
  eyesColor: z.string(),
  mouth: z.string(),
  hairBack: z.string(),
  hairFront: z.string(),
  hairColor: z.string(),
  clothing: z.optional(z.string()),
  accessory: z.optional(z.string()),
});

const PartUrlMap = z.record(z.string(), z.string());

const MapCharacter = z.object({
  id: z.string(),
  name: z.string(),
  config: CharacterConfig,
  kind: z.enum(['npc', 'user']),
});

const Neighborhood = z.object({
  locationId: z.number(),
  cityName: z.string(),
  name: z.string(),
  center: z.optional(LatLng),
});

const PlacedSticker = z.object({
  id: z.string(),
  stickerId: z.string(),
  position: LatLng,
  rotation: z.number(),
  scale: z.number(),
});

const v = z.literal(1);

const ToWebSchema = z.discriminatedUnion('type', [
  z.object({
    v,
    type: z.literal('init'),
    neighborhood: Neighborhood,
    characters: z.array(MapCharacter),
    partUrls: PartUrlMap,
  }),
  z.object({
    v,
    type: z.literal('setNeighborhood'),
    neighborhood: Neighborhood,
    characters: z.array(MapCharacter),
  }),
  z.object({
    v,
    type: z.literal('upsertCharacters'),
    characters: z.array(MapCharacter),
    partUrls: z.optional(PartUrlMap),
  }),
  z.object({
    v,
    type: z.literal('showBubble'),
    characterId: z.string(),
    text: z.string(),
    durationMs: z.optional(z.number()),
  }),
  z.object({ v, type: z.literal('focusCharacter'), characterId: z.string() }),
  z.object({
    v,
    type: z.literal('setStickers'),
    stickers: z.array(PlacedSticker),
    stickerUrls: PartUrlMap,
  }),
  z.object({ v, type: z.literal('setEditMode'), enabled: z.boolean() }),
]);

// 스키마와 bridge.ts 타입이 서로 대입 가능해야 한다. 메시지를 추가·변경했다면 양쪽을 같이 고친다.
type Parsed = z.infer<typeof ToWebSchema>;
type Assert<T extends true> = T;
export type SchemaMatchesToWeb = Assert<
  [Parsed] extends [ToWeb] ? ([ToWeb] extends [Parsed] ? true : false) : false
>;

const KNOWN_TYPES: ReadonlySet<string> = new Set(
  ToWebSchema.def.options.map((option) => option.shape.type.def.values[0] as string),
);

export function isKnownType(type: string): type is ToWeb['type'] {
  return KNOWN_TYPES.has(type);
}

/** 이 개수까지만 오류 위치를 log에 담는다 (배열 전체가 틀리면 메시지가 너무 길어진다) */
const MAX_ISSUES = 3;

export type ParseResult = { ok: true; message: ToWeb } | { ok: false; reason: string };

/** 알려진 type의 메시지를 검증한다. 모르는 type은 호출 전에 isKnownType으로 걸러야 한다. */
export function parseToWeb(value: unknown): ParseResult {
  const result = ToWebSchema.safeParse(value);
  if (result.success) return { ok: true, message: result.data };
  const issues = result.error.issues;
  const reason = issues
    .slice(0, MAX_ISSUES)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join(', ');
  const more = issues.length > MAX_ISSUES ? ` 외 ${issues.length - MAX_ISSUES}건` : '';
  return { ok: false, reason: reason + more };
}
