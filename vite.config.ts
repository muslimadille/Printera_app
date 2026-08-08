import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const BRAND_THEME = "#2563eb"; // hsl(221 83% 53%)
/** Must be a RegExp (not a closed-over helper) — Workbox serializes this into the SW. */
const API_V1_PATTERN = /\/api\/v1(?:\/|$)/;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      // In normal DEV, ship a self-destroying SW so leftover /dev-sw.js registrations
      // (broken Workbox + dual React) tear themselves down. Full PWA: VITE_PWA_DEV=1.
      selfDestroying:
        mode === "development" && process.env.VITE_PWA_DEV !== "1",
      devOptions: {
        enabled: mode === "development",
        type: "module",
      },
      includeAssets: [
        "favicon.png",
        "icons/pwa-192.png",
        "icons/pwa-512.png",
        "icons/pwa-512-maskable.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        id: "/app",
        name: "حاسبة تكلفة الطباعة الذكية",
        short_name: "Printera",
        description: "احسب تكاليف الطباعة في أقل من 30 ثانية — مع العمل دون اتصال",
        lang: "ar",
        dir: "rtl",
        start_url: "/app",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: BRAND_THEME,
        background_color: BRAND_THEME,
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/app/],
        // Never let the SW claim Vite internals / HMR / API — dual-React + stale deps otherwise.
        navigateFallbackDenylist: [/^\/api/, /^\/@/, /^\/src\//, /^\/node_modules\//],
        // App shell + icons. Large template SVG catalogs stay on CacheFirst runtime, not precache.
        globPatterns: ["**/*.{js,css,html,ico,png,woff2,webp}"],
        globIgnores: ["**/templates/**", "**/pdf.worker*", "**/node_modules/**"],
        // App shell: precache (above) + SWR for navigations / HTML
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !url.pathname.startsWith("/api") &&
              !url.pathname.startsWith("/@") &&
              !url.pathname.startsWith("/src/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "printera-navigations",
            },
          },
          {
            // Built hashed assets only — NEVER cache Vite optimized deps / HMR
            // (stale react vs fresh react-dom → "Invalid hook call").
            urlPattern: ({ request, url }) => {
              if (request.destination !== "script" && request.destination !== "style") return false;
              const p = url.pathname;
              if (p.includes("/node_modules/.vite/")) return false;
              if (p.startsWith("/@") || p.startsWith("/src/")) return false;
              if (p.includes("vite/client") || p.includes("@react-refresh")) return false;
              return true;
            },
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "printera-assets",
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com" ||
              url.hostname.endsWith("cdnjs.cloudflare.com"),
            handler: "CacheFirst",
            options: {
              cacheName: "printera-fonts-cdn",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === "image" ||
              url.pathname.endsWith(".svg") ||
              url.pathname.endsWith(".png") ||
              url.pathname.endsWith(".webp") ||
              url.pathname.endsWith(".jpg"),
            handler: "CacheFirst",
            options: {
              cacheName: "printera-images",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Authenticated API — NEVER cache responses / JWT.
          // BackgroundSyncPlugin (via workbox backgroundSync option) replays
          // failed mutations on Chromium/Android even if the tab is closed.
          // iOS Safari has no Background Sync → app-level outbox drain is the fallback.
          {
            urlPattern: API_V1_PATTERN,
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: API_V1_PATTERN,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "printera-mutations-post",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: API_V1_PATTERN,
            handler: "NetworkOnly",
            method: "PUT",
            options: {
              backgroundSync: {
                name: "printera-mutations-put",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: API_V1_PATTERN,
            handler: "NetworkOnly",
            method: "PATCH",
            options: {
              backgroundSync: {
                name: "printera-mutations-patch",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: API_V1_PATTERN,
            handler: "NetworkOnly",
            method: "DELETE",
            options: {
              backgroundSync: {
                name: "printera-mutations-delete",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force a single React instance (PWA/SW + lazy chunks can otherwise dual-load).
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime.js"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
