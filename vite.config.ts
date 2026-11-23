import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 게시글 공유 페이지(share.html)는 지도와 별도 진입점이다. vercel.json이 `/p/:postId`를 이 파일로 보낸다.
const API_ORIGIN = 'https://api.raon-tikitaka.shop';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        share: resolve(import.meta.dirname, 'share.html'),
      },
    },
  },
  server: {
    // 운영은 vercel.json rewrite가 같은 출처로 프록시한다. 로컬도 같은 경로로 맞춰 CORS 없이 부른다.
    proxy: {
      '/api/post': { target: API_ORIGIN, changeOrigin: true },
    },
  },
});
