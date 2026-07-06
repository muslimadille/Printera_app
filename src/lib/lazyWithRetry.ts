import { lazy, ComponentType } from 'react';

// Wraps React.lazy to recover from "Failed to fetch dynamically imported module"
// errors caused by stale chunk hashes after a new deploy. Retries once after a
// short delay; if still failing, forces a hard reload (one-shot via sessionStorage
// flag to avoid an infinite reload loop).
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const RELOAD_KEY = 'printCalc_chunkReloaded';
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkErr = /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg);
      if (!isChunkErr) throw err;

      // Retry once after short delay (covers transient network blips).
      try {
        await new Promise(r => setTimeout(r, 400));
        return await factory();
      } catch (err2) {
        // Stale build — force a one-time hard reload.
        try {
          if (!sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, '1');
            window.location.reload();
            // Return a never-resolving promise to suspend until reload happens.
            return await new Promise<{ default: T }>(() => {});
          }
        } catch {}
        throw err2;
      }
    }
  });
}
