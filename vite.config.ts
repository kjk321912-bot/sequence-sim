/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages 저장소 경로 (https://kjk321912-bot.github.io/sequence-sim/)
const BASE = '/sequence-sim/'

export default defineConfig({
  base: BASE,
  build: {
    // 캔버스 라이브러리(Konva)가 커서 경고 기준을 올린다. 오프라인 앱이라 어차피 전부 미리 캐시한다.
    chunkSizeWarningLimit: 900,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '시퀀스 회로 시뮬레이터',
        short_name: '시퀀스시뮬',
        description: '시퀀스 제어 실습용 회로 시뮬레이터',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1419',
        theme_color: '#0f1419',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // 실습실 오프라인 사용: 앱 전체를 미리 캐시
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
