import { memo, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { CustomOverlayMap } from 'react-kakao-maps-sdk';
import type { LatLng, MapCharacter, PartUrlMap } from '../bridge/bridge';
import { send } from '../bridge/transport';
import SpeechBubble from '../bubble/SpeechBubble';
import type { Bubble } from '../bubble/useBubbles';
import CharacterSprite from '../character/CharacterSprite';
import type { RoamingEngine } from './roaming';
import './CharacterMarker.css';

/** 탭했을 때 살짝 튀어 오르는 모션. transform만 바꾼다 */
const TAP_BOUNCE: Keyframe[] = [
  { transform: 'translateY(0)' },
  { transform: 'translateY(-12%)', offset: 0.4 },
  { transform: 'translateY(0)' },
];
const TAP_BOUNCE_OPTIONS: KeyframeAnimationOptions = { duration: 320, easing: 'ease-out' };
/** 탭하면 이만큼(ms) 걷지 않고 멈춘다. 그 사이 RN이 말풍선을 보내면 말풍선이 떠 있는 동안 계속 멈춘다 */
const TAP_HOLD_MS = 3000;

interface CharacterMarkerProps {
  character: MapCharacter;
  position: LatLng;
  /** 캐릭터 한 변(px) */
  size: number;
  bubble?: Bubble;
  partUrls: PartUrlMap;
  /** 돌아다니기 엔진. 위치·겹침 순서·걷기 모션은 엔진이 오버레이를 직접 바꾼다 */
  roaming: RoamingEngine | null;
}

/**
 * 지도 위 캐릭터 하나: 발 위치가 position에 오도록 올리고, 발밑에 이름표, 머리 위에 말풍선을 단다.
 * position은 첫 배치 위치이고, 그 뒤 움직임은 roaming 엔진이 맡는다.
 * 탭하면 RN에 characterTap을 보낸다 (챗봇 화면은 RN이 띄운다).
 */
const CharacterMarker = memo(function CharacterMarker({
  character,
  position,
  size,
  bubble,
  partUrls,
  roaming,
}: CharacterMarkerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { id } = character;

  const handleOverlayCreate = useCallback(
    (overlay: kakao.maps.CustomOverlay) => roaming?.attachOverlay(id, overlay),
    [roaming, id],
  );
  const handleElement = useCallback(
    (element: HTMLDivElement | null) => roaming?.attachElement(id, element),
    [roaming, id],
  );
  // 줌아웃으로 숨겨지는 등 마커가 사라지면 엔진에서 뗀다 (위치 계산은 계속된다)
  useEffect(
    () => () => {
      roaming?.attachOverlay(id, null);
      roaming?.attachElement(id, null);
    },
    [roaming, id],
  );

  const handleTap = () => {
    roaming?.hold(id, TAP_HOLD_MS);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bodyRef.current?.animate(TAP_BOUNCE, TAP_BOUNCE_OPTIONS);
    }
    send({ type: 'characterTap', characterId: id });
  };

  /** 키보드·스크린리더 사용자도 누를 수 있게 버튼처럼 Enter/Space에 반응한다 */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleTap();
  };

  return (
    <CustomOverlayMap position={position} yAnchor={1} clickable onCreate={handleOverlayCreate}>
      <div ref={handleElement} className="character-marker">
        {/* <button> 안에는 div를 넣을 수 없어 role로 버튼 역할을 준다. 말풍선은 읽히도록 버튼 밖에 둔다 */}
        <div
          ref={bodyRef}
          className="character-marker__body"
          role="button"
          tabIndex={0}
          aria-label={character.name}
          onClick={handleTap}
          onKeyDown={handleKeyDown}
        >
          <CharacterSprite
            config={character.config}
            size={size}
            seed={character.id}
            partUrls={partUrls}
          />
        </div>
        {/* 이름은 버튼의 aria-label로 읽으므로 이름표는 스크린리더에서 숨긴다 */}
        <span className="character-marker__name" aria-hidden="true">
          {character.name}
        </span>
        {bubble && (
          <div className="character-marker__bubble">
            <SpeechBubble key={bubble.id} bubble={bubble} />
          </div>
        )}
      </div>
    </CustomOverlayMap>
  );
});

export default CharacterMarker;
