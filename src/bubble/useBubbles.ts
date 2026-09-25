import { useCallback, useEffect, useRef, useState } from 'react';

/** durationMs가 없거나 잘못됐을 때 말풍선을 보여 주는 시간 */
const DEFAULT_DURATION_MS = 4000;

export interface Bubble {
  /** 같은 캐릭터에 새 말풍선이 오면 바뀐다. 등장 애니메이션을 다시 트는 key로 쓴다. */
  id: number;
  text: string;
}

/**
 * 캐릭터별 말풍선. 한 캐릭터에 새 말풍선이 오면 이전 것을 교체한다.
 * 타이머를 화면(마커)이 아니라 여기에 두므로, 줌아웃으로 캐릭터가 숨어 있어도 시간이 되면 사라진다.
 */
export default function useBubbles() {
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const timers = useRef(new Map<string, number>());
  const nextId = useRef(0);

  const show = useCallback((characterId: string, text: string, durationMs?: number) => {
    const duration =
      durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : DEFAULT_DURATION_MS;
    nextId.current += 1;
    const bubble = { id: nextId.current, text };

    window.clearTimeout(timers.current.get(characterId));
    setBubbles((prev) => ({ ...prev, [characterId]: bubble }));
    timers.current.set(
      characterId,
      window.setTimeout(() => {
        timers.current.delete(characterId);
        setBubbles((prev) => {
          const next = { ...prev };
          delete next[characterId];
          return next;
        });
      }, duration),
    );
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    setBubbles({});
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return { bubbles, show, clear };
}
