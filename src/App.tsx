import { useEffect, useState } from 'react';
import { useKakaoLoader } from 'react-kakao-maps-sdk';
import type { Neighborhood, ToWeb } from './bridge/bridge';
import { MOCK_INIT } from './bridge/mock';
import { isInApp, log, registerReceiver, send } from './bridge/transport';
import MapScreen from './map/MapScreen';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

export default function App() {
  const [loading, error] = useKakaoLoader({ appkey: KAKAO_JS_KEY, libraries: ['services'] });
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null);

  useEffect(() => {
    if (error) {
      send({
        type: 'mapError',
        code: 'SDK_LOAD_FAILED',
        message: KAKAO_JS_KEY
          ? '카카오맵 SDK를 불러오지 못했습니다'
          : 'VITE_KAKAO_JS_KEY가 없습니다',
      });
    }
  }, [error]);

  useEffect(() => {
    if (loading || error) return;

    const handle = (message: ToWeb) => {
      switch (message.type) {
        case 'init':
        case 'setNeighborhood':
          setNeighborhood(message.neighborhood);
          break;
        default:
          // 아직 구현하지 않은 메시지. 모르는 type과 마찬가지로 무시한다.
          log('info', `미구현 메시지 무시: ${message.type}`);
      }
    };

    const unregister = registerReceiver(handle);
    send({ type: 'ready' });
    if (!isInApp()) window.__tikitaka?.receive(MOCK_INIT);
    return unregister;
  }, [loading, error]);

  if (!neighborhood) return null;
  return <MapScreen neighborhood={neighborhood} />;
}
