import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // VITE_ variables live in the single .env at the repository root.
  envDir: path.resolve(here, '../..'),

  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
    },
  },

  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Offline strategy and generated PNG icons land in phase 8; this is enough
      // to make the app installable and to keep the plumbing in place.
      manifest: {
        name: 'FutCheck',
        short_name: 'FutCheck',
        description: 'Check-in para aulas e dayuse de futevôlei',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Cache the app shell.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],

  server: {
    port: 5173,
    strictPort: true,
    // Listen on the LAN too, so the app can be opened from a phone on the same
    // Wi-Fi — which is how this product is actually used.
    host: true,

    /**
     * The API is proxied under the app's own origin in development.
     *
     * Without this the app is on :5173 and the API on :3333, which are different
     * sites: the browser then refuses to keep the httpOnly refresh cookie, and
     * the session silently dies on every reload. Proxying makes them one origin,
     * which is also how they are deployed.
     */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: false,
      },
    },
  },

  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
