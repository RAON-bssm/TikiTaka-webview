/** 문자열 해시 (FNV-1a 32bit). 'mock-1', 'mock-2'처럼 비슷한 문자열도 값이 크게 달라진다. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 문자열로 시드를 정하는 난수 생성기 (mulberry32). 같은 시드면 항상 같은 수열이 나온다.
 * 반환된 함수는 호출할 때마다 0 이상 1 미만의 수를 준다.
 */
export function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
