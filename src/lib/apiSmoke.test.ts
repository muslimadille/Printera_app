import { beforeAll, describe, expect, it } from 'vitest';
import { API_BASE_URL, clearToken, setToken } from '@/lib/apiClient';
import { flushNow, setActivitySession, trackActivity } from '@/lib/activityTracker';
import * as api from '@/lib/userApi';

/**
 * FE-064 — the staged smoke, run through the REAL client code against a REAL backend.
 *
 * Every other test in this folder stubs `fetch`, which proves the request we build but not
 * that the backend agrees with it. This one proves the contract end to end.
 *
 * Skipped unless SMOKE_API=1, so `bun run test` stays hermetic. To run it:
 *
 *   cd backend && php artisan migrate --seed && php artisan serve
 *   SMOKE_API=1 SMOKE_ADMIN_USER=admin SMOKE_ADMIN_PASS=… bunx vitest run src/lib/apiSmoke.test.ts
 *
 * VITE_API_BASE_URL in .env decides which backend is targeted.
 */

const ENABLED = process.env.SMOKE_API === '1';
const ADMIN_USER = process.env.SMOKE_ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS ?? '';

/** Unique per run so repeated smokes never collide on the username unique index. */
const RUN = Date.now().toString(36);
const OWNER = `smoke_owner_${RUN}`;
const EMPLOYEE = `smoke_emp_${RUN}`;
const PASSWORD = 'smoke-pw-123456';

let adminToken = '';
let ownerToken = '';
let ownerId = '';
let employeeId = '';

describe.skipIf(!ENABLED)(`staged smoke against ${API_BASE_URL}`, () => {
  beforeAll(async () => {
    const admin = await api.loginUser(ADMIN_USER, ADMIN_PASS, 'smoke/admin');
    adminToken = admin.session_token;
  });

  // ── admin: accounts ─────────────────────────────────────────────────────────

  it('admin logs in and lists users through the admin JWT', async () => {
    setToken(adminToken);

    const users = await api.listUsers(ADMIN_USER, 'ignored-password');

    expect(Array.isArray(users)).toBe(true);
    expect(users.some((u) => u.username === ADMIN_USER)).toBe(true);
  });

  it('admin creates an account, and it is seeded with default tab permissions', async () => {
    setToken(adminToken);

    const created: any = await api.createUser(ADMIN_USER, 'ignored', {
      username: OWNER, password: PASSWORD, max_devices: 3, max_employees: 2,
    });
    ownerId = created.user.id;

    expect(created.user).toMatchObject({ username: OWNER, is_admin: false, max_employees: 2 });

    const perms = await api.getTabPermissions(ADMIN_USER, 'ignored', ownerId);
    const enabled = perms.filter((p) => p.is_enabled).map((p) => p.tab_key).sort();
    expect(enabled).toEqual(['costcalc', 'papertypes', 'savedquotes', 'settings']);
  });

  it('admin edits an account and reads its login logs and analytics', async () => {
    setToken(adminToken);

    await api.updateUser(ADMIN_USER, 'ignored', { user_id: ownerId, max_employees: 3 });
    const users = await api.listUsers(ADMIN_USER, 'ignored');
    expect(users.find((u) => u.id === ownerId)?.max_employees).toBe(3);

    const logs = await api.fetchLoginLogs(ADMIN_USER, 'ignored');
    expect(logs.some((l) => l.username === ADMIN_USER)).toBe(true);

    const analytics = await api.getUserAnalytics(ADMIN_USER, 'ignored', ownerId);
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toMatchObject({ user_id: ownerId, username: OWNER });
  });

  // ── owner: session lifecycle ────────────────────────────────────────────────

  it('the new account logs in and the heartbeat validates its session', async () => {
    const login = await api.loginUser(OWNER, PASSWORD, 'smoke/owner');
    ownerToken = login.session_token;

    expect(login.success).toBe(true);
    expect(login.user.username).toBe(OWNER);
    expect(Array.isArray(login.tab_permissions)).toBe(true);

    const beat: any = await api.verifySession(ownerToken);
    expect(beat.valid).toBe(true);
    expect(beat.expired).toBeUndefined();
    expect(Array.isArray(beat.tab_permissions)).toBe(true);
  });

  // ── settings ────────────────────────────────────────────────────────────────

  it('cloud settings round-trip opaquely', async () => {
    const payload = { nested: { a: [1, 2] }, arabic: 'ورق كوشيه', zero: 0, flag: false };

    await api.saveUserSettings(ownerToken, ownerId, [{ key: 'paperTypes', value: payload }]);
    const settings = await api.loadUserSettings(ownerToken, ownerId);

    expect(settings.paperTypes).toEqual(payload);
  });

  // ── quotes ──────────────────────────────────────────────────────────────────

  it('a quote is created, listed, edited and deleted', async () => {
    const quote = await api.saveQuote(ownerToken, {
      title: 'كتالوج', customer_name: 'مطبعة النور', quote_number: `Q-${RUN}`,
      source_type: 'diecut5', quote_data: { sheets: 500 },
    });
    expect(quote).toMatchObject({ title: 'كتالوج', source_type: 'diecut5' });

    const listed = await api.listQuotes(ownerToken);
    expect(listed.quotes.some((q) => q.id === quote.id)).toBe(true);

    const updated = await api.updateQuote(ownerToken, quote.id, { title: 'كتالوج مُحدَّث' });
    expect(updated.title).toBe('كتالوج مُحدَّث');

    await api.deleteQuote(ownerToken, quote.id);
    const after = await api.listQuotes(ownerToken);
    expect(after.quotes.some((q) => q.id === quote.id)).toBe(false);
  });

  // ── employees ───────────────────────────────────────────────────────────────

  it('an employee is created and inherits the owner tab permissions', async () => {
    // Give the owner a distinctive permission first, so inheritance is observable.
    setToken(adminToken);
    await api.updateTabPermissions(ADMIN_USER, 'ignored', ownerId, [{ tab_key: 'magazine', is_enabled: true }]);

    const created: any = await api.createEmployee(ownerToken, { username: EMPLOYEE, password: PASSWORD });
    employeeId = created.employee.id;
    expect(created.employee).toMatchObject({ username: EMPLOYEE, parent_user_id: ownerId, max_employees: 0 });

    const inherited = await api.getEmployeeTabPermissions(ownerToken, employeeId);
    expect(inherited.find((p) => p.tab_key === 'magazine')?.is_enabled).toBe(true);

    const employees = await api.listEmployees(ownerToken);
    expect(employees.some((e) => e.id === employeeId)).toBe(true);
  });

  it('the owner edits the employee tab permissions and quote count', async () => {
    await api.updateEmployeeTabPermissions(ownerToken, employeeId, [
      { tab_key: 'magazine', is_enabled: false },
      { tab_key: 'default_tab:diecut5', is_enabled: true },
    ]);

    const perms = await api.getEmployeeTabPermissions(ownerToken, employeeId);
    expect(perms.find((p) => p.tab_key === 'magazine')?.is_enabled).toBe(false);
    // The opaque marker survives a round trip.
    expect(perms.some((p) => p.tab_key === 'default_tab:diecut5')).toBe(true);

    await expect(api.checkEmployeeQuotes(ownerToken, employeeId)).resolves.toEqual({ count: 0 });
  });

  it('the view-quotes toggle gates what the employee sees', async () => {
    const ownerQuote = await api.saveQuote(ownerToken, {
      title: 'عرض المالك', customer_name: '', quote_number: '', source_type: 'calculator', quote_data: {},
    });
    const employeeLogin = await api.loginUser(EMPLOYEE, PASSWORD, 'smoke/employee');
    const employeeToken = employeeLogin.session_token;

    await api.toggleEmployeesViewQuotes(ownerToken, false);
    let seen = await api.listQuotes(employeeToken);
    expect(seen.related_quotes.some((q) => q.id === ownerQuote.id)).toBe(false);

    await api.toggleEmployeesViewQuotes(ownerToken, true);
    seen = await api.listQuotes(employeeToken);
    const parent = seen.related_quotes.find((q) => q.id === ownerQuote.id);
    expect(parent).toBeTruthy();
    expect(parent?.is_parent_quote).toBe(true);

    // Quotes transfer from the employee back to the owner.
    await expect(api.transferQuotes(ownerToken, employeeId, ownerId)).resolves.toMatchObject({ success: true });

    await api.deleteQuote(ownerToken, ownerQuote.id);
  });

  // ── files ───────────────────────────────────────────────────────────────────

  it('a file uploads through the signed URL and downloads back', async () => {
    const { path, upload_url } = await api.getUploadUrl(ownerToken, 'montage smoke.pdf');
    expect(path).toContain(`${ownerId}/`);

    // Exactly what MontageUpload.tsx does: a bare PUT with no auth headers.
    const put = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: 'SMOKE-PDF-BYTES',
    });
    expect(put.ok).toBe(true);

    const { signed_url } = await api.getFileUrl(ownerToken, path);
    const got = await fetch(signed_url);
    expect(got.ok).toBe(true);
    expect(await got.text()).toBe('SMOKE-PDF-BYTES');

    await expect(api.deleteFile(ownerToken, path)).resolves.toMatchObject({ success: true });
  });

  // ── activity beacon ─────────────────────────────────────────────────────────

  it('the activity queue flushes to /activity/batch', async () => {
    setActivitySession(ownerToken);
    trackActivity('calculate', 'itemcost', { smoke: true });
    trackActivity('tab_open', 'diecut5');

    await flushNow();

    setToken(adminToken);
    const analytics = await api.getUserAnalytics(ADMIN_USER, 'ignored', ownerId);
    expect(analytics[0].total_activities).toBeGreaterThanOrEqual(2);
    setActivitySession(null);
  });

  // ── admin: sessions ─────────────────────────────────────────────────────────

  it('an admin terminating a session revokes that token immediately', async () => {
    const victim = await api.loginUser(EMPLOYEE, PASSWORD, 'smoke/victim');

    setToken(adminToken);
    const sessions: any[] = await api.getUserSessions(ADMIN_USER, 'ignored', employeeId);
    const target = sessions.find((s) => s.device_info === 'smoke/victim');
    expect(target).toBeTruthy();

    await api.terminateSession(ADMIN_USER, 'ignored', target.id);

    // The heartbeat reports the expiry rather than throwing — the contract Index.tsx needs.
    await expect(api.verifySession(victim.session_token)).resolves.toMatchObject({ expired: true });
  });

  // ── device limit → force-login ──────────────────────────────────────────────

  it('exceeding the device limit surfaces the force-login payload', async () => {
    const single = `smoke_single_${RUN}`;
    setToken(adminToken);
    const created: any = await api.createUser(ADMIN_USER, 'ignored', {
      username: single, password: PASSWORD, max_devices: 1,
    });

    // First device takes the only slot. The device id is per-browser, so clear it to
    // simulate a second machine.
    await api.loginUser(single, PASSWORD, 'smoke/device-a');
    localStorage.removeItem('printCalc_device_id');

    const denied = await api.loginUser(single, PASSWORD, 'smoke/device-b').catch((e) => e);
    expect(denied.device_limit_reached).toBe(true);
    expect(denied.max_devices).toBe(1);
    expect(denied.active_sessions.length).toBeGreaterThan(0);

    const forced = await api.forceLogin(single, PASSWORD, [denied.active_sessions[0].id], 'smoke/device-b');
    expect(forced.success).toBe(true);

    setToken(adminToken);
    await api.deleteUser(ADMIN_USER, 'ignored', created.user.id);
  });

  // ── logout & teardown ───────────────────────────────────────────────────────

  it('logout revokes the token', async () => {
    const temp = await api.loginUser(OWNER, PASSWORD, 'smoke/logout');
    await api.logoutSession(temp.session_token);

    await expect(api.verifySession(temp.session_token)).resolves.toMatchObject({ expired: true });
  });

  it('cleans up the accounts it created', async () => {
    setToken(adminToken);

    await api.deleteEmployee(ownerToken, employeeId).catch(() => undefined);
    await api.deleteUser(ADMIN_USER, 'ignored', ownerId);

    const users = await api.listUsers(ADMIN_USER, 'ignored');
    expect(users.some((u) => u.id === ownerId)).toBe(false);
    clearToken();
  });
});
