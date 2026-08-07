import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, clearToken, getToken, setToken } from '@/lib/apiClient';
import * as api from '@/lib/userApi';

/**
 * FE-061 — the action → REST mapping (docs/backend-laravel/03-API-SPECIFICATION.md §2).
 *
 * Every exported signature here is frozen so no component changed during the cutover;
 * these tests pin what each one now puts on the wire. `fetch` is stubbed throughout — this
 * is about the request we build, not about the backend, which has its own suite.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
  vi.stubGlobal('fetch', fetchMock);
  clearToken();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** What the last call sent: method, path relative to the API base, body and headers. */
function sent() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];

  return {
    method: init.method,
    path: url.replace(API_BASE_URL, ''),
    body: init.body ? JSON.parse(init.body as string) : undefined,
    headers: (init.headers ?? {}) as Record<string, string>,
  };
}

describe('auth', () => {
  it('loginUser posts to /auth/login with the device id and stores the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, session_token: 'jwt-new' }));

    await api.loginUser('owner', 'secret', 'Chrome/Windows');

    const req = sent();
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/auth/login');
    expect(req.body).toMatchObject({ username: 'owner', password: 'secret', device_info: 'Chrome/Windows' });
    expect(req.body.device_id).toBeTruthy();
    expect(req.headers.Authorization).toBeUndefined();

    // Subsequent calls authenticate with it.
    expect(getToken()).toBe('jwt-new');
  });

  it('forceLogin posts the sessions to terminate and swaps in the new token', async () => {
    setToken('old-jwt');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, session_token: 'jwt-forced' }));

    await api.forceLogin('owner', 'secret', ['sess-1'], 'Chrome/Windows');

    const req = sent();
    expect(req.path).toBe('/auth/force-login');
    expect(req.body).toMatchObject({ terminate_session_ids: ['sess-1'] });
    expect(getToken()).toBe('jwt-forced');
  });

  it('changePassword is a public endpoint using snake_case fields', async () => {
    await api.changePassword('owner', 'old-pw', 'new-pw');

    const req = sent();
    expect(req.path).toBe('/auth/change-password');
    expect(req.body).toEqual({ username: 'owner', old_password: 'old-pw', new_password: 'new-pw' });
    expect(req.headers.Authorization).toBeUndefined();
  });

  it('verifySession GETs /auth/me with the given token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ valid: true, tab_permissions: [] }));

    await api.verifySession('jwt-abc');

    const req = sent();
    expect(req.method).toBe('GET');
    expect(req.path).toBe('/auth/me');
    expect(req.headers.Authorization).toBe('Bearer jwt-abc');
  });

  it('logoutSession clears the token even when the request fails', async () => {
    setToken('jwt-abc');
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(api.logoutSession('jwt-abc')).rejects.toThrow('offline');

    expect(getToken()).toBeNull();
  });
});

describe('settings and quotes', () => {
  it('loadUserSettings GETs /settings and unwraps the map', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ settings: { paperTypes: [{ name: 'كوشيه' }] } }));

    const settings = await api.loadUserSettings('jwt', 'user-1');

    expect(sent().path).toBe('/settings?user_id=user-1');
    expect(settings).toEqual({ paperTypes: [{ name: 'كوشيه' }] });
  });

  it('saveUserSettings PUTs /settings', async () => {
    await api.saveUserSettings('jwt', 'user-1', [{ key: 'paperTypes', value: [] }]);

    const req = sent();
    expect(req.method).toBe('PUT');
    expect(req.path).toBe('/settings');
    expect(req.body).toEqual({ user_id: 'user-1', settings: [{ key: 'paperTypes', value: [] }] });
  });

  it('saveQuote POSTs /quotes and returns the quote', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ quote: { id: 'q1', title: 'كتالوج' } }));

    const quote = await api.saveQuote('jwt', {
      title: 'كتالوج', customer_name: 'عميل', quote_number: 'Q-1', source_type: 'diecut5', quote_data: { a: 1 },
    });

    const req = sent();
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/quotes');
    expect(req.body).toMatchObject({ title: 'كتالوج', source_type: 'diecut5' });
    expect(quote).toEqual({ id: 'q1', title: 'كتالوج' });
  });

  it('updateQuote PATCHes the quote by id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ quote: { id: 'q1' } }));

    await api.updateQuote('jwt', 'q1', { title: 'جديد' });

    const req = sent();
    expect(req.method).toBe('PATCH');
    expect(req.path).toBe('/quotes/q1');
    expect(req.body).toEqual({ title: 'جديد' });
  });

  it('deleteQuote DELETEs the quote by id', async () => {
    await api.deleteQuote('jwt', 'q1');

    expect(sent()).toMatchObject({ method: 'DELETE', path: '/quotes/q1' });
  });

  it('listQuotes GETs /quotes and passes the family payload straight through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      quotes: [{ id: 'mine' }],
      related_quotes: [{ id: 'theirs', employee_username: 'emp', is_parent_quote: true }],
    }));

    const result = await api.listQuotes('jwt');

    expect(sent()).toMatchObject({ method: 'GET', path: '/quotes' });
    expect(result.related_quotes[0]).toMatchObject({ employee_username: 'emp', is_parent_quote: true });
  });

  it('transferQuotes POSTs /quotes/transfer', async () => {
    await api.transferQuotes('jwt', 'from-1', 'to-1');

    expect(sent()).toMatchObject({
      method: 'POST',
      path: '/quotes/transfer',
      body: { from_user_id: 'from-1', to_user_id: 'to-1' },
    });
  });
});

describe('employees', () => {
  it('createEmployee POSTs /employees', async () => {
    await api.createEmployee('jwt', { username: 'emp', password: 'pw', max_devices: 2 });

    expect(sent()).toMatchObject({ method: 'POST', path: '/employees', body: { username: 'emp', max_devices: 2 } });
  });

  it('listEmployees unwraps the collection', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ employees: [{ id: 'e1' }] }));

    await expect(api.listEmployees('jwt')).resolves.toEqual([{ id: 'e1' }]);
    expect(sent()).toMatchObject({ method: 'GET', path: '/employees' });
  });

  it('updateEmployee moves user_id into the path and keeps the rest as the body', async () => {
    await api.updateEmployee('jwt', { user_id: 'e1', username: 'renamed', is_active: false });

    const req = sent();
    expect(req).toMatchObject({ method: 'PATCH', path: '/employees/e1' });
    expect(req.body).toEqual({ username: 'renamed', is_active: false });
    expect(req.body).not.toHaveProperty('user_id');
  });

  it('deleteEmployee puts transfer_to in the query string', async () => {
    await api.deleteEmployee('jwt', 'e1', 'owner-1');

    expect(sent()).toMatchObject({ method: 'DELETE', path: '/employees/e1?transfer_to=owner-1' });
  });

  it('deleteEmployee omits transfer_to when there is no handover', async () => {
    await api.deleteEmployee('jwt', 'e1');

    expect(sent().path).toBe('/employees/e1');
  });

  it('checkEmployeeQuotes GETs the count endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 3 }));

    await expect(api.checkEmployeeQuotes('jwt', 'e1')).resolves.toEqual({ count: 3 });
    expect(sent().path).toBe('/employees/e1/quotes-count');
  });

  it('employee tab permissions read and write the same path', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ permissions: [{ tab_key: 'itemcost', is_enabled: true }] }));
    await expect(api.getEmployeeTabPermissions('jwt', 'e1')).resolves.toEqual([{ tab_key: 'itemcost', is_enabled: true }]);
    expect(sent()).toMatchObject({ method: 'GET', path: '/employees/e1/tab-permissions' });

    await api.updateEmployeeTabPermissions('jwt', 'e1', [{ tab_key: 'diecut5', is_enabled: false }]);
    expect(sent()).toMatchObject({
      method: 'PUT',
      path: '/employees/e1/tab-permissions',
      body: { permissions: [{ tab_key: 'diecut5', is_enabled: false }] },
    });
  });

  it('the opaque default_tab row survives the round trip', async () => {
    await api.updateEmployeeTabPermissions('jwt', 'e1', [{ tab_key: 'default_tab:diecut5', is_enabled: true }]);

    expect(sent().body.permissions[0].tab_key).toBe('default_tab:diecut5');
  });

  it('toggleEmployeesViewQuotes POSTs the account endpoint', async () => {
    await api.toggleEmployeesViewQuotes('jwt', true);

    expect(sent()).toMatchObject({
      method: 'POST',
      path: '/account/employees-view-quotes',
      body: { enabled: true },
    });
  });
});

describe('admin — authenticated by JWT, never by the password argument', () => {
  beforeEach(() => setToken('admin-jwt'));

  /** Every admin call, driven through its real signature. */
  const adminCalls: Array<[string, () => Promise<unknown>]> = [
    ['listUsers', () => api.listUsers('root', 'hunter2')],
    ['createUser', () => api.createUser('root', 'hunter2', { username: 'u', password: 'p' })],
    ['updateUser', () => api.updateUser('root', 'hunter2', { user_id: 'u1', is_active: false })],
    ['deleteUser', () => api.deleteUser('root', 'hunter2', 'u1')],
    ['fetchLoginLogs', () => api.fetchLoginLogs('root', 'hunter2')],
    ['getUserAnalytics', () => api.getUserAnalytics('root', 'hunter2', 'u1')],
    ['getTabPermissions', () => api.getTabPermissions('root', 'hunter2', 'u1')],
    ['updateTabPermissions', () => api.updateTabPermissions('root', 'hunter2', 'u1', [])],
    ['getUserSessions', () => api.getUserSessions('root', 'hunter2', 'u1')],
    ['terminateSession', () => api.terminateSession('root', 'hunter2', 's1')],
  ];

  it.each(adminCalls)('%s sends the admin JWT and no credentials', async (_name, call) => {
    fetchMock.mockResolvedValue(jsonResponse({ users: [], logs: [], analytics: [], permissions: [], sessions: [] }));

    await call();

    const req = sent();
    expect(req.headers.Authorization).toBe('Bearer admin-jwt');

    // The password must not leak into a body, a query string or a header.
    const wire = JSON.stringify({ path: req.path, body: req.body ?? null, headers: req.headers });
    expect(wire).not.toContain('hunter2');
    expect(wire).not.toContain('admin_password');
    expect(wire).not.toContain('admin_username');
  });

  it('maps each admin action to its REST endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ users: [], logs: [], analytics: [], permissions: [], sessions: [] }));

    await api.listUsers('root', 'pw');
    expect(sent()).toMatchObject({ method: 'GET', path: '/admin/users' });

    await api.createUser('root', 'pw', { username: 'u', password: 'p', max_devices: 3 });
    expect(sent()).toMatchObject({ method: 'POST', path: '/admin/users', body: { username: 'u', max_devices: 3 } });

    await api.updateUser('root', 'pw', { user_id: 'u1', max_employees: 5 });
    expect(sent()).toMatchObject({ method: 'PATCH', path: '/admin/users/u1', body: { max_employees: 5 } });

    await api.deleteUser('root', 'pw', 'u1');
    expect(sent()).toMatchObject({ method: 'DELETE', path: '/admin/users/u1' });

    await api.getTabPermissions('root', 'pw', 'u1');
    expect(sent()).toMatchObject({ method: 'GET', path: '/admin/users/u1/tab-permissions' });

    await api.getUserSessions('root', 'pw', 'u1');
    expect(sent()).toMatchObject({ method: 'GET', path: '/admin/users/u1/sessions' });

    await api.terminateSession('root', 'pw', 's1');
    expect(sent()).toMatchObject({ method: 'DELETE', path: '/admin/sessions/s1' });

    await api.fetchLoginLogs('root', 'pw');
    expect(sent()).toMatchObject({ method: 'GET', path: '/admin/login-logs' });
  });

  it('getUserAnalytics scopes by user_id, and omits it when listing everyone', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ analytics: [{ user_id: 'u1' }] }));

    await api.getUserAnalytics('root', 'pw', 'u1');
    expect(sent().path).toBe('/admin/analytics?user_id=u1');

    await api.getUserAnalytics('root', 'pw');
    expect(sent().path).toBe('/admin/analytics');
  });

  it('getUserAnalytics defaults to an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(api.getUserAnalytics('root', 'pw')).resolves.toEqual([]);
  });
});

describe('files and voice', () => {
  it('the three file endpoints only mint URLs', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ path: 'u1/1-a.pdf', upload_url: 'https://x/u', token: 'sig' }));
    await api.getUploadUrl('jwt', 'montage.pdf');
    expect(sent()).toMatchObject({ method: 'POST', path: '/files/upload-url', body: { file_name: 'montage.pdf' } });

    fetchMock.mockResolvedValue(jsonResponse({ signed_url: 'https://x/d' }));
    await api.getFileUrl('jwt', 'u1/1-a.pdf');
    expect(sent()).toMatchObject({ method: 'POST', path: '/files/download-url', body: { file_path: 'u1/1-a.pdf' } });

    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await api.deleteFile('jwt', 'u1/1-a.pdf');
    expect(sent()).toMatchObject({ method: 'POST', path: '/files/delete', body: { file_path: 'u1/1-a.pdf' } });
  });

  it('parseVoiceInput POSTs the transcript with the session bearer', async () => {
    setToken('voice-jwt');
    fetchMock.mockResolvedValue(jsonResponse({ fields: { quantity: 5000 }, transcript: 'خمس آلاف' }));

    const result = await api.parseVoiceInput('خمس آلاف', 'employee', ['كوشيه']);

    const req = sent();
    expect(req).toMatchObject({ method: 'POST', path: '/voice/parse' });
    expect(req.body).toEqual({ transcript: 'خمس آلاف', calcType: 'employee', paperTypeNames: ['كوشيه'] });
    // The old Supabase function was unauthenticated; this one is not.
    expect(req.headers.Authorization).toBe('Bearer voice-jwt');
    expect(result.fields).toEqual({ quantity: 5000 });
  });
});
