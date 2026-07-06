// Lightweight activity tracker.
// Buffers events client-side and flushes them in batches every 30s
// (and immediately on page hide / unload) to a single Edge Function call.
// Designed to be near-zero overhead — never blocks user actions.

import { supabase } from '@/integrations/supabase/client';

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

const FUNCTION_URL = `${(supabase as any).supabaseUrl}/functions/v1/manage-users`;
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
}

export async function flushNow(useBeacon = false): Promise<void> {
  if (!sessionToken || queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  const body = JSON.stringify({
    action: 'log_activity_batch',
    session_token: sessionToken,
    events: batch,
  });

  try {
    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon with a Blob preserves Content-Type and survives unload.
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(FUNCTION_URL, blob);
      if (ok) return;
    }
    await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': (supabase as any).supabaseKey,
      },
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
