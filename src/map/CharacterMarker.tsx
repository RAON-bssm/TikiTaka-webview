import { memo, useRef } from 'react';
import { CustomOverlayMap } from 'react-kakao-maps-sdk';
import type { LatLng, MapCharacter } from '../bridge/bridge';
import { send } from '../bridge/transport';
import SpeechBubble from '../bubble/SpeechBubble';
import type { Bubble } from '../bubble/useBubbles';
import CharacterSprite from '../character/CharacterSprite';
import './CharacterMarker.css';

/** 화면 아래(위도가 낮은) 캐릭터가 앞에 오도록 한다. 오버레이 zIndex는 정수여야 한다. */
function zIndexFor(lat: number): number {
  return Math.round((90 - lat) * 10_000);
}

/** 말풍선이 뜬 캐릭터는 다른 캐릭터보다 앞에 둔다 (zIndexFor의 최댓값 1,800,000보다 크게) */
const BUBBLE_Z_OFFSET = 2_000_000;

/** 탭했을 때 살짝 튀어 오르는 모션. transform만 바꾼다 */
const TAP_BOUNCE: Keyframe[] = [
  { transform: 'translateY(0)' },
  { transform: 'translateY(-12%)', offset: 0.4 },
  { transform: 'translateY(0)' },
];
const TAP_BOUNCE_OPTIONS: KeyframeAnimationOptions = { duration: 320, easing: 'ease-out' };

interface CharacterMarkerProps {
  character: MapCharacter;
  position: LatLng;
  /** 캐릭터 한 변(px) */
  size: number;
  bubble?: Bubble;
}

/**
 * 지도 위 캐릭터 하나: 발 위치가 position에 오도록 올리고, 발밑에 이름표, 머리 위에 말풍선을 단다.
 * 탭하면 RN에 characterTap을 보낸다 (챗봇 화면은 RN이 띄운다).
 */
const CharacterMarker = memo(function CharacterMarker({
  character,
  position,
  size,
  bubble,
}: CharacterMarkerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleTap = () => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bodyRef.current?.animate(TAP_BOUNCE, TAP_BOUNCE_OPTIONS);
    }
    send({ type: 'characterTap', characterId: character.id });
  };

  return (
    <CustomOverlayMap
      position={position}
      yAnchor={1}
      zIndex={zIndexFor(position.lat) + (bubble ? BUBBLE_Z_OFFSET : 0)}
      clickable
    >
      <div className="character-marker" onClick={handleTap}>
        <div ref={bodyRef}>
          <CharacterSprite config={character.config} size={size} seed={character.id} />
        </div>
        <span className="character-marker__name">{character.name}</span>
        {bubble && (
          <div className="character-marker__bubble">
            <SpeechBubble key={bubble.id} text={bubble.text} />
          </div>
        )}
      </div>
    </CustomOverlayMap>
  );
});

export default CharacterMarker;
