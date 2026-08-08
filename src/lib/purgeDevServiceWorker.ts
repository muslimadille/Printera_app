/**
 * Development-only: kill leftover VitePWA service workers + Cache Storage.
 * A stale SW (e.g. after toggling PWA on/off) caches mixed React optimizeDeps
 * hashes and surfaces as "Invalid hook call" / null useState.
 */
export async function purgeDevServiceWorker(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_PWA_DEV === "1") return;
  if (!("serviceWorker" in navigator)) return;

  const FLAG = "printera:dev-sw-purged-v2";
  const regs = await navigator.serviceWorker.getRegistrations();
  let changed = false;

  for (const reg of regs) {
    const ok = await reg.unregister();
    if (ok) changed = true;
  }

  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    if (keys.length > 0) changed = true;
  }

  // Drop controller mid-flight if still claiming the page.
  if (navigator.serviceWorker.controller) {
    changed = true;
  }

  if (changed && !sessionStorage.getItem(FLAG)) {
    sessionStorage.setItem(FLAG, "1");
    location.reload();
    // Prevent React from mounting against half-cached modules.
    await new Promise<never>(() => {});
  }
}
