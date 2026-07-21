import { supabase } from '@/integrations/supabase/client';
import { trackActivity } from '@/lib/activityTracker';

const FUNCTION_URL = `${(supabase as any).supabaseUrl}/functions/v1/manage-users`;

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
    try { window.dispatchEvent(new Event('printCalc:sessionExpired')); } catch {}
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
  // edge functions return 200 OK with JSON state for business errors).
  if (!res.ok || data.device_limit_reached || data.session_expired || data.error) {
    throw buildApiError(data, data.session_expired ? 401 : res.status);
  }

  return data;
}

async function callApi(body: Record<string, unknown>) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': (supabase as any).supabaseKey,
    },
    body: JSON.stringify(body),
  });

  return await parseApiResponse(res);
}

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

export async function loginUser(username: string, password: string, deviceInfo?: string): Promise<LoginResult> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': (supabase as any).supabaseKey,
    },
    body: JSON.stringify({ action: 'login', username, password, device_info: deviceInfo, device_id: getDeviceId() }),
  });

  return await parseApiResponse(res);
}

export async function forceLogin(username: string, password: string, terminateSessionIds: string[], deviceInfo?: string): Promise<LoginResult> {
  return callApi({ action: 'force_login', username, password, terminate_session_ids: terminateSessionIds, device_info: deviceInfo, device_id: getDeviceId() });
}

export async function changePassword(username: string, oldPassword: string, newPassword: string) {
  return callApi({ action: 'change_password', username, old_password: oldPassword, new_password: newPassword });
}

export async function verifySession(sessionToken: string) {
  // Clear any old mock sessions from before the backend deployment
  if (sessionToken.startsWith('mock-')) {
    return { expired: true };
  }

  // Silent verify — never throws. Returns { expired: true } when the session
  // is no longer valid so the UI can cleanly force-logout.

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': (supabase as any).supabaseKey,
      },
      body: JSON.stringify({ action: 'verify_session', session_token: sessionToken }),
    });
    let data: any = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 || data?.session_expired) return { expired: true, error: data?.error };
    if (!res.ok) return { network_error: true, error: data?.error };
    return data;
  } catch (e: any) {
    return { network_error: true, error: e?.message };
  }
}

export async function logoutSession(sessionToken: string) {
  return callApi({ action: 'logout', session_token: sessionToken });
}

export async function listUsers(adminUsername: string, adminPassword: string): Promise<AppUser[]> {
  const data = await callApi({ action: 'list', admin_username: adminUsername, admin_password: adminPassword });
  return data.users;
}

export async function createUser(
  adminUsername: string,
  adminPassword: string,
  params: { username: string; password: string; is_admin?: boolean; expires_at?: string | null; max_devices?: number; max_employees?: number }
) {
  return callApi({ action: 'create', admin_username: adminUsername, admin_password: adminPassword, ...params });
}

// Employee management (by regular user)
export async function createEmployee(
  sessionToken: string,
  params: { username: string; password: string; max_devices?: number }
) {
  return callApi({ action: 'create_employee', session_token: sessionToken, ...params });
}

export async function listEmployees(sessionToken: string): Promise<AppUser[]> {
  const data = await callApi({ action: 'list_employees', session_token: sessionToken });
  return data.employees;
}

export async function updateEmployee(
  sessionToken: string,
  params: { user_id: string; username?: string; password?: string; is_active?: boolean; max_devices?: number }
) {
  return callApi({ action: 'update_employee', session_token: sessionToken, ...params });
}

export async function deleteEmployee(sessionToken: string, userId: string, transferTo?: string) {
  return callApi({ action: 'delete_employee', session_token: sessionToken, user_id: userId, transfer_to: transferTo || undefined });
}

export async function checkEmployeeQuotes(sessionToken: string, userId: string): Promise<{ count: number }> {
  return callApi({ action: 'check_employee_quotes', session_token: sessionToken, user_id: userId });
}

export async function transferQuotes(sessionToken: string, fromUserId: string, toUserId: string) {
  return callApi({ action: 'transfer_quotes', session_token: sessionToken, from_user_id: fromUserId, to_user_id: toUserId });
}

export async function getEmployeeTabPermissions(sessionToken: string, userId: string): Promise<TabPermission[]> {
  const data = await callApi({ action: 'get_employee_tab_permissions', session_token: sessionToken, user_id: userId });
  return data.permissions;
}

export async function updateEmployeeTabPermissions(sessionToken: string, userId: string, permissions: TabPermission[]) {
  return callApi({ action: 'update_employee_tab_permissions', session_token: sessionToken, user_id: userId, permissions });
}

export async function updateUser(
  adminUsername: string,
  adminPassword: string,
  params: { user_id: string; username?: string; password?: string; is_active?: boolean; is_admin?: boolean; expires_at?: string | null; max_devices?: number; max_employees?: number }
) {
  return callApi({ action: 'update', admin_username: adminUsername, admin_password: adminPassword, ...params });
}

export async function deleteUser(adminUsername: string, adminPassword: string, userId: string) {
  return callApi({ action: 'delete', admin_username: adminUsername, admin_password: adminPassword, user_id: userId });
}

export interface LoginLog {
  id: string;
  user_id: string;
  username: string;
  logged_in_at: string;
  ip_address: string | null;
}

export async function fetchLoginLogs(adminUsername: string, adminPassword: string): Promise<LoginLog[]> {
  const data = await callApi({ action: 'login_logs', admin_username: adminUsername, admin_password: adminPassword });
  return data.logs;
}

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
  const data = await callApi({
    action: 'get_user_analytics',
    admin_username: adminUsername,
    admin_password: adminPassword,
    user_id: userId,
  });
  return data.analytics || [];
}

// Tab permissions
export async function getTabPermissions(adminUsername: string, adminPassword: string, userId: string): Promise<TabPermission[]> {
  const data = await callApi({ action: 'get_tab_permissions', admin_username: adminUsername, admin_password: adminPassword, user_id: userId });
  return data.permissions;
}

export async function updateTabPermissions(adminUsername: string, adminPassword: string, userId: string, permissions: TabPermission[]) {
  return callApi({ action: 'update_tab_permissions', admin_username: adminUsername, admin_password: adminPassword, user_id: userId, permissions });
}

// User settings (cloud)
export async function saveUserSettings(sessionToken: string, userId: string, settings: { key: string; value: any }[]) {
  return callApi({ action: 'save_settings', session_token: sessionToken, user_id: userId, settings });
}

export async function loadUserSettings(sessionToken: string, userId: string): Promise<Record<string, any>> {
  if (sessionToken.startsWith('mock-')) return {};
  const data = await callApi({ action: 'load_settings', session_token: sessionToken, user_id: userId });
  return data.settings;
}

// Sessions
export async function getUserSessions(adminUsername: string, adminPassword: string, userId: string) {
  const data = await callApi({ action: 'get_sessions', admin_username: adminUsername, admin_password: adminPassword, user_id: userId });
  return data.sessions;
}

export async function terminateSession(adminUsername: string, adminPassword: string, sessionId: string) {
  return callApi({ action: 'terminate_session', admin_username: adminUsername, admin_password: adminPassword, session_id: sessionId });
}

// Saved Quotes
export async function saveQuote(sessionToken: string, params: { title: string; customer_name: string; quote_number: string; source_type: string; quote_data: Record<string, any> }): Promise<SavedQuote> {
  const data = await callApi({ action: 'save_quote', session_token: sessionToken, ...params });
  trackActivity('save_quote', params.source_type, { quote_number: params.quote_number, customer: params.customer_name });
  return data.quote;
}

export async function updateQuote(sessionToken: string, quoteId: string, params: { title?: string; customer_name?: string; quote_number?: string; quote_data?: Record<string, any> }): Promise<SavedQuote> {
  const data = await callApi({ action: 'update_quote', session_token: sessionToken, quote_id: quoteId, ...params });
  trackActivity('update_quote', null, { quote_id: quoteId });
  return data.quote;
}

export async function deleteQuote(sessionToken: string, quoteId: string) {
  const r = await callApi({ action: 'delete_quote', session_token: sessionToken, quote_id: quoteId });
  trackActivity('delete_quote', null, { quote_id: quoteId });
  return r;
}

export async function listQuotes(sessionToken: string): Promise<{ quotes: SavedQuote[]; related_quotes: SavedQuote[] }> {
  if (sessionToken.startsWith('mock-')) return { quotes: [], related_quotes: [] };
  return callApi({ action: 'list_quotes', session_token: sessionToken });
}

export async function toggleEmployeesViewQuotes(sessionToken: string, enabled: boolean) {
  return callApi({ action: 'toggle_employees_view_quotes', session_token: sessionToken, enabled });
}

// Storage helpers
export async function getUploadUrl(sessionToken: string, fileName: string): Promise<{ path: string; upload_url: string; token: string }> {
  return callApi({ action: 'get_upload_url', session_token: sessionToken, file_name: fileName });
}

export async function getFileUrl(sessionToken: string, filePath: string): Promise<{ signed_url: string }> {
  return callApi({ action: 'get_file_url', session_token: sessionToken, file_path: filePath });
}

export async function deleteFile(sessionToken: string, filePath: string) {
  return callApi({ action: 'delete_file', session_token: sessionToken, file_path: filePath });
}
