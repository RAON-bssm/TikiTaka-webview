import { MOCK_INIT } from '../bridge/mock';
import CharacterSprite from '../character/CharacterSprite';

/** 개발용: 지도 없이 캐릭터만 띄워 모션을 확인한다. `pnpm dev`에서 `/?sprite`로 연다. */
export default function SpritePreview() {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 48, padding: 48, justifyContent: 'center' }}
    >
      {MOCK_INIT.characters.map((character) => (
        <CharacterSprite
          key={character.id}
          config={character.config}
          size={200}
          seed={character.id}
        />
      ))}
      {MOCK_INIT.characters.map((character) => (
        <CharacterSprite
          key={`s-${character.id}`}
          config={character.config}
          size={72}
          seed={character.id}
        />
      ))}
    </div>
  );
}
