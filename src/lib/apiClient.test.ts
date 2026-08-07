import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, clearToken, getToken, request, requestSilent, setToken } from '@/lib/apiClient';

/**
 * FE-060 — the transport seam. What matters here is the error contract the whole UI is
 * built on: business errors arrive as HTTP 200 with an `error` key, auth failures as 401
 * with `session_expired`, and the latter dispatches `printCalc:sessionExpired` so any
 * screen can force-logout. Those semantics carried over verbatim from the Supabase client
 * and must not drift.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  clearToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The (url, init) the client actually sent. */
function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

function sentHeaders(): Record<string, string> {
  return (lastCall()[1].headers ?? {}) as Record<string, string>;
}

describe('request — URLs and headers', () => {
  it('prefixes the configured base URL and sends JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('POST', '/auth/login', { auth: false, body: { username: 'a' } });

    const [url, init] = lastCall();
    expect(url).toBe(`${API_BASE_URL}/auth/login`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ username: 'a' }));
    expect(sentHeaders()['Content-Type']).toBe('application/json');
  });

  it('never sends the retired Supabase apikey header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('GET', '/quotes', { token: 'jwt-1' });

    expect(Object.keys(sentHeaders()).map((h) => h.toLowerCase())).not.toContain('apikey');
  });

  it('attaches the module-scope token when the caller supplies none', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    setToken('module-jwt');

    await request('GET', '/admin/users');

    expect(sentHeaders().Authorization).toBe('Bearer module-jwt');
  });

  it('prefers an explicitly passed token over the module one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    setToken('module-jwt');

    await request('GET', '/quotes', { token: 'caller-jwt' });

    expect(sentHeaders().Authorization).toBe('Bearer caller-jwt');
  });

  it('omits the Authorization header on public endpoints', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    setToken('module-jwt');

    await request('POST', '/auth/login', { auth: false, body: {} });

    expect(sentHeaders().Authorization).toBeUndefined();
  });

  it('appends query parameters and drops empty ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('DELETE', '/employees/emp-1', { query: { transfer_to: 'owner-1', unused: undefined } });

    expect(lastCall()[0]).toBe(`${API_BASE_URL}/employees/emp-1?transfer_to=owner-1`);
  });

  it('omits the query string entirely when every value is empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('GET', '/admin/analytics', { query: { user_id: undefined } });

    expect(lastCall()[0]).toBe(`${API_BASE_URL}/admin/analytics`);
  });

  it('sends no body when none is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('GET', '/quotes', { token: 'jwt' });

    expect(lastCall()[1].body).toBeUndefined();
  });
});

describe('request — the error contract', () => {
  it('throws on a 200 carrying an error, using the Arabic message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }));

    await expect(request('POST', '/auth/login', { auth: false, body: {} }))
      .rejects.toThrow('اسم المستخدم أو كلمة المرور غير صحيحة');
  });

  it('carries the device-limit payload onto the error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      error: 'تم الوصول للحد الأقصى من الأجهزة المسموح بها. يرجى تسجيل الخروج من جهاز آخر أولاً',
      device_limit_reached: true,
      active_sessions: [{ id: 's1' }],
      max_devices: 2,
    }));

    await expect(request('POST', '/auth/login', { auth: false, body: {} })).rejects.toMatchObject({
      device_limit_reached: true,
      active_sessions: [{ id: 's1' }],
      max_devices: 2,
    });
  });

  it('flags a 401 as session_expired and dispatches the global event', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'جلسة غير صالحة', session_expired: true }, 401));
    const onExpired = vi.fn();
    window.addEventListener('printCalc:sessionExpired', onExpired);

    await expect(request('GET', '/quotes', { token: 'dead' })).rejects.toMatchObject({
      session_expired: true,
      silent: true,
    });

    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('printCalc:sessionExpired', onExpired);
  });

  it('drops the stored token when a session expires', async () => {
    setToken('dead-jwt');
    fetchMock.mockResolvedValue(jsonResponse({ session_expired: true }, 401));

    await expect(request('GET', '/quotes')).rejects.toBeTruthy();

    expect(getToken()).toBeNull();
  });

  it('does not dispatch the expiry event for an ordinary business error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'العرض غير موجود' }, 404));
    const onExpired = vi.fn();
    window.addEventListener('printCalc:sessionExpired', onExpired);

    await expect(request('DELETE', '/quotes/x', { token: 'jwt' })).rejects.toThrow('العرض غير موجود');

    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener('printCalc:sessionExpired', onExpired);
  });

  it('falls back to the generic Arabic message on an empty error body', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(request('GET', '/quotes', { token: 'jwt' })).rejects.toThrow('حدث خطأ');
  });

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ quotes: [{ id: 'q1' }], related_quotes: [] }));

    await expect(request('GET', '/quotes', { token: 'jwt' }))
      .resolves.toEqual({ quotes: [{ id: 'q1' }], related_quotes: [] });
  });
});

describe('requestSilent — the heartbeat variant', () => {
  it('reports an expiry instead of throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'جلسة منتهية', session_expired: true }, 401));

    await expect(requestSilent('GET', '/auth/me', { token: 'dead' }))
      .resolves.toEqual({ expired: true, error: 'جلسة منتهية' });
  });

  it('never dispatches the expiry event — the caller decides', async () => {
    // Index.tsx requires two consecutive failures before logging out, which only works
    // because the heartbeat itself stays silent.
    fetchMock.mockResolvedValue(jsonResponse({ session_expired: true }, 401));
    const onExpired = vi.fn();
    window.addEventListener('printCalc:sessionExpired', onExpired);

    await requestSilent('GET', '/auth/me', { token: 'dead' });

    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener('printCalc:sessionExpired', onExpired);
  });

  it('reports a network error instead of throwing', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    await expect(requestSilent('GET', '/auth/me', { token: 'jwt' }))
      .resolves.toEqual({ network_error: true, error: 'Failed to fetch' });
  });

  it('treats a 5xx as a network error, not an expiry', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'حدث خطأ في الخادم' }, 500));

    await expect(requestSilent('GET', '/auth/me', { token: 'jwt' }))
      .resolves.toEqual({ network_error: true, error: 'حدث خطأ في الخادم' });
  });

  it('returns the body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ valid: true, tab_permissions: [{ tab_key: 'itemcost', is_enabled: true }] }));

    await expect(requestSilent('GET', '/auth/me', { token: 'jwt' })).resolves.toMatchObject({
      valid: true,
      tab_permissions: [{ tab_key: 'itemcost', is_enabled: true }],
    });
  });
});

describe('token lifecycle', () => {
  it('set and clear round-trip', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('treats an empty token as no token', () => {
    setToken('');
    expect(getToken()).toBeNull();
  });
});
