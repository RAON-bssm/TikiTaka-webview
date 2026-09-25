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
  characters: [
    {
      id: 'mock-1',
      name: '티키',
      kind: 'npc',
      config: {
        body: 'body02',
        eyes: 'eyes01',
        eyesColor: 'orange',
        mouth: 'mouth01',
        hairBack: 'long',
        hairFront: 'basic',
        hairColor: 'black',
        clothing: 'clothing01',
      },
    },
    {
      id: 'mock-2',
      name: '타카',
      kind: 'npc',
      config: {
        body: 'body01',
        eyes: 'eyes01',
        eyesColor: 'sky',
        mouth: 'mouth02',
        hairBack: 'bob',
        hairFront: 'basic',
        hairColor: 'pink',
        clothing: 'clothing03',
        accessory: 'red-glasses-hair-pin',
      },
    },
    {
      id: 'mock-3',
      name: '토코',
      kind: 'npc',
      config: {
        body: 'body02',
        eyes: 'eyes01',
        eyesColor: 'green',
        mouth: 'mouth01',
        hairBack: 'puff',
        hairFront: 'basic',
        hairColor: 'brown',
        clothing: 'clothing05',
        accessory: 'glasses',
      },
    },
  ],
  partUrls: {},
};
