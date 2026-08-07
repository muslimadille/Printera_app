// The single seam between the SPA and the backend.
//
// Everything used to be `POST {SUPABASE_URL}/functions/v1/manage-users` with an
// `{ action, ... }` envelope and an `apikey` header. It is now REST under
// `VITE_API_BASE_URL` with a `Authorization: Bearer <jwt>` header. What did NOT change is
// the error contract the whole UI is built on, so `parseApiResponse` below is a verbatim
// carry-over from userApi.ts:
//
//   business error → HTTP 200 with { error }        → thrown as an Error
//   auth failure   → 401 / { session_expired:true } → thrown AND dispatches
//                                                     `printCalc:sessionExpired`
//   device limit   → { device_limit_reached, active_sessions, max_devices }
//
// See docs/backend-laravel/03-API-SPECIFICATION.md §1.

const RAW_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * Trailing slashes trimmed so `${API_BASE_URL}/auth/login` never doubles up. Falls back to
 * a same-origin path, which is what a deployment serving the API behind the app's own
 * domain wants; set VITE_API_BASE_URL for split hosts (and in dev).
 */
export const API_BASE_URL = (RAW_BASE && RAW_BASE.trim() !== '' ? RAW_BASE.trim() : '/api/v1').replace(/\/+$/, '');

const SESSION_STORAGE_KEY = 'printCalc_session';

// ── the active JWT ─────────────────────────────────────────────────────────────

function readStoredToken(): string | null {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved).session_token || null;
  } catch {
    return null;
  }
}

// Seeded on load so a "Remember me" session survives a refresh: the admin calls carry no
// token argument and rely on this alone.
let authToken: string | null = readStoredToken();

export function setToken(token: string | null) {
  authToken = token || null;
}

export function clearToken() {
  authToken = null;
}

export function getToken(): string | null {
  return authToken;
}

// A 401 anywhere means this token is dead. Listening for the event the error builder
// already dispatches keeps that in one place, instead of every caller remembering to
// clear it — Index.tsx's forceLogout listens to the same event for the UI half.
if (typeof window !== 'undefined') {
  window.addEventListener('printCalc:sessionExpired', () => clearToken());
}

// ── the error contract (unchanged) ─────────────────────────────────────────────

function buildApiError(data: any, status?: number, fallbackMessage = 'حدث خطأ') {
  const err: any = new Error(data?.error || fallbackMessage);
  if (data?.device_limit_reached) {
    err.device_limit_reached = true;
    err.active_sessions = data.active_sessions || [];
    err.max_devices = data.max_devices || 1;
  }
  if (status === 401 || data?.session_expired) {
    err.session_expired = true;
    err.silent = true;
    try { window.dispatchEvent(new Event('printCalc:sessionExpired')); } catch { /* non-browser */ }
  }
  return err;
}

async function parseApiResponse(res: Response) {
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  // Treat session_expired flag as a business error so the UI can cleanly
  // force-logout without a runtime error overlay (per project convention:
  // the backend returns 200 OK with JSON state for business errors).
  if (!res.ok || data.device_limit_reached || data.session_expired || data.error) {
    throw buildApiError(data, data.session_expired ? 401 : res.status);
  }

  return data;
}

// ── requests ───────────────────────────────────────────────────────────────────

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  body?: unknown;
  query?: QueryParams;
  /** Attach the bearer token. Off for the public auth endpoints. */
  auth?: boolean;
  /**
     * Use this token instead of the module-scope one. Every userApi function that already
     * takes a `sessionToken` passes it through, so the header always matches what the
     * caller intended even if the two ever drift.
     */
  token?: string | null;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
  }
  const qs = search.toString();

  return qs ? `${url}?${qs}` : url;
}

function buildInit(method: string, { body, auth = true, token }: RequestOptions): RequestInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };

  if (auth) {
    const bearer = token !== undefined && token !== null ? token : authToken;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  }

  return {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

/** Throws on any business/auth error, exactly as the old callApi did. */
export async function request(method: string, path: string, options: RequestOptions = {}): Promise<any> {
  const res = await fetch(buildUrl(path, options.query), buildInit(method, options));

  return parseApiResponse(res);
}

/**
 * The silent variant, used only by the 60-second heartbeat. It NEVER throws and never
 * dispatches `printCalc:sessionExpired` — the caller decides what an expiry means, which
 * is what lets Index.tsx require two consecutive failures before logging the user out.
 *
 * Same three shapes as before: `{ expired:true }`, `{ network_error:true }`, or the body.
 */
export async function requestSilent(method: string, path: string, options: RequestOptions = {}): Promise<any> {
  try {
    const res = await fetch(buildUrl(path, options.query), buildInit(method, options));

    let data: any = {};
    try { data = await res.json(); } catch { /* empty body */ }

    if (res.status === 401 || data?.session_expired) return { expired: true, error: data?.error };
    if (!res.ok) return { network_error: true, error: data?.error };

    return data;
  } catch (e: any) {
    return { network_error: true, error: e?.message };
  }
}
