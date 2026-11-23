// 앱 레포(TikiTaka-app)와 동기화 필요: src/hooks/useRelativeTime.ts의 formatRelativeTime
const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/**
 * "방금 전", "3시간 전" 등 가장 큰 단위 하나로 표기한다. 미래 시각은 0으로 클램프한다.
 * 서버 시각은 오프셋 없는 KST라, 해외에서 열어도 맞도록 +09:00을 붙여 해석한다.
 */
export function formatRelativeTime(kstDateTime: string): string {
  const targetMs = new Date(`${kstDateTime}+09:00`).getTime();
  if (Number.isNaN(targetMs)) return '';

  const diffSec = Math.max(0, Math.floor((Date.now() - targetMs) / 1000));

  if (diffSec < MINUTE) return '방금 전';
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}분 전`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}시간 전`;
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}일 전`;
  if (diffSec < MONTH) return `${Math.floor(diffSec / WEEK)}주 전`;
  if (diffSec < YEAR) return `${Math.floor(diffSec / MONTH)}개월 전`;
  return `${Math.floor(diffSec / YEAR)}년 전`;
}
