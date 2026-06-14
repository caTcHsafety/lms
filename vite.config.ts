import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],  // Don't include missing assets
      manifest: {
        name: 'SafetyCatch Enterprise LMS',
        short_name: 'SafetyCatch',
        description: 'Offline-capable enterprise LMS',
        theme_color: '#0D2543',
        icons: []  // Remove icon references for now
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['/sw-offline.js'],  // Re-added: conflict was from duplicate index.html entries, not this
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        // REMOVED: additionalManifestEntries - was causing duplicate entry conflict
        runtimeCaching: [
          {
            // Cache ALL navigation requests (HTML documents)
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 3
            }
          },
          {
            // Cache Supabase PostgREST API calls (metadata: courses, modules, profiles)
            // but NOT storage file downloads (those are only cached via explicit download)
            urlPattern: /^https:\/\/svzhmehbgburktnuzfov\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-metadata',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache Supabase auth token refresh
            urlPattern: /^https:\/\/svzhmehbgburktnuzfov\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    proxy: {
      // Proxy /scorm-proxy/* to R2 during development (SW handles this in production)
      '/scorm-proxy/': {
        target: 'https://pub-b98d83e63e884247aed6314345f7f167.r2.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scorm-proxy\//, '/content/'),
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
