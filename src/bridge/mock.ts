import type { ToWeb } from './bridge';

/** 앱 없이 브라우저에서 열었을 때 RN 대신 보내는 init. 개발용이며 운영에서도 해가 없다. */
export const MOCK_INIT: Extract<ToWeb, { type: 'init' }> = {
  v: 1,
  type: 'init',
  neighborhood: {
    locationId: 1,
    cityName: '부산광역시',
    name: '북구',
  },
  characters: [],
  partUrls: {},
};
