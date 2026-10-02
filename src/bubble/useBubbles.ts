import { useCallback, useEffect, useRef, useState } from 'react';

/** durationMs가 없거나 잘못됐을 때 말풍선을 보여 주는 시간 */
const DEFAULT_DURATION_MS = 4000;
/** 대기 말풍선 상한. RN이 showBubble/hideBubble을 못 보내도 '…'가 계속 남지 않게 한다 */
const TYPING_MAX_MS = 60_000;

export type Bubble =
  /** id: 같은 캐릭터에 새 말풍선이 오면 바뀐다. 등장 애니메이션을 다시 트는 key로 쓴다. */
  | { id: number; kind: 'text'; text: string }
  /** 챗봇 답을 기다리는 '…' */
  | { id: number; kind: 'typing' };

/**
 * 캐릭터별 말풍선. 한 캐릭터에 새 말풍선이 오면 이전 것을 교체한다.
 * 타이머를 화면(마커)이 아니라 여기에 두므로, 줌아웃으로 캐릭터가 숨어 있어도 시간이 되면 사라진다.
 */
export default function useBubbles() {
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const timers = useRef(new Map<string, number>());
  const nextId = useRef(0);

  const hide = useCallback((characterId: string) => {
    window.clearTimeout(timers.current.get(characterId));
    timers.current.delete(characterId);
    setBubbles((prev) => {
      if (!(characterId in prev)) return prev;
      const next = { ...prev };
      delete next[characterId];
      return next;
    });
  }, []);

  const put = useCallback(
    (characterId: string, bubble: Bubble, duration: number) => {
      window.clearTimeout(timers.current.get(characterId));
      setBubbles((prev) => ({ ...prev, [characterId]: bubble }));
      timers.current.set(
        characterId,
        window.setTimeout(() => hide(characterId), duration),
      );
    },
    [hide],
  );

  const show = useCallback(
    (characterId: string, text: string, durationMs?: number) => {
      const duration =
        durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0
          ? durationMs
          : DEFAULT_DURATION_MS;
      nextId.current += 1;
      put(characterId, { id: nextId.current, kind: 'text', text }, duration);
    },
    [put],
  );

  const showTyping = useCallback(
    (characterId: string) => {
      nextId.current += 1;
      put(characterId, { id: nextId.current, kind: 'typing' }, TYPING_MAX_MS);
    },
    [put],
  );

  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    setBubbles({});
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return { bubbles, show, showTyping, hide, clear };
}
