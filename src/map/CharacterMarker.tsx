import { memo } from 'react';
import { CustomOverlayMap } from 'react-kakao-maps-sdk';
import type { LatLng, MapCharacter } from '../bridge/bridge';
import CharacterSprite from '../character/CharacterSprite';
import './CharacterMarker.css';

/** 화면 아래(위도가 낮은) 캐릭터가 앞에 오도록 한다. 오버레이 zIndex는 정수여야 한다. */
function zIndexFor(lat: number): number {
  return Math.round((90 - lat) * 10_000);
}

interface CharacterMarkerProps {
  character: MapCharacter;
  position: LatLng;
  /** 캐릭터 한 변(px) */
  size: number;
}

/** 지도 위 캐릭터 하나: 발 위치가 position에 오도록 올리고, 발밑에 이름표를 단다. */
const CharacterMarker = memo(function CharacterMarker({
  character,
  position,
  size,
}: CharacterMarkerProps) {
  return (
    <CustomOverlayMap position={position} yAnchor={1} zIndex={zIndexFor(position.lat)}>
      <div className="character-marker">
        <CharacterSprite config={character.config} size={size} seed={character.id} />
        <span className="character-marker__name">{character.name}</span>
      </div>
    </CustomOverlayMap>
  );
});

export default CharacterMarker;
