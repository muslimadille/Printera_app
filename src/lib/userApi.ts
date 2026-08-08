// Client → backend calls. Every exported signature here is frozen: components pass a
// `sessionToken` (and the admin panel an admin username/password) and this module decides
// how that becomes a request. Phase 6 swapped the transport underneath — the single
// `POST manage-users { action, ... }` envelope became REST under /api/v1 — without any
// component changing.
//
// Action → endpoint mapping: docs/backend-laravel/03-API-SPECIFICATION.md §2.

import { clearToken, request, requestSilent, setToken } from '@/lib/apiClient';
import { trackActivity } from '@/lib/activityTracker';
import {
  enqueueOp,
  getSessionUserId,
  isAuthError,
  isNetworkError,
  markEngagementForInstall,
  readPendingQuotes,
  registerOutboxReplay,
  removePendingQuote,
  resolveQuoteId,
  upsertPendingQuote,
} from '@/lib/outbox';

export interface AppUser {
  id: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  expires_at: string | null;
  created_at: string;
  max_devices: number;
  max_employees: number;
  parent_user_id: string | null;
}

export interface TabPermission {
  tab_key: string;
  is_enabled: boolean;
}

export interface LoginResult {
  success: boolean;
  user: { id: string; username: string; is_admin: boolean; max_employees: number; employees_can_view_quotes: boolean };
  session_token: string;
  tab_permissions: TabPermission[];
  settings: Record<string, any>;
}

export interface SavedQuote {
  id: string;
  user_id: string;
  title: string;
  customer_name: string;
  quote_number: string;
  source_type: string;
  quote_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  employee_username?: string;
  is_parent_quote?: boolean;
  /** Present when saved into the offline outbox and not yet synced */
  pendingSync?: boolean;
}

// Stable per-browser device identifier — prevents creating duplicate sessions for the same device.
function getDeviceId(): string {
  try {
    const KEY = 'printCalc_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(username: string, password: string, deviceInfo?: string): Promise<LoginResult> {
  const data = await request('POST', '/auth/login', {
    auth: false,
    body: { username, password, device_info: deviceInfo, device_id: getDeviceId() },
  });

  // The bearer for every later call. Components keep their own copy in React state and
  // localStorage; this is the one the client sends.
  if (data?.session_token) setToken(data.session_token);

  return data;
}

export async function forceLogin(username: string, password: string, terminateSessionIds: string[], deviceInfo?: string): Promise<LoginResult> {
  const data = await request('POST', '/auth/force-login', {
    auth: false,
    body: {
      username,
      password,
      terminate_session_ids: terminateSessionIds,
      device_info: deviceInfo,
      device_id: getDeviceId(),
    },
  });

  if (data?.session_token) setToken(data.session_token);

  return data;
}

export async function changePassword(username: string, oldPassword: string, newPassword: string) {
  return request('POST', '/auth/change-password', {
    auth: false,
    body: { username, old_password: oldPassword, new_password: newPassword },
  });
}

export async function verifySession(sessionToken: string) {
  // Silent verify — never throws. Returns { expired: true } when the session
  // is no longer valid so the UI can cleanly force-logout.
  return requestSilent('GET', '/auth/me', { token: sessionToken });
}

export async function logoutSession(sessionToken: string) {
  try {
    return await request('POST', '/auth/logout', { token: sessionToken });
  } finally {
    // Even if the round trip fails, this browser is done with the token.
    clearToken();
  }
}

// ── Admin: accounts ───────────────────────────────────────────────────────────
//
// The admin functions still take (adminUsername, adminPassword, …) so the admin panel
// compiles untouched, but the password is now IGNORED: /admin/* is gated by the logged-in
// admin's own JWT (BE-040), which replaced the old verifyAdmin-per-request pattern. The
// arguments are kept only as a signature contract and are removed in Phase 8.

export async function listUsers(adminUsername: string, adminPassword: string): Promise<AppUser[]> {
  const data = await request('GET', '/admin/users');
  return data.users;
}

export async function createUser(
  adminUsername: string,
  adminPassword: string,
  params: { username: string; password: string; is_admin?: boolean; expires_at?: string | null; max_devices?: number; max_employees?: number }
) {
  return request('POST', '/admin/users', { body: params });
}

export async function updateUser(
  adminUsername: string,
  adminPassword: string,
  params: { user_id: string; username?: string; password?: string; is_active?: boolean; is_admin?: boolean; expires_at?: string | null; max_devices?: number; max_employees?: number }
) {
  const { user_id, ...changes } = params;
  return request('PATCH', `/admin/users/${user_id}`, { body: changes });
}

export async function deleteUser(adminUsername: string, adminPassword: string, userId: string) {
  return request('DELETE', `/admin/users/${userId}`);
}

// ── Employee management (by an account owner) ─────────────────────────────────

export async function createEmployee(
  sessionToken: string,
  params: { username: string; password: string; max_devices?: number }
) {
  return request('POST', '/employees', { token: sessionToken, body: params });
}

export async function listEmployees(sessionToken: string): Promise<AppUser[]> {
  const data = await request('GET', '/employees', { token: sessionToken });
  return data.employees;
}

export async function updateEmployee(
  sessionToken: string,
  params: { user_id: string; username?: string; password?: string; is_active?: boolean; max_devices?: number }
) {
  const { user_id, ...changes } = params;
  return request('PATCH', `/employees/${user_id}`, { token: sessionToken, body: changes });
}

export async function deleteEmployee(sessionToken: string, userId: string, transferTo?: string) {
  return request('DELETE', `/employees/${userId}`, {
    token: sessionToken,
    query: { transfer_to: transferTo || undefined },
  });
}

export async function checkEmployeeQuotes(sessionToken: string, userId: string): Promise<{ count: number }> {
  return request('GET', `/employees/${userId}/quotes-count`, { token: sessionToken });
}

export async function getEmployeeTabPermissions(sessionToken: string, userId: string): Promise<TabPermission[]> {
  const data = await request('GET', `/employees/${userId}/tab-permissions`, { token: sessionToken });
  return data.permissions;
}

export async function updateEmployeeTabPermissions(sessionToken: string, userId: string, permissions: TabPermission[]) {
  return request('PUT', `/employees/${userId}/tab-permissions`, { token: sessionToken, body: { permissions } });
}

export async function toggleEmployeesViewQuotes(sessionToken: string, enabled: boolean) {
  return request('POST', '/account/employees-view-quotes', { token: sessionToken, body: { enabled } });
}

// ── Admin: login logs ─────────────────────────────────────────────────────────

export interface LoginLog {
  id: string;
  user_id: string;
  username: string;
  logged_in_at: string;
  ip_address: string | null;
}

export async function fetchLoginLogs(adminUsername: string, adminPassword: string): Promise<LoginLog[]> {
  const data = await request('GET', '/admin/login-logs');
  return data.logs;
}

// ── Admin: analytics ──────────────────────────────────────────────────────────

export interface SessionEventEntry {
  event_type: string;
  occurred_at: string;
  device_info: string | null;
  ip_address: string | null;
}

export interface ActivityEntry {
  tab_key: string | null;
  action: string;
  details: Record<string, any>;
  occurred_at: string;
}

export interface TabUsageStat {
  tab_key: string;
  count: number;
  duration_ms: number;
}

export interface UserSessionSummary {
  session_token: string | null;
  started_at: string;
  ended_at: string | null;
  last_event_type: string;
  duration_ms: number;
  device_info: string | null;
  ip_address: string | null;
  event_count: number;
  activity_count: number;
  calc_count: number;
  save_count: number;
  is_active: boolean;
  alerts: string[];
  tab_stats: TabUsageStat[];
  events?: SessionEventEntry[];
  activities?: ActivityEntry[];
}

export interface UserAnalytics {
  user_id: string;
  username: string;
  is_admin: boolean;
  parent_user_id: string | null;
  is_online: boolean;
  active_session_count: number;
  last_login_at: string | null;
  last_logout_at: string | null;
  total_sessions: number;
  total_duration_ms: number;
  total_activities: number;
  total_calcs: number;
  total_saves: number;
  avg_session_ms: number;
  avg_acts_per_session: number;
  most_used_tab: string | null;
  performance_tier: 'active' | 'average' | 'low';
  tab_stats: TabUsageStat[];
  sessions: UserSessionSummary[];
}

export async function getUserAnalytics(adminUsername: string, adminPassword: string, userId?: string): Promise<UserAnalytics[]> {
  const data = await request('GET', '/admin/analytics', { query: { user_id: userId } });
  return data.analytics || [];
}

// ── Admin: tab permissions (any user) ─────────────────────────────────────────

export async function getTabPermissions(adminUsername: string, adminPassword: string, userId: string): Promise<TabPermission[]> {
  const data = await request('GET', `/admin/users/${userId}/tab-permissions`);
  return data.permissions;
}

export async function updateTabPermissions(adminUsername: string, adminPassword: string, userId: string, permissions: TabPermission[]) {
  return request('PUT', `/admin/users/${userId}/tab-permissions`, { body: { permissions } });
}

// ── User settings (cloud) ─────────────────────────────────────────────────────

async function saveUserSettingsDirect(sessionToken: string, userId: string, settings: { key: string; value: any }[]) {
  // `user_id` is echoed back the way the old client did; the server accepts it when it
  // matches the caller and 403s when it does not (03 §5), so the check still runs.
  return request('PUT', '/settings', { token: sessionToken, body: { user_id: userId, settings } });
}

export async function saveUserSettings(sessionToken: string, userId: string, settings: { key: string; value: any }[]) {
  const run = () => saveUserSettingsDirect(sessionToken, userId, settings);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOp({
      type: 'saveUserSettings',
      userId,
      entityKey: 'settings',
      payload: { settings },
    });
    return { success: true, pendingSync: true };
  }
  try {
    return await run();
  } catch (err) {
    if (isAuthError(err)) throw err;
    if (isNetworkError(err)) {
      await enqueueOp({
        type: 'saveUserSettings',
        userId,
        entityKey: 'settings',
        payload: { settings },
      });
      return { success: true, pendingSync: true };
    }
    throw err;
  }
}

export async function loadUserSettings(sessionToken: string, userId: string): Promise<Record<string, any>> {
  const data = await request('GET', '/settings', { token: sessionToken, query: { user_id: userId } });
  return data.settings;
}

// ── Admin: sessions ───────────────────────────────────────────────────────────

export async function getUserSessions(adminUsername: string, adminPassword: string, userId: string) {
  const data = await request('GET', `/admin/users/${userId}/sessions`);
  return data.sessions;
}

export async function terminateSession(adminUsername: string, adminPassword: string, sessionId: string) {
  return request('DELETE', `/admin/sessions/${sessionId}`);
}

// ── Saved quotes ──────────────────────────────────────────────────────────────

async function saveQuoteDirect(sessionToken: string, params: { title: string; customer_name: string; quote_number: string; source_type: string; quote_data: Record<string, any> }): Promise<SavedQuote> {
  const data = await request('POST', '/quotes', { token: sessionToken, body: params });
  trackActivity('save_quote', params.source_type, { quote_number: params.quote_number, customer: params.customer_name });
  return data.quote;
}

async function updateQuoteDirect(sessionToken: string, quoteId: string, params: { title?: string; customer_name?: string; quote_number?: string; quote_data?: Record<string, any> }): Promise<SavedQuote> {
  const data = await request('PATCH', `/quotes/${quoteId}`, { token: sessionToken, body: params });
  trackActivity('update_quote', null, { quote_id: quoteId });
  return data.quote;
}

async function deleteQuoteDirect(sessionToken: string, quoteId: string) {
  const r = await request('DELETE', `/quotes/${quoteId}`, { token: sessionToken });
  trackActivity('delete_quote', null, { quote_id: quoteId });
  return r;
}

function makeLocalQuoteId() {
  try {
    return `local_${crypto.randomUUID()}`;
  } catch {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

async function enqueueSaveQuote(
  params: { title: string; customer_name: string; quote_number: string; source_type: string; quote_data: Record<string, any> },
): Promise<SavedQuote> {
  const userId = getSessionUserId() || 'unknown';
  const clientQuoteId = makeLocalQuoteId();
  const now = new Date().toISOString();
  const quote: SavedQuote = {
    id: clientQuoteId,
    user_id: userId,
    title: params.title,
    customer_name: params.customer_name,
    quote_number: params.quote_number,
    source_type: params.source_type,
    quote_data: { ...params.quote_data, pendingSync: true, clientQuoteId },
    created_at: now,
    updated_at: now,
    pendingSync: true,
  };
  await enqueueOp({
    type: 'saveQuote',
    userId,
    entityKey: clientQuoteId,
    clientQuoteId,
    payload: { params, clientQuoteId },
  });
  await upsertPendingQuote({ quote, userId });
  markEngagementForInstall('save');
  trackActivity('save_quote', params.source_type, { quote_number: params.quote_number, pendingSync: true });
  return quote;
}

export async function saveQuote(sessionToken: string, params: { title: string; customer_name: string; quote_number: string; source_type: string; quote_data: Record<string, any> }): Promise<SavedQuote> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return enqueueSaveQuote(params);
  }
  try {
    const quote = await saveQuoteDirect(sessionToken, params);
    markEngagementForInstall('save');
    return quote;
  } catch (err) {
    if (isAuthError(err)) throw err;
    if (isNetworkError(err)) return enqueueSaveQuote(params);
    throw err;
  }
}

export async function updateQuote(sessionToken: string, quoteId: string, params: { title?: string; customer_name?: string; quote_number?: string; quote_data?: Record<string, any> }): Promise<SavedQuote> {
  const userId = getSessionUserId() || 'unknown';
  const resolvedId = await resolveQuoteId(quoteId);

  const enqueue = async (): Promise<SavedQuote> => {
    await enqueueOp({
      type: 'updateQuote',
      userId,
      entityKey: quoteId,
      clientQuoteId: quoteId.startsWith('local_') ? quoteId : undefined,
      payload: { quoteId: resolvedId, params },
    });
    const now = new Date().toISOString();
    const quote: SavedQuote = {
      id: quoteId,
      user_id: userId,
      title: params.title || '',
      customer_name: params.customer_name || '',
      quote_number: params.quote_number || '',
      source_type: 'offline',
      quote_data: { ...(params.quote_data || {}), pendingSync: true },
      created_at: now,
      updated_at: now,
      pendingSync: true,
    };
    await upsertPendingQuote({ quote, userId });
    trackActivity('update_quote', null, { quote_id: quoteId, pendingSync: true });
    return quote;
  };

  if (resolvedId.startsWith('local_') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return enqueue();
  }
  try {
    return await updateQuoteDirect(sessionToken, resolvedId, params);
  } catch (err) {
    if (isAuthError(err)) throw err;
    if (isNetworkError(err)) return enqueue();
    throw err;
  }
}

export async function deleteQuote(sessionToken: string, quoteId: string) {
  const userId = getSessionUserId() || 'unknown';
  const resolvedId = await resolveQuoteId(quoteId);

  const enqueue = async () => {
    await enqueueOp({
      type: 'deleteQuote',
      userId,
      entityKey: quoteId,
      payload: { quoteId: resolvedId },
    });
    await removePendingQuote(quoteId, userId);
    trackActivity('delete_quote', null, { quote_id: quoteId, pendingSync: true });
    return { success: true, pendingSync: true };
  };

  if (resolvedId.startsWith('local_') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return enqueue();
  }
  try {
    return await deleteQuoteDirect(sessionToken, resolvedId);
  } catch (err) {
    if (isAuthError(err)) throw err;
    if (isNetworkError(err)) return enqueue();
    throw err;
  }
}

export async function listQuotes(sessionToken: string): Promise<{ quotes: SavedQuote[]; related_quotes: SavedQuote[] }> {
  const userId = getSessionUserId();
  const pending = await readPendingQuotes(userId);
  const extras = pending.map((p) => p.quote as SavedQuote);

  try {
    const data = await request('GET', '/quotes', { token: sessionToken });
    if (extras.length === 0) return data;
    const serverIds = new Set((data.quotes || []).map((q: SavedQuote) => q.id));
    return {
      quotes: [...extras.filter((q) => !serverIds.has(q.id)), ...(data.quotes || [])],
      related_quotes: data.related_quotes || [],
    };
  } catch (err) {
    if (isNetworkError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { quotes: extras, related_quotes: [] };
    }
    throw err;
  }
}

// Register direct (non-outbox) replays for drainOutbox — avoids recursion.
registerOutboxReplay({
  saveQuote: saveQuoteDirect,
  updateQuote: updateQuoteDirect,
  deleteQuote: deleteQuoteDirect,
  saveUserSettings: saveUserSettingsDirect,
});

export async function transferQuotes(sessionToken: string, fromUserId: string, toUserId: string) {
  return request('POST', '/quotes/transfer', {
    token: sessionToken,
    body: { from_user_id: fromUserId, to_user_id: toUserId },
  });
}

// ── Storage helpers ───────────────────────────────────────────────────────────
//
// Only the URL minting goes through here. The browser still PUTs the file to `upload_url`
// and opens `signed_url` with NO headers — those URLs carry their own signature.

export async function getUploadUrl(sessionToken: string, fileName: string): Promise<{ path: string; upload_url: string; token: string }> {
  return request('POST', '/files/upload-url', { token: sessionToken, body: { file_name: fileName } });
}

export async function getFileUrl(sessionToken: string, filePath: string): Promise<{ signed_url: string }> {
  return request('POST', '/files/download-url', { token: sessionToken, body: { file_path: filePath } });
}

export async function deleteFile(sessionToken: string, filePath: string) {
  return request('POST', '/files/delete', { token: sessionToken, body: { file_path: filePath } });
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export interface VoiceParseResult {
  fields: Record<string, any>;
  transcript?: string;
}

/**
 * Arabic speech → calculator fields. This used to be a separate, unauthenticated Supabase
 * function invoked straight from the component; /voice/parse requires a session (BE-051),
 * so it now goes through the authed client like everything else.
 */
export async function parseVoiceInput(
  transcript: string,
  calcType: string,
  paperTypeNames: string[] = [],
): Promise<VoiceParseResult> {
  return request('POST', '/voice/parse', { body: { transcript, calcType, paperTypeNames } });
}
