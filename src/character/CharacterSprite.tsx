import { memo, useMemo, type CSSProperties } from 'react';
import type { CharacterConfig, PartUrlMap } from '../bridge/bridge';
import { LAYERS, layerKey, type LayerDef } from './layers';
import { resolvePart } from './resolvePart';
import './CharacterSprite.css';

/**
 * 대기 모션에서 레이어가 따라 움직이는 부위. 웹 전용 연출이라 앱 LAYERS에는 넣지 않는다.
 * 뒷머리·악세서리(안경, 반창고, 머리핀)는 머리에 붙어 있으므로 head를 따른다.
 */
type MotionPart = 'head' | 'body';

const motionPartOf = (layer: LayerDef): MotionPart =>
  'tint' in layer || (layer.group !== 'body' && layer.group !== 'clothing') ? 'head' : 'body';

/** 그리는 순서를 지키면서 같은 부위가 연속된 레이어끼리 묶는다. (뒷머리 | 몸·코스튬 | 얼굴·앞머리…) */
const MOTION_RUNS = LAYERS.reduce<{ part: MotionPart; layers: LayerDef[] }[]>((runs, layer) => {
  const part = motionPartOf(layer);
  const last = runs.at(-1);
  if (last?.part === part) last.layers.push(layer);
  else runs.push({ part, layers: [layer] });
  return runs;
}, []);

/** 모션 한 주기(ms). CharacterSprite.css의 animation-duration과 같아야 한다 */
const IDLE_PERIOD_MS = 2400;

/** 캐릭터마다 모션 시작 시점을 달리해 여럿이 똑같이 움직이지 않게 한다 (id 기준이라 재렌더해도 고정) */
function phaseDelay(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return `${-(Math.abs(hash) % IDLE_PERIOD_MS)}ms`;
}

interface CharacterSpriteProps {
  config: CharacterConfig;
  /** 한 변의 크기(px) */
  size: number;
  /** 모션 위상을 정하는 값 (보통 캐릭터 id) */
  seed?: string;
  /** 번들에 없는 파츠의 서버 URL (RN이 init으로 넘긴 값) */
  partUrls?: PartUrlMap;
}

const CharacterSprite = memo(function CharacterSprite({
  config,
  size,
  seed = '',
  partUrls,
}: CharacterSpriteProps) {
  const runs = useMemo(
    () =>
      MOTION_RUNS.map(({ part, layers }) => ({
        part,
        images: layers.flatMap((layer) => {
          const src = resolvePart(config, layer, partUrls);
          return src ? [{ key: layerKey(layer), src }] : [];
        }),
      })),
    [config, partUrls],
  );

  const style = useMemo(
    () => ({ width: size, height: size, '--idle-delay': phaseDelay(seed) }) as CSSProperties,
    [size, seed],
  );

  return (
    <div className="character-sprite" style={style}>
      {runs.map(({ part, images }, index) => (
        <div key={index} className={`character-sprite__layers character-sprite__layers--${part}`}>
          {images.map(({ key, src }) => (
            <img key={key} className="character-sprite__part" src={src} alt="" draggable={false} />
          ))}
        </div>
      ))}
    </div>
  );
});

export default CharacterSprite;
