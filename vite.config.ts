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
        name: 'Rov — Date Itinerary Planner',
        short_name: 'Rov',
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
        // New deploys take over immediately so users never get trapped on a
        // stale JS bundle (this was causing the app to hang on old code).
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Cache the app shell for offline reopening.
        navigateFallback: '/index.html',
        // Never let the SW handle navigations to API/function paths.
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/auth\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
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
        // IMPORTANT: do not cache or intercept Supabase API/function/auth calls.
        // These must always hit the network so generation never uses stale data.
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
