import type { ToRN, ToWeb } from './bridge';

declare global {
  interface Window {
    /** RN WebView가 주입하는 전송 객체. 브라우저 단독 실행 시에는 없다. */
    ReactNativeWebView?: { postMessage: (message: string) => void };
    /** RN → 웹 수신 진입점. RN이 injectJavaScript로 receive(msg)를 호출한다. */
    __tikitaka?: { receive: (message: unknown) => void };
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function isInApp(): boolean {
  return typeof window.ReactNativeWebView?.postMessage === 'function';
}

/** 웹 → RN 전송. 앱 밖에서는 콘솔에 출력한다. */
export function send(message: DistributiveOmit<ToRN, 'v'>): void {
  const payload = { v: 1, ...message } as ToRN;
  if (isInApp()) {
    window.ReactNativeWebView!.postMessage(JSON.stringify(payload));
  } else {
    console.info('[bridge → RN]', payload);
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string): void {
  send({ type: 'log', level, message });
}

/**
 * RN → 웹 수신 함수를 등록한다. 반환값을 호출하면 해제된다.
 * TODO(M1): zod 스키마로 메시지 전체를 검증한다. 지금은 공통 형태({ v: 1, type })만 확인한다.
 */
export function registerReceiver(handler: (message: ToWeb) => void): () => void {
  const receive = (raw: unknown) => {
    let message: unknown = raw;
    if (typeof raw === 'string') {
      try {
        message = JSON.parse(raw);
      } catch {
        log('warn', 'JSON이 아닌 메시지를 무시했습니다');
        return;
      }
    }
    if (!isEnvelope(message)) {
      log('warn', '형식이 잘못된 메시지를 무시했습니다');
      return;
    }
    if (message.v !== 1) {
      log('warn', `지원하지 않는 버전(v=${String(message.v)})의 메시지를 무시했습니다`);
      return;
    }
    handler(message as ToWeb);
  };

  window.__tikitaka = { receive };
  return () => {
    if (window.__tikitaka?.receive === receive) delete window.__tikitaka;
  };
}

function isEnvelope(value: unknown): value is { v: unknown; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}
