import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Flow — Date Itinerary Planner',
        short_name: 'Flow',
        description: 'Plan a multi-stop date worth going out for.',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the app shell for offline reopening.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Cache the most recently opened Date Pass payloads (RPC GET).
            urlPattern: ({ url }) => url.pathname.includes('/rest/v1/rpc/get_date_pass'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'flow-date-pass',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Map tiles / style — cache-first, they are static assets.
            urlPattern: ({ url }) =>
              url.hostname.includes('openfreemap') || url.hostname.includes('maplibre'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'flow-map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Route-level code splitting keeps decorative/map code out of the initial bundle.
    target: 'es2020',
    sourcemap: false,
  },
})
