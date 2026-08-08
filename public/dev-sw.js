/* Self-destroying stand-in for leftover VitePWA /dev-sw.js registrations.
 * Clears Workbox caches that mixed React optimizeDeps hashes (Invalid hook call).
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        if ("navigate" in client) {
          try {
            client.navigate(client.url);
          } catch (_) {
            /* ignore */
          }
        }
      }
    })()
  );
});
