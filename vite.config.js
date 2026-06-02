import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // base './' per Capacitor (asset con path relativi), '/' per web/Vercel
  base: mode === 'mobile' ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',        // chiede all'utente prima di aggiornare
      includeAssets: ['favicon.svg', 'pwa-192.svg', 'pwa-512.svg'],
      manifest: {
        name: 'CalcioLab — Coach Platform',
        short_name: 'CalcioLab',
        description: 'Gestione squadra di calcio: rosa, allenamenti, partite, statistiche e molto altro.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Pagina offline custom servita quando la rete non è disponibile
        navigateFallback: '/offline.html',
        // Escludi la pagina offline dal fallback normale (solo per navigazione, non asset)
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        // Cache-first per tutti gli asset statici (JS/CSS/font/immagini).
        // offline.html e gia incluso da globPatterns: aggiungerlo anche a
        // additionalManifestEntries crea conflitti Workbox nel precache.
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        // Dimensione massima file in cache: 5MB (catalogo esercizi è ~700KB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // Supabase API → network-first, fallback cache 1h
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 ora
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts (se aggiunte in futuro)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Abilita service worker anche in dev (per testare)
        enabled: false,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    // Source maps in produzione — disabilitare per build store finale (privacy)
    sourcemap: false,
    rollupOptions: {
      output: {
        // Nomi file deterministici per migliore caching HTTP
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
        manualChunks(id) {
          // ── Dati statici pesanti ──────────────────────────────────────────
          if (id.includes('src/data/eserciziarioFp5.js')) {
            return 'catalogo-fp5';
          }

          if (!id.includes('node_modules')) return;

          // ── Supabase ──────────────────────────────────────────────────────
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }

          // ── React core ────────────────────────────────────────────────────
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router')
          ) {
            return 'vendor-react';
          }

          // ── Grafici (recharts) ─────────────────────────────────────────────
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'vendor-charts';
          }

          // ── PDF (jspdf) ───────────────────────────────────────────────────
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'vendor-pdf';
          }

          // ── Drag & Drop ───────────────────────────────────────────────────
          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }

          // ── Icone ─────────────────────────────────────────────────────────
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // ── Capacitor ────────────────────────────────────────────────────
          if (id.includes('@capacitor')) {
            return 'vendor-capacitor';
          }
        },
      },
    },
  },
}))
