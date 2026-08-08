/**
 * Offline mutation outbox (IndexedDB via idb-keyval).
 *
 * Mirrors activityTracker philosophy: never block the user; queue + flush later.
 *
 * Drain layers:
 *  (a) App-level (all browsers, required on iOS): online / focus / periodic.
 *  (b) SW-level (Chromium/Android): Workbox BackgroundSyncPlugin on mutation
 *      routes + sync tag `printera-outbox` to wake clients when possible.
 *
 * Auth: replay with the CURRENT JWT. On 401/session_expired → pause (never drop).
 * User scoping: every op is tagged with userId; never replay under another session.
 */

import { createStore, get, set, clear as idbClear } from 'idb-keyval';
import { getToken } from '@/lib/apiClient';

export type OutboxOpType = 'saveQuote' | 'updateQuote' | 'deleteQuote' | 'saveUserSettings';

export interface OutboxOp {
  id: string;
  type: OutboxOpType;
  /** Payload needed to replay the real API call */
  payload: Record<string, unknown>;
  userId: string;
  createdAt: string;
  /** Coalesce key: quote id / clientQuoteId / 'settings' */
  entityKey: string;
  /** Temp id for offline-created quotes (`local_…`) */
  clientQuoteId?: string;
}

export interface PendingQuoteRecord {
  quote: {
    id: string;
    user_id: string;
    title: string;
    customer_name: string;
    quote_number: string;
    source_type: string;
    quote_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    pendingSync?: boolean;
  };
  userId: string;
}

const hasIndexedDb = typeof indexedDB !== 'undefined';
const db = hasIndexedDb ? createStore('printera-pwa', 'outbox-v1') : undefined;
/** In-memory fallback for jsdom / environments without IndexedDB (tests). */
const memory = new Map<string, unknown>();

const OPS_KEY = 'ops';
const PAUSED_KEY = 'paused';
const PENDING_QUOTES_KEY = 'pendingQuotes';
const ID_MAP_KEY = 'clientIdMap'; // local_* → server id after successful create

const DRAIN_INTERVAL_MS = 45_000;
const SYNC_TAG = 'printera-outbox';

async function idbGet<T>(key: string): Promise<T | undefined> {
  if (!db) return memory.get(key) as T | undefined;
  return get<T>(key, db);
}

async function idbSet(key: string, value: unknown): Promise<void> {
  if (!db) {
    memory.set(key, value);
    return;
  }
  await set(key, value, db);
}

async function idbClearAll(): Promise<void> {
  if (!db) {
    memory.clear();
    return;
  }
  await idbClear(db);
}

type CountListener = (count: number) => void;
type PauseListener = (paused: boolean) => void;

const countListeners = new Set<CountListener>();
const pauseListeners = new Set<PauseListener>();

let installed = false;
let draining = false;
let drainTimer: number | null = null;

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const msg = String((err as { message?: string })?.message || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(msg);
}

export function isAuthError(err: unknown): boolean {
  return !!(err as { session_expired?: boolean })?.session_expired;
}

/** Lightweight uid written on every login (Remember Me optional). */
export const SESSION_UID_KEY = 'printCalc_uid';

export function getSessionUserId(): string | null {
  try {
    const uid = localStorage.getItem(SESSION_UID_KEY);
    if (uid) return uid;
    const raw = localStorage.getItem('printCalc_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Index persists `{ id, username, session_token, ... }` (not nested `.user`).
    return parsed?.id || parsed?.user?.id || parsed?.user_id || null;
  } catch {
    return null;
  }
}

export function setSessionUserId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_UID_KEY, userId);
    else localStorage.removeItem(SESSION_UID_KEY);
  } catch { /* */ }
}

async function readOps(): Promise<OutboxOp[]> {
  return (await idbGet<OutboxOp[]>(OPS_KEY)) || [];
}

async function writeOps(ops: OutboxOp[]): Promise<void> {
  await idbSet(OPS_KEY, ops);
  notifyCount(ops.length);
}

function notifyCount(n: number) {
  countListeners.forEach((l) => l(n));
}

function notifyPaused(p: boolean) {
  pauseListeners.forEach((l) => l(p));
}

export function subscribeOutboxCount(listener: CountListener): () => void {
  countListeners.add(listener);
  void getOutboxCount().then(listener);
  return () => {
    countListeners.delete(listener);
  };
}

export function subscribeOutboxPaused(listener: PauseListener): () => void {
  pauseListeners.add(listener);
  void isOutboxPaused().then(listener);
  return () => {
    pauseListeners.delete(listener);
  };
}

export async function getOutboxCount(): Promise<number> {
  const ops = await readOps();
  const userId = getSessionUserId();
  if (!userId) return ops.length;
  return ops.filter((o) => o.userId === userId).length;
}

export async function isOutboxPaused(): Promise<boolean> {
  return !!(await idbGet<boolean>(PAUSED_KEY));
}

export async function setOutboxPaused(paused: boolean): Promise<void> {
  await idbSet(PAUSED_KEY, paused);
  notifyPaused(paused);
}

/** Coalesce create+update, cancel create+delete, keep latest settings. */
export function coalesceOps(ops: OutboxOp[], incoming: OutboxOp): OutboxOp[] {
  const next = [...ops];

  if (incoming.type === 'saveUserSettings') {
    const idx = next.findIndex(
      (o) => o.type === 'saveUserSettings' && o.userId === incoming.userId,
    );
    if (idx >= 0) {
      const prev = next[idx];
      const prevSettings = (prev.payload.settings as { key: string; value: unknown }[]) || [];
      const incSettings = (incoming.payload.settings as { key: string; value: unknown }[]) || [];
      const map = new Map(prevSettings.map((s) => [s.key, s.value]));
      incSettings.forEach((s) => map.set(s.key, s.value));
      next[idx] = {
        ...incoming,
        id: prev.id,
        createdAt: prev.createdAt,
        payload: {
          ...incoming.payload,
          settings: Array.from(map.entries()).map(([key, value]) => ({ key, value })),
        },
      };
      return next;
    }
    next.push(incoming);
    return next;
  }

  const key = incoming.entityKey;
  if (incoming.type === 'deleteQuote') {
    const createIdx = next.findIndex(
      (o) =>
        o.userId === incoming.userId &&
        o.type === 'saveQuote' &&
        (o.entityKey === key || o.clientQuoteId === key || o.payload.clientQuoteId === key),
    );
    if (createIdx >= 0) {
      // Not-yet-synced create + delete → cancel both; drop updates for same entity.
      const clientId = next[createIdx].clientQuoteId || key;
      return next.filter(
        (o) =>
          !(
            o.userId === incoming.userId &&
            (o.entityKey === key ||
              o.entityKey === clientId ||
              o.clientQuoteId === clientId ||
              o.payload.clientQuoteId === clientId)
          ),
      );
    }
    // Drop prior updates for this quote; keep a single delete.
    const filtered = next.filter(
      (o) =>
        !(
          o.userId === incoming.userId &&
          (o.type === 'updateQuote' || o.type === 'deleteQuote') &&
          o.entityKey === key
        ),
    );
    filtered.push(incoming);
    return filtered;
  }

  if (incoming.type === 'updateQuote') {
    const createIdx = next.findIndex(
      (o) =>
        o.userId === incoming.userId &&
        o.type === 'saveQuote' &&
        (o.entityKey === key || o.clientQuoteId === key),
    );
    if (createIdx >= 0) {
      const create = next[createIdx];
      const mergedParams = {
        ...(create.payload.params as Record<string, unknown>),
        ...(incoming.payload.params as Record<string, unknown>),
      };
      next[createIdx] = {
        ...create,
        payload: { ...create.payload, params: mergedParams },
      };
      return next;
    }
    const updIdx = next.findIndex(
      (o) => o.userId === incoming.userId && o.type === 'updateQuote' && o.entityKey === key,
    );
    if (updIdx >= 0) {
      next[updIdx] = { ...incoming, id: next[updIdx].id, createdAt: next[updIdx].createdAt };
      return next;
    }
  }

  next.push(incoming);
  return next;
}

export async function enqueueOp(
  partial: Omit<OutboxOp, 'id' | 'createdAt'> & { id?: string },
): Promise<OutboxOp> {
  const op: OutboxOp = {
    id: partial.id || uuid(),
    createdAt: new Date().toISOString(),
    type: partial.type,
    payload: partial.payload,
    userId: partial.userId,
    entityKey: partial.entityKey,
    clientQuoteId: partial.clientQuoteId,
  };
  const ops = coalesceOps(await readOps(), op);
  await writeOps(ops);
  await requestBackgroundSync();
  return op;
}

async function requestBackgroundSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    // Chromium/Android only — iOS ignores SyncManager.
    const syncManager = (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } })
      ?.sync;
    if (syncManager) await syncManager.register(SYNC_TAG);
  } catch {
    /* unsupported or permission — app-level drain covers this */
  }
}

export async function readPendingQuotes(userId?: string | null): Promise<PendingQuoteRecord[]> {
  const all = (await idbGet<PendingQuoteRecord[]>(PENDING_QUOTES_KEY)) || [];
  if (!userId) return all;
  return all.filter((p) => p.userId === userId);
}

export async function upsertPendingQuote(record: PendingQuoteRecord): Promise<void> {
  const all = (await idbGet<PendingQuoteRecord[]>(PENDING_QUOTES_KEY)) || [];
  const idx = all.findIndex((p) => p.quote.id === record.quote.id && p.userId === record.userId);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await idbSet(PENDING_QUOTES_KEY, all);
}

export async function removePendingQuote(quoteId: string, userId: string): Promise<void> {
  const all = (await idbGet<PendingQuoteRecord[]>(PENDING_QUOTES_KEY)) || [];
  await idbSet(
    PENDING_QUOTES_KEY,
    all.filter((p) => !(p.quote.id === quoteId && p.userId === userId)),
  );
}

async function readIdMap(): Promise<Record<string, string>> {
  return (await idbGet<Record<string, string>>(ID_MAP_KEY)) || {};
}

async function mapClientId(localId: string, serverId: string): Promise<void> {
  const map = await readIdMap();
  map[localId] = serverId;
  await idbSet(ID_MAP_KEY, map);
}

export async function resolveQuoteId(id: string): Promise<string> {
  const map = await readIdMap();
  return map[id] || id;
}

type ReplayFns = {
  saveQuote: (token: string, params: any) => Promise<any>;
  updateQuote: (token: string, quoteId: string, params: any) => Promise<any>;
  deleteQuote: (token: string, quoteId: string) => Promise<any>;
  saveUserSettings: (token: string, userId: string, settings: any[]) => Promise<any>;
};

let replayFns: ReplayFns | null = null;

/** Avoid circular import: userApi registers real (unwrapped) replay implementations. */
export function registerOutboxReplay(fns: ReplayFns) {
  replayFns = fns;
}

export async function drainOutbox(): Promise<number> {
  if (draining) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  if (await isOutboxPaused()) return 0;

    const userId = getSessionUserId();
  const token = getToken();
  if (!userId || !token || !replayFns) return 0;

  draining = true;
  let synced = 0;

  try {
    const ops = await readOps();
    const queue = ops.filter((o) => o.userId === userId);

    for (const op of queue) {
      try {
        await replayOne(op, token, userId);
        const remaining = await readOps();
        await writeOps(remaining.filter((o) => o.id !== op.id));
        synced += 1;
      } catch (err) {
        if (isAuthError(err)) {
          await setOutboxPaused(true);
          try {
            window.dispatchEvent(new CustomEvent('printCalc:outboxPaused', { detail: { reason: 'auth' } }));
          } catch { /* */ }
          break;
        }
        if (isNetworkError(err)) break;
        // Business error: drop this op so the queue isn't wedged (log for support).
        console.warn('[outbox] dropping op after business error', op.type, err);
        const remaining = await readOps();
        await writeOps(remaining.filter((o) => o.id !== op.id));
      }
    }

    if (synced > 0) {
      try {
        window.dispatchEvent(new CustomEvent('printCalc:outboxSynced', { detail: { count: synced } }));
      } catch { /* */ }
    }
  } finally {
    draining = false;
  }

  return synced;
}

async function replayOne(op: OutboxOp, token: string, userId: string) {
  if (!replayFns) throw new Error('outbox replay not registered');

  switch (op.type) {
    case 'saveQuote': {
      const params = op.payload.params as {
        title: string;
        customer_name: string;
        quote_number: string;
        source_type: string;
        quote_data: Record<string, unknown>;
      };
      const quote = await replayFns.saveQuote(token, params);
      const localId = op.clientQuoteId || (op.payload.clientQuoteId as string | undefined);
      if (localId && quote?.id) {
        await mapClientId(localId, quote.id);
        await removePendingQuote(localId, userId);
      }
      return quote;
    }
    case 'updateQuote': {
      let quoteId = op.payload.quoteId as string;
      quoteId = await resolveQuoteId(quoteId);
      const params = op.payload.params;
      const quote = await replayFns.updateQuote(token, quoteId, params);
      await removePendingQuote(op.entityKey, userId);
      return quote;
    }
    case 'deleteQuote': {
      let quoteId = op.payload.quoteId as string;
      quoteId = await resolveQuoteId(quoteId);
      if (quoteId.startsWith('local_')) {
        await removePendingQuote(quoteId, userId);
        return { success: true };
      }
      const r = await replayFns.deleteQuote(token, quoteId);
      await removePendingQuote(quoteId, userId);
      return r;
    }
    case 'saveUserSettings': {
      const settings = op.payload.settings as { key: string; value: unknown }[];
      return replayFns.saveUserSettings(token, userId, settings);
    }
    default:
      return null;
  }
}

/** Clear user-scoped caches on logout; keep outbox ops (tagged by userId). */
export async function onUserLogout(): Promise<void> {
  await setOutboxPaused(false);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.includes('api') || k.includes('user'))
          .map((k) => caches.delete(k)),
      );
    }
  } catch { /* */ }
}

/** Full wipe (tests / reset). */
export async function clearOutboxStore(): Promise<void> {
  await idbClearAll();
  notifyCount(0);
  notifyPaused(false);
}

export function installOutboxListeners(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const kick = () => {
    void drainOutbox();
  };

  window.addEventListener('online', kick);
  window.addEventListener('focus', kick);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick();
  });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'DRAIN_OUTBOX' || event.data?.type === 'SYNC_OUTBOX') kick();
  });

  drainTimer = window.setInterval(kick, DRAIN_INTERVAL_MS);
  // Resume after login / boot.
  void (async () => {
    if (getToken() && getSessionUserId()) {
      await setOutboxPaused(false);
      kick();
    }
  })();
}

export function markEngagementForInstall(kind: 'visit' | 'save' | 'calc' = 'visit'): void {
  try {
    const KEY = 'printCalc_pwa_engagement';
    const raw = localStorage.getItem(KEY);
    const state = raw ? JSON.parse(raw) : { visits: 0, saves: 0, calcs: 0 };
    if (kind === 'visit') state.visits = (state.visits || 0) + 1;
    if (kind === 'save') state.saves = (state.saves || 0) + 1;
    if (kind === 'calc') state.calcs = (state.calcs || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('printCalc:pwaEngagement', { detail: state }));
  } catch { /* */ }
}

export function getEngagement(): { visits: number; saves: number; calcs: number } {
  try {
    const raw = localStorage.getItem('printCalc_pwa_engagement');
    return raw ? JSON.parse(raw) : { visits: 0, saves: 0, calcs: 0 };
  } catch {
    return { visits: 0, saves: 0, calcs: 0 };
  }
}
