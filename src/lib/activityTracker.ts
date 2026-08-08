// Lightweight activity tracker.
// Buffers events client-side and flushes them in batches every 30s
// (and immediately on page hide / unload) in a single request.
// Designed to be near-zero overhead — never blocks user actions.

import { API_BASE_URL } from '@/lib/apiClient';

export type ActivityAction =
  | 'tab_open'
  | 'calculate'
  | 'save_quote'
  | 'update_quote'
  | 'delete_quote'
  | 'export_pdf'
  | 'export_excel'
  | 'import_excel'
  | 'settings_change'
  | 'voice_input'
  | 'upload_attachment'
  | 'input_change';

interface QueuedEvent {
  tab_key?: string | null;
  action: ActivityAction;
  details?: Record<string, any>;
  occurred_at: string;
}

const BATCH_URL = `${API_BASE_URL}/activity/batch`;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 200;

let sessionToken: string | null = null;
let queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let installed = false;

export function setActivitySession(token: string | null) {
  sessionToken = token;
  if (token) ensureInstalled();
}

function ensureInstalled() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  flushTimer = window.setInterval(flushNow, FLUSH_INTERVAL_MS);

  // Flush when the tab is being hidden or closed.
  const flushOnHide = () => { void flushNow(true); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });
  window.addEventListener('pagehide', flushOnHide);
  window.addEventListener('beforeunload', flushOnHide);
}

export function trackActivity(
  action: ActivityAction,
  tabKey?: string | null,
  details?: Record<string, any>,
) {
  if (!sessionToken) return;
  if (queue.length >= MAX_QUEUE) {
    // Drop oldest to keep memory bounded.
    queue.shift();
  }
  queue.push({
    tab_key: tabKey || null,
    action,
    details: details || {},
    occurred_at: new Date().toISOString(),
  });
  // Light engagement signal for the PWA install prompt (non-blocking).
  if (action === 'calculate' || action === 'save_quote') {
    void import('@/lib/outbox')
      .then((m) => m.markEngagementForInstall(action === 'calculate' ? 'calc' : 'save'))
      .catch(() => undefined);
  }
}

export async function flushNow(useBeacon = false): Promise<void> {
  if (!sessionToken || queue.length === 0) return;
  const batch = queue.splice(0, queue.length);

  // The token travels in the BODY, not an Authorization header, because sendBeacon cannot
  // set headers. /activity/batch is the one authenticated-in-spirit route outside the
  // session middleware for exactly that reason, and it answers 200 even for a dead
  // session so a flush on unload can never surface an error. See BE-025.
  const body = JSON.stringify({
    session_token: sessionToken,
    events: batch,
  });

  try {
    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon with a Blob preserves Content-Type and survives unload.
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(BATCH_URL, blob);
      if (ok) return;
    }
    await fetch(BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch (e) {
    // Re-queue on failure (cap to MAX_QUEUE).
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
  }
}

export function clearActivityQueue() {
  queue = [];
}
