import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashSync, compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hashPassword(password: string): string {
  return hashSync(password);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return sha256Hex === hash;
  }
  return compareSync(password, hash);
}

async function migrateHashIfNeeded(supabase: any, userId: string, password: string, currentHash: string) {
  if (currentHash.length === 64 && /^[a-f0-9]+$/.test(currentHash)) {
    const bcryptHash = hashPassword(password);
    await supabase.from("app_users").update({ password_hash: bcryptHash }).eq("id", userId);
  }
}

async function verifyAdmin(supabase: any, adminUsername: string, adminPassword: string) {
  if (!adminUsername || !adminPassword) {
    return { error: "يجب تسجيل الدخول كمدير", status: 401 };
  }
  const { data: adminUser } = await supabase
    .from("app_users").select("*")
    .eq("username", adminUsername).eq("is_admin", true).eq("is_active", true).single();
  if (!adminUser) return { error: "غير مصرح", status: 403 };
  const valid = await verifyPassword(adminPassword, adminUser.password_hash);
  if (!valid) return { error: "كلمة مرور المدير غير صحيحة", status: 403 };
  await migrateHashIfNeeded(supabase, adminUser.id, adminPassword, adminUser.password_hash);
  return { adminUser };
}

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Always return a consistent user payload for client session state.
// `parent_user_id` MUST be present (null for account owners) so the client
// can reliably distinguish admins / account-owners / employees and avoid
// false 401 redirects after page refresh.
function buildSessionUser(u: any) {
  return {
    id: u?.id,
    username: u?.username,
    is_admin: !!u?.is_admin,
    max_employees: u?.max_employees ?? 0,
    employees_can_view_quotes: u?.employees_can_view_quotes ?? false,
    parent_user_id: u?.parent_user_id ?? null,
  };
}

function buildDeviceLimitPayload(activeSessions: any[], maxDevices: number, errorMessage = "تم الوصول للحد الأقصى من الأجهزة المسموح بها. يرجى تسجيل الخروج من جهاز آخر أولاً") {
  return {
    success: false,
    error: errorMessage,
    device_limit_reached: true,
    active_sessions: (activeSessions || []).map((s: any) => ({
      id: s.id,
      device_info: s.device_info,
      last_active_at: s.last_active_at,
    })),
    max_devices: maxDevices,
  };
}

// ─── Idle session cleanup (sessions inactive > 72h are considered dead) ───
const IDLE_SESSION_HOURS = 72;
async function cleanupIdleSessions(supabase: any, userId: string) {
  const cutoff = new Date(Date.now() - IDLE_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from("user_sessions").delete()
    .eq("user_id", userId)
    .lt("last_active_at", cutoff);
}

// ─── Self-service Change Password ───
async function handleChangePassword(supabase: any, params: any) {
  const { username, old_password, new_password } = params;
  if (!username || !old_password || !new_password) {
    return jsonResponse({ error: "البيانات غير مكتملة" }, 200);
  }
  if (typeof new_password !== "string" || new_password.length < 6) {
    return jsonResponse({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" }, 200);
  }
  if (new_password === old_password) {
    return jsonResponse({ error: "كلمة المرور الجديدة يجب أن تختلف عن القديمة" }, 200);
  }
  const { data: user } = await supabase
    .from("app_users").select("*")
    .eq("username", username).eq("is_active", true).single();
  if (!user) return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 200);
  const valid = await verifyPassword(old_password, user.password_hash);
  if (!valid) return jsonResponse({ error: "كلمة المرور الحالية غير صحيحة" }, 200);
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    return jsonResponse({ error: "انتهت صلاحية هذا الحساب" }, 200);
  }
  const newHash = hashPassword(new_password);
  const { error } = await supabase.from("app_users").update({ password_hash: newHash }).eq("id", user.id);
  if (error) return jsonResponse({ error: "تعذر تحديث كلمة المرور" }, 500);
  // Invalidate all existing sessions for security
  await supabase.from("user_sessions").delete().eq("user_id", user.id);
  return jsonResponse({ success: true });
}

// ─── Login ───
async function handleLogin(supabase: any, params: any, req: Request) {
  const { username, password, device_info, device_id } = params;

  const { data: user } = await supabase
    .from("app_users").select("*")
    .eq("username", username).eq("is_active", true).single();

  if (!user) return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 200);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 200);
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    return jsonResponse({ error: "انتهت صلاحية هذا الحساب" }, 200);
  }
  await migrateHashIfNeeded(supabase, user.id, password, user.password_hash);

  // Auto-cleanup dead sessions before counting
  await cleanupIdleSessions(supabase, user.id);

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  // ── DEVICE REUSE: if a session already exists for this device, refresh it ──
  if (device_id) {
    const { data: existing } = await supabase
      .from("user_sessions").select("id")
      .eq("user_id", user.id).eq("device_id", device_id).maybeSingle();

    if (existing) {
      const newToken = generateSessionToken();
      await supabase.from("user_sessions")
        .update({
          session_token: newToken,
          device_info: device_info || null,
          ip_address: ip,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      const { data: tabPerms1 } = await supabase
        .from("user_tab_permissions").select("tab_key, is_enabled")
        .eq("user_id", user.id);
      const { data: settings1 } = await supabase
        .from("user_settings").select("setting_key, setting_value")
        .eq("user_id", user.id);
      const settingsMap1: Record<string, any> = {};
      if (settings1) for (const s of settings1) settingsMap1[s.setting_key] = s.setting_value;

      await supabase.from("login_logs").insert({
        user_id: user.id, username: user.username, ip_address: ip,
      });
      await logSessionEvent(supabase, {
        user_id: user.id, username: user.username, session_token: newToken,
        device_id, device_info, ip_address: ip, event_type: "login",
      });

      return jsonResponse({
        success: true,
        user: buildSessionUser(user),
        session_token: newToken,
        tab_permissions: tabPerms1 || [],
        settings: settingsMap1,
      });
    }
  }

  const { data: activeSessions } = await supabase
    .from("user_sessions").select("id, last_active_at, device_info")
    .eq("user_id", user.id).order("last_active_at", { ascending: false });

  const maxDevices = user.max_devices || 1;
  if (activeSessions && activeSessions.length >= maxDevices) {
    return jsonResponse(buildDeviceLimitPayload(activeSessions, maxDevices));
  }

  const sessionToken = generateSessionToken();
  await supabase.from("user_sessions").insert({
    user_id: user.id, session_token: sessionToken,
    device_info: device_info || null, ip_address: ip,
    device_id: device_id || null,
  });

  await supabase.from("login_logs").insert({
    user_id: user.id, username: user.username, ip_address: ip,
  });
  await logSessionEvent(supabase, {
    user_id: user.id, username: user.username, session_token: sessionToken,
    device_id: device_id || null, device_info: device_info || null, ip_address: ip,
    event_type: "login",
  });

  const { data: tabPerms } = await supabase
    .from("user_tab_permissions").select("tab_key, is_enabled")
    .eq("user_id", user.id);

  const { data: settings } = await supabase
    .from("user_settings").select("setting_key, setting_value")
    .eq("user_id", user.id);

  const settingsMap: Record<string, any> = {};
  if (settings) {
    for (const s of settings) settingsMap[s.setting_key] = s.setting_value;
  }

  return jsonResponse({
    success: true,
    user: buildSessionUser(user),
    session_token: sessionToken,
    tab_permissions: tabPerms || [],
    settings: settingsMap,
  });
}

// ─── Verify Session ───
async function handleVerifySession(supabase: any, params: any) {
  const { session_token } = params;
  if (!session_token) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: session } = await supabase
    .from("user_sessions")
    .select("id, last_active_at, device_id, device_info, ip_address, app_users(id, username, is_admin, is_active, max_employees, employees_can_view_quotes, parent_user_id)")
    .eq("session_token", session_token).maybeSingle();

  if (!session) return jsonResponse({ error: "جلسة منتهية", session_expired: true }, 200);
  if (!session.app_users || !session.app_users.is_active) {
    return jsonResponse({ error: "حساب غير مفعّل", session_expired: true }, 200);
  }

  const prevActive = session.last_active_at ? new Date(session.last_active_at).getTime() : 0;
  const nowMs = Date.now();
  await supabase.from("user_sessions")
    .update({ last_active_at: new Date(nowMs).toISOString() })
    .eq("id", session.id);

  // Throttled heartbeat: log at most once every 5 minutes per session
  if (nowMs - prevActive > 5 * 60 * 1000) {
    await logSessionEvent(supabase, {
      user_id: session.app_users.id,
      username: session.app_users.username,
      session_token,
      device_id: session.device_id,
      device_info: session.device_info,
      ip_address: session.ip_address,
      event_type: "heartbeat",
    });
  }

  // Always return latest tab permissions so the frontend can enforce
  // visibility server-side, even after a page refresh.
  const { data: tabPerms } = await supabase
    .from("user_tab_permissions").select("tab_key, is_enabled")
    .eq("user_id", session.app_users.id);

  return jsonResponse({
    valid: true,
    user: buildSessionUser(session.app_users),
    tab_permissions: tabPerms || [],
  });
}

// ─── Logout ───
async function handleLogout(supabase: any, params: any) {
  const { session_token } = params;
  if (session_token) {
    // Look up session to capture user info before deletion
    const { data: sess } = await supabase
      .from("user_sessions").select("user_id, device_id, device_info, ip_address, app_users(username)")
      .eq("session_token", session_token).maybeSingle();
    if (sess) {
      await supabase.from("session_events").insert({
        user_id: sess.user_id,
        username: sess.app_users?.username || "",
        session_token,
        device_id: sess.device_id,
        device_info: sess.device_info,
        ip_address: sess.ip_address,
        event_type: "logout",
      });
    }
    await supabase.from("user_sessions").delete().eq("session_token", session_token);
  }
  return jsonResponse({ success: true });
}

// ─── Helper: log a session event ───
async function logSessionEvent(supabase: any, params: {
  user_id: string; username: string; session_token?: string | null;
  device_id?: string | null; device_info?: string | null; ip_address?: string | null;
  event_type: "login" | "logout" | "heartbeat" | "auto_logout";
}) {
  try {
    await supabase.from("session_events").insert({
      user_id: params.user_id,
      username: params.username,
      session_token: params.session_token || null,
      device_id: params.device_id || null,
      device_info: params.device_info || null,
      ip_address: params.ip_address || null,
      event_type: params.event_type,
    });
  } catch (e) {
    console.error("logSessionEvent error", e);
  }
}

// ─── Log activity events (batched, called from frontend) ───
const ALLOWED_ACTIONS = new Set([
  "tab_open", "calculate", "save_quote", "update_quote", "delete_quote",
  "export_pdf", "export_excel", "import_excel", "settings_change",
  "voice_input", "upload_attachment", "input_change",
]);

async function handleLogActivityBatch(supabase: any, params: any) {
  const { session_token, events } = params;
  if (!session_token) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);
  if (!Array.isArray(events) || events.length === 0) {
    return jsonResponse({ success: true, logged: 0 });
  }

  const { data: session } = await supabase
    .from("user_sessions").select("user_id, app_users(username, is_active)")
    .eq("session_token", session_token).maybeSingle();
  if (!session || !session.app_users?.is_active) {
    return jsonResponse({ error: "جلسة منتهية", session_expired: true }, 200);
  }

  const cap = events.slice(0, 200);
  const rows = cap
    .filter((ev: any) => ev && typeof ev.action === "string" && ALLOWED_ACTIONS.has(ev.action))
    .map((ev: any) => ({
      user_id: session.user_id,
      username: session.app_users.username,
      session_token,
      tab_key: typeof ev.tab_key === "string" ? ev.tab_key.slice(0, 64) : null,
      action: ev.action,
      details: ev.details && typeof ev.details === "object" ? ev.details : {},
      occurred_at: ev.occurred_at && !isNaN(Date.parse(ev.occurred_at))
        ? new Date(ev.occurred_at).toISOString()
        : new Date().toISOString(),
    }));

  if (rows.length === 0) return jsonResponse({ success: true, logged: 0 });

  const { error } = await supabase.from("activity_events").insert(rows);
  if (error) {
    console.error("log_activity_batch insert error", error);
    return jsonResponse({ success: false, error: "تعذر تسجيل النشاط" }, 200);
  }
  return jsonResponse({ success: true, logged: rows.length });
}

// ─── List Users ───
async function handleList(supabase: any) {
  const { data: users } = await supabase
    .from("app_users")
    .select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id, employees_can_view_quotes")
    .order("created_at", { ascending: true });
  return jsonResponse({ users });
}

// ─── Login Logs ───
async function handleLoginLogs(supabase: any) {
  const { data: logs } = await supabase
    .from("login_logs").select("*")
    .order("logged_in_at", { ascending: false }).limit(100);
  return jsonResponse({ logs });
}

// ─── Create User ───
async function handleCreate(supabase: any, params: any) {
  const { username, password, is_admin, expires_at, max_devices, max_employees } = params;
  const bcryptHash = hashPassword(password);

  const { data: newUser, error } = await supabase
    .from("app_users")
    .insert({
      username, password_hash: bcryptHash,
      is_admin: is_admin || false,
      expires_at: expires_at || null,
      max_devices: max_devices || 2,
      max_employees: max_employees || 0,
    })
    .select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id")
    .single();

  if (error) {
    return jsonResponse(
      { error: error.message.includes("unique") ? "اسم المستخدم موجود مسبقاً" : error.message },
      400
    );
  }

  // Primary tabs enabled by default; secondary tabs disabled
  const enabledTabs = ['costcalc', 'savedquotes', 'settings', 'papertypes'];
  const disabledTabs = ['calculator', 'employee', 'quote', 'finishing', 'magazine', 'manual', 'boxpricing', 'guide', 'bulkimport'];
  const tabInserts = [
    ...enabledTabs.map(tab => ({ user_id: newUser.id, tab_key: tab, is_enabled: true })),
    ...disabledTabs.map(tab => ({ user_id: newUser.id, tab_key: tab, is_enabled: false })),
  ];
  await supabase.from("user_tab_permissions").insert(tabInserts);

  return jsonResponse({ user: newUser });
}

// ─── Update User ───
async function handleUpdate(supabase: any, params: any) {
  const { user_id, username, password, is_active, is_admin, expires_at, max_devices, max_employees } = params;
  const updates: Record<string, unknown> = {};
  if (username !== undefined) updates.username = username;
  if (is_active !== undefined) updates.is_active = is_active;
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (max_devices !== undefined) updates.max_devices = max_devices;
  if (max_employees !== undefined) updates.max_employees = max_employees;
  if (password) updates.password_hash = hashPassword(password);

  const { data: updatedUser, error } = await supabase
    .from("app_users").update(updates).eq("id", user_id)
    .select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id")
    .single();

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ user: updatedUser });
}

// ─── Delete User ───
async function handleDelete(supabase: any, params: any) {
  const { user_id } = params;
  const { error } = await supabase.from("app_users").delete().eq("id", user_id);
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ success: true });
}

// ─── Get Tab Permissions ───
async function handleGetTabPermissions(supabase: any, params: any) {
  const { user_id } = params;
  const { data } = await supabase
    .from("user_tab_permissions").select("tab_key, is_enabled")
    .eq("user_id", user_id);
  return jsonResponse({ permissions: data || [] });
}

// ─── Update Tab Permissions ───
async function handleUpdateTabPermissions(supabase: any, params: any) {
  const { user_id, permissions } = params;
  for (const perm of permissions) {
    await supabase.from("user_tab_permissions")
      .upsert({ user_id, tab_key: perm.tab_key, is_enabled: perm.is_enabled },
        { onConflict: 'user_id,tab_key' });
  }
  return jsonResponse({ success: true });
}

// ─── Save User Settings ───
async function handleSaveSettings(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  // Only allow saving own settings
  if (params.user_id !== user.id) return jsonResponse({ error: "غير مصرح" }, 403);

  const { user_id, settings } = params;
  for (const s of settings) {
    await supabase.from("user_settings")
      .upsert({ user_id, setting_key: s.key, setting_value: s.value },
        { onConflict: 'user_id,setting_key' });
  }
  return jsonResponse({ success: true });
}

// ─── Load User Settings ───
async function handleLoadSettings(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  // Only allow loading own settings
  if (params.user_id !== user.id) return jsonResponse({ error: "غير مصرح" }, 403);

  const { user_id } = params;
  const { data } = await supabase
    .from("user_settings").select("setting_key, setting_value")
    .eq("user_id", user_id);
  const settingsMap: Record<string, any> = {};
  if (data) {
    for (const s of data) settingsMap[s.setting_key] = s.setting_value;
  }
  return jsonResponse({ settings: settingsMap });
}

// ─── Get User Sessions ───
async function handleGetSessions(supabase: any, params: any) {
  const { user_id } = params;
  const { data } = await supabase
    .from("user_sessions").select("*")
    .eq("user_id", user_id).order("last_active_at", { ascending: false });
  return jsonResponse({ sessions: data || [] });
}

// ─── Terminate Session ───
async function handleTerminateSession(supabase: any, params: any) {
  const { session_id } = params;
  await supabase.from("user_sessions").delete().eq("id", session_id);
  return jsonResponse({ success: true });
}

// ─── Helper: get user from session ───
async function getUserFromSession(supabase: any, sessionToken: string) {
  if (!sessionToken) return null;
  const { data: session } = await supabase
    .from("user_sessions").select("*, app_users(*)")
    .eq("session_token", sessionToken).single();
  if (!session) return null;
  await supabase.from("user_sessions").update({ last_active_at: new Date().toISOString() }).eq("id", session.id);
  return session.app_users;
}

// ─── Create Employee ───
async function handleCreateEmployee(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: existing } = await supabase
    .from("app_users").select("id").eq("parent_user_id", user.id);
  const currentCount = existing?.length || 0;
  if (currentCount >= (user.max_employees || 0)) {
    return jsonResponse({ error: `وصلت للحد الأقصى من الموظفين (${user.max_employees || 0})` }, 400);
  }

  const bcryptHash = hashPassword(params.password);
  const { data: newEmp, error } = await supabase.from("app_users").insert({
    username: params.username, password_hash: bcryptHash,
    is_admin: false, parent_user_id: user.id,
    max_devices: params.max_devices || 1, max_employees: 0,
  }).select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id").single();

  if (error) {
    return jsonResponse({ error: error.message.includes("unique") ? "اسم المستخدم موجود مسبقاً" : error.message }, 400);
  }

  const { data: parentPerms } = await supabase.from("user_tab_permissions").select("tab_key, is_enabled").eq("user_id", user.id);
  if (parentPerms && parentPerms.length > 0) {
    const tabInserts = parentPerms.map((p: any) => ({ user_id: newEmp.id, tab_key: p.tab_key, is_enabled: p.is_enabled }));
    await supabase.from("user_tab_permissions").insert(tabInserts);
  }

  return jsonResponse({ employee: newEmp });
}

// ─── List Employees ───
async function handleListEmployees(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: employees } = await supabase.from("app_users")
    .select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id")
    .eq("parent_user_id", user.id).order("created_at", { ascending: true });

  return jsonResponse({ employees: employees || [] });
}

// ─── Update Employee ───
async function handleUpdateEmployee(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: emp } = await supabase.from("app_users").select("id").eq("id", params.user_id).eq("parent_user_id", user.id).single();
  if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);

  const updates: Record<string, unknown> = {};
  if (params.username !== undefined) updates.username = params.username;
  if (params.is_active !== undefined) updates.is_active = params.is_active;
  if (params.max_devices !== undefined) updates.max_devices = params.max_devices;
  if (params.password) updates.password_hash = hashPassword(params.password);

  const { data: updated, error } = await supabase.from("app_users").update(updates).eq("id", params.user_id)
    .select("id, username, is_active, is_admin, expires_at, created_at, max_devices, max_employees, parent_user_id").single();
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ employee: updated });
}

// ─── Check Employee Quotes Count ───
async function handleCheckEmployeeQuotes(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: emp } = await supabase.from("app_users").select("id").eq("id", params.user_id).eq("parent_user_id", user.id).single();
  if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);

  const { data: quotes, count } = await supabase.from("saved_quotes").select("id", { count: 'exact' }).eq("user_id", params.user_id);
  return jsonResponse({ count: count || 0 });
}

// ─── Transfer Quotes ───
async function handleTransferQuotes(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { from_user_id, to_user_id } = params;

  // Verify from_user is an employee of current user OR is the current user
  if (from_user_id !== user.id) {
    const { data: emp } = await supabase.from("app_users").select("id").eq("id", from_user_id).eq("parent_user_id", user.id).single();
    if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);
  }

  // Verify to_user is an employee of current user OR is the current user
  if (to_user_id !== user.id) {
    const { data: emp } = await supabase.from("app_users").select("id").eq("id", to_user_id).eq("parent_user_id", user.id).single();
    if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);
  }

  const { error, count } = await supabase.from("saved_quotes")
    .update({ user_id: to_user_id })
    .eq("user_id", from_user_id);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ success: true, transferred: count || 0 });
}

// ─── Delete Employee ───
async function handleDeleteEmployee(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: emp } = await supabase.from("app_users").select("id").eq("id", params.user_id).eq("parent_user_id", user.id).single();
  if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);

  // If transfer_to specified, move quotes first
  if (params.transfer_to) {
    if (params.transfer_to !== user.id) {
      const { data: targetEmp } = await supabase.from("app_users").select("id").eq("id", params.transfer_to).eq("parent_user_id", user.id).single();
      if (!targetEmp) return jsonResponse({ error: "المستخدم المستهدف غير موجود" }, 400);
    }
    await supabase.from("saved_quotes").update({ user_id: params.transfer_to }).eq("user_id", params.user_id);
  }

  await supabase.from("app_users").delete().eq("id", params.user_id);
  return jsonResponse({ success: true });
}

// ─── Get Employee Tab Permissions ───
async function handleGetEmployeeTabPermissions(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: emp } = await supabase.from("app_users").select("id").eq("id", params.user_id).eq("parent_user_id", user.id).single();
  if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);

  const { data } = await supabase.from("user_tab_permissions").select("tab_key, is_enabled").eq("user_id", params.user_id);
  return jsonResponse({ permissions: data || [] });
}

// ─── Update Employee Tab Permissions ───
async function handleUpdateEmployeeTabPermissions(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: emp } = await supabase.from("app_users").select("id").eq("id", params.user_id).eq("parent_user_id", user.id).single();
  if (!emp) return jsonResponse({ error: "غير مصرح" }, 403);

  for (const perm of params.permissions) {
    await supabase.from("user_tab_permissions")
      .upsert({ user_id: params.user_id, tab_key: perm.tab_key, is_enabled: perm.is_enabled }, { onConflict: 'user_id,tab_key' });
  }
  return jsonResponse({ success: true });
}

// ─── Save Quote ───
async function handleSaveQuote(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { title, customer_name, quote_number, source_type, quote_data } = params;

  const { data: quote, error } = await supabase.from("saved_quotes").insert({
    user_id: user.id,
    title: title || '',
    customer_name: customer_name || '',
    quote_number: quote_number || '',
    source_type: source_type || 'calculator',
    quote_data: quote_data || {},
  }).select("*").single();

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ quote });
}

// ─── Helper: get all user IDs in the same family (parent + employees) ───
async function getFamilyUserIds(supabase: any, user: any): Promise<string[]> {
  const parentId = user.parent_user_id || user.id;
  // Get parent + all employees under parent
  const { data: employees } = await supabase.from("app_users")
    .select("id").eq("parent_user_id", parentId);
  const ids = [parentId];
  if (employees) ids.push(...employees.map((e: any) => e.id));
  return ids;
}

// ─── Update Quote ───
async function handleUpdateQuote(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  // Verify the quote belongs to someone in the same family
  const { data: existing } = await supabase.from("saved_quotes").select("user_id").eq("id", params.quote_id).single();
  if (!existing) return jsonResponse({ error: "العرض غير موجود" }, 404);
  const familyIds = await getFamilyUserIds(supabase, user);
  if (!familyIds.includes(existing.user_id)) return jsonResponse({ error: "غير مصرح" }, 403);

  const updates: Record<string, unknown> = {};
  if (params.title !== undefined) updates.title = params.title;
  if (params.customer_name !== undefined) updates.customer_name = params.customer_name;
  if (params.quote_number !== undefined) updates.quote_number = params.quote_number;
  if (params.quote_data !== undefined) updates.quote_data = params.quote_data;
  updates.updated_at = new Date().toISOString();

  const { data: quote, error } = await supabase.from("saved_quotes").update(updates).eq("id", params.quote_id).select("*").single();
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ quote });
}

// ─── Delete Quote ───
async function handleDeleteQuote(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { data: existing } = await supabase.from("saved_quotes").select("user_id").eq("id", params.quote_id).single();
  if (!existing) return jsonResponse({ error: "العرض غير موجود" }, 404);
  const familyIds = await getFamilyUserIds(supabase, user);
  if (!familyIds.includes(existing.user_id)) return jsonResponse({ error: "غير مصرح" }, 403);

  await supabase.from("saved_quotes").delete().eq("id", params.quote_id);
  return jsonResponse({ success: true });
}

// ─── List Quotes ───
async function handleListQuotes(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  // Get own quotes
  const { data: ownQuotes } = await supabase.from("saved_quotes")
    .select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  let relatedQuotes: any[] = [];

  if (!user.parent_user_id) {
    // Main user — get all employee quotes
    const { data: employees } = await supabase.from("app_users")
      .select("id, username").eq("parent_user_id", user.id);
    if (employees && employees.length > 0) {
      const empIds = employees.map((e: any) => e.id);
      const { data: empQuotes } = await supabase.from("saved_quotes")
        .select("*").in("user_id", empIds).order("created_at", { ascending: false });
      if (empQuotes) {
        const empMap = new Map(employees.map((e: any) => [e.id, e.username]));
        relatedQuotes = empQuotes.map((q: any) => ({ ...q, employee_username: empMap.get(q.user_id) }));
      }
    }
  } else {
    // Employee — get parent's quotes (if allowed) + sibling employees' quotes
    const { data: parent } = await supabase.from("app_users")
      .select("id, username, employees_can_view_quotes").eq("id", user.parent_user_id).single();

    if (parent) {
      // Get parent's quotes if allowed
      if (parent.employees_can_view_quotes) {
        const { data: parentQuotes } = await supabase.from("saved_quotes")
          .select("*").eq("user_id", parent.id).order("created_at", { ascending: false });
        if (parentQuotes) {
          relatedQuotes.push(...parentQuotes.map((q: any) => ({ ...q, employee_username: parent.username, is_parent_quote: true })));
        }
      }

      // Get sibling employees' quotes (always visible to each other)
      const { data: siblings } = await supabase.from("app_users")
        .select("id, username").eq("parent_user_id", parent.id).neq("id", user.id);
      if (siblings && siblings.length > 0) {
        const sibIds = siblings.map((e: any) => e.id);
        const { data: sibQuotes } = await supabase.from("saved_quotes")
          .select("*").in("user_id", sibIds).order("created_at", { ascending: false });
        if (sibQuotes) {
          const sibMap = new Map(siblings.map((e: any) => [e.id, e.username]));
          relatedQuotes.push(...sibQuotes.map((q: any) => ({ ...q, employee_username: sibMap.get(q.user_id) })));
        }
      }
    }
  }

  return jsonResponse({ quotes: ownQuotes || [], related_quotes: relatedQuotes });
}

// ─── Toggle employees can view quotes ───
async function handleToggleEmployeesViewQuotes(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);
  if (user.parent_user_id) return jsonResponse({ error: "غير مصرح - فقط المستخدم الرئيسي" }, 403);

  const { data, error } = await supabase.from("app_users")
    .update({ employees_can_view_quotes: params.enabled })
    .eq("id", user.id).select("employees_can_view_quotes").single();

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ success: true, employees_can_view_quotes: data.employees_can_view_quotes });
}

// ─── Storage: Get Signed Upload URL ───
async function handleGetUploadUrl(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { file_name } = params;
  if (!file_name) return jsonResponse({ error: "اسم الملف مطلوب" }, 400);

  // Sanitize filename
  const safeName = `${user.id}/${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { data, error } = await supabase.storage
    .from('montage-files')
    .createSignedUploadUrl(safeName);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ path: safeName, upload_url: data.signedUrl, token: data.token });
}

// ─── Storage: Get Signed Download URL ───
async function handleGetFileUrl(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { file_path } = params;
  if (!file_path) return jsonResponse({ error: "مسار الملف مطلوب" }, 400);

  const { data, error } = await supabase.storage
    .from('montage-files')
    .createSignedUrl(file_path, 3600); // 1 hour expiry

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ signed_url: data.signedUrl });
}

// ─── Storage: Delete File ───
async function handleDeleteFile(supabase: any, params: any) {
  const user = await getUserFromSession(supabase, params.session_token);
  if (!user) return jsonResponse({ error: "جلسة غير صالحة", session_expired: true }, 200);

  const { file_path } = params;
  if (!file_path) return jsonResponse({ error: "مسار الملف مطلوب" }, 400);

  const { error } = await supabase.storage.from('montage-files').remove([file_path]);
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ success: true });
}

// ─── Force Login (terminate OLDEST session only and login) ───
async function handleForceLogin(supabase: any, params: any, req: Request) {
  const { username, password, device_info, device_id, terminate_session_ids } = params;

  const { data: user } = await supabase
    .from("app_users").select("*")
    .eq("username", username).eq("is_active", true).single();

  if (!user) return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 200);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 200);

  // Always start with idle cleanup
  await cleanupIdleSessions(supabase, user.id);

  // If this device already has a session, just refresh it (no deletion of others)
  if (device_id) {
    const { data: ownExisting } = await supabase
      .from("user_sessions").select("id")
      .eq("user_id", user.id).eq("device_id", device_id).maybeSingle();
    if (ownExisting) {
      const reusedToken = generateSessionToken();
      const ip0 = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
      await supabase.from("user_sessions")
        .update({ session_token: reusedToken, device_info: device_info || null, ip_address: ip0, last_active_at: new Date().toISOString() })
        .eq("id", ownExisting.id);

      const { data: tp } = await supabase.from("user_tab_permissions").select("tab_key, is_enabled").eq("user_id", user.id);
      const { data: st } = await supabase.from("user_settings").select("setting_key, setting_value").eq("user_id", user.id);
      const sm: Record<string, any> = {};
      if (st) for (const s of st) sm[s.setting_key] = s.setting_value;
      await supabase.from("login_logs").insert({ user_id: user.id, username: user.username, ip_address: ip0 });
      await logSessionEvent(supabase, {
        user_id: user.id, username: user.username, session_token: reusedToken,
        device_id, device_info, ip_address: ip0, event_type: "login",
      });
      return jsonResponse({
        success: true,
        user: buildSessionUser(user),
        session_token: reusedToken, tab_permissions: tp || [], settings: sm,
      });
    }
  }

  // Terminate ONLY user-selected sessions (max 1 — UI now sends a single id)
  if (terminate_session_ids && terminate_session_ids.length > 0) {
    const toTerminate = terminate_session_ids.slice(0, 1); // safety: oldest only
    for (const sid of toTerminate) {
      // Log auto_logout event for the terminated session
      const { data: termSess } = await supabase
        .from("user_sessions").select("user_id, device_id, device_info, ip_address, app_users(username)")
        .eq("id", sid).maybeSingle();
      if (termSess) {
        await logSessionEvent(supabase, {
          user_id: termSess.user_id, username: termSess.app_users?.username || "",
          device_id: termSess.device_id, device_info: termSess.device_info,
          ip_address: termSess.ip_address, event_type: "auto_logout",
        });
      }
      await supabase.from("user_sessions").delete().eq("id", sid).eq("user_id", user.id);
    }
  } else {
    // Fallback: auto-terminate oldest session by last_active_at
    const { data: oldest } = await supabase
      .from("user_sessions").select("id, device_id, device_info, ip_address")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: true })
      .limit(1).maybeSingle();
    if (oldest) {
      await logSessionEvent(supabase, {
        user_id: user.id, username: user.username,
        device_id: oldest.device_id, device_info: oldest.device_info,
        ip_address: oldest.ip_address, event_type: "auto_logout",
      });
      await supabase.from("user_sessions").delete().eq("id", oldest.id);
    }
  }

  // Re-check sessions after termination
  const { data: remaining } = await supabase
    .from("user_sessions").select("id")
    .eq("user_id", user.id);

  const maxDevices = user.max_devices || 1;
  if (remaining && remaining.length >= maxDevices) {
    return jsonResponse({ error: "لا يزال عدد الأجهزة النشطة يتجاوز الحد المسموح" }, 403);
  }

  // Create session
  const sessionToken = generateSessionToken();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
  await supabase.from("user_sessions").insert({
    user_id: user.id, session_token: sessionToken,
    device_info: device_info || null, ip_address: ip,
    device_id: device_id || null,
  });

  await supabase.from("login_logs").insert({
    user_id: user.id, username: user.username, ip_address: ip,
  });
  await logSessionEvent(supabase, {
    user_id: user.id, username: user.username, session_token: sessionToken,
    device_id: device_id || null, device_info: device_info || null, ip_address: ip,
    event_type: "login",
  });

  const { data: tabPerms } = await supabase
    .from("user_tab_permissions").select("tab_key, is_enabled")
    .eq("user_id", user.id);

  const { data: settings } = await supabase
    .from("user_settings").select("setting_key, setting_value")
    .eq("user_id", user.id);

  const settingsMap: Record<string, any> = {};
  if (settings) {
    for (const s of settings) settingsMap[s.setting_key] = s.setting_value;
  }

  return jsonResponse({
    success: true,
    user: buildSessionUser(user),
    session_token: sessionToken,
    tab_permissions: tabPerms || [],
    settings: settingsMap,
  });
}

// ─── Get User Analytics (admin only) ───
// Returns per-user stats + per-session breakdown derived from session_events.
async function handleGetUserAnalytics(supabase: any, params: any) {
  const { user_id, limit_users } = params;

  // Pull all users (or just one)
  let usersQuery = supabase
    .from("app_users")
    .select("id, username, is_admin, parent_user_id");
  if (user_id) usersQuery = usersQuery.eq("id", user_id);
  const { data: users } = await usersQuery;
  if (!users || users.length === 0) return jsonResponse({ analytics: [] });

  const userIds = users.map((u: any) => u.id);

  // Pull active sessions to determine "online" status
  const { data: activeSessions } = await supabase
    .from("user_sessions")
    .select("id, user_id, device_info, ip_address, created_at, last_active_at")
    .in("user_id", userIds);

  // Pull session events
  const { data: events } = await supabase
    .from("session_events")
    .select("user_id, session_token, device_info, ip_address, event_type, occurred_at")
    .in("user_id", userIds)
    .order("occurred_at", { ascending: true })
    .limit(20000);

  // Pull activity events (tab usage / actions)
  const { data: activities } = await supabase
    .from("activity_events")
    .select("user_id, session_token, tab_key, action, details, occurred_at")
    .in("user_id", userIds)
    .order("occurred_at", { ascending: true })
    .limit(20000);

  // Group events by user → by session_token to compute durations
  const byUser: Record<string, any[]> = {};
  for (const ev of events || []) {
    if (!byUser[ev.user_id]) byUser[ev.user_id] = [];
    byUser[ev.user_id].push(ev);
  }
  const actByUser: Record<string, any[]> = {};
  for (const a of activities || []) {
    if (!actByUser[a.user_id]) actByUser[a.user_id] = [];
    actByUser[a.user_id].push(a);
  }

  const ONLINE_WINDOW_MS = 2 * 60 * 1000; // active in last 2 min = online
  const TAB_GAP_MS = 5 * 60 * 1000; // > 5 min idle inside same tab = no longer counting time
  const now = Date.now();

  const analytics = users.map((u: any) => {
    const evs = byUser[u.id] || [];
    const acts = (actByUser[u.id] || []).slice().sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    const userActiveSessions = (activeSessions || []).filter((s: any) => s.user_id === u.id);

    // Group events by session_token
    const sessions: Record<string, { token: string | null; events: any[]; activities: any[] }> = {};
    let synth = 0;
    for (const ev of evs) {
      let key = ev.session_token || `__nokey_${synth++}`;
      if (!ev.session_token) {
        key = `__nokey_${Math.floor(new Date(ev.occurred_at).getTime() / 60000)}`;
      }
      if (!sessions[key]) sessions[key] = { token: ev.session_token, events: [], activities: [] };
      sessions[key].events.push(ev);
    }
    for (const a of acts) {
      const key = a.session_token || "__nokey_act";
      if (!sessions[key]) sessions[key] = { token: a.session_token, events: [], activities: [] };
      sessions[key].activities.push(a);
    }

    // Compute per-tab usage from activity events
    const computeTabStats = (acts: any[]) => {
      const tabMap: Record<string, { count: number; durationMs: number; lastTs: number }> = {};
      for (const a of acts) {
        const tab = a.tab_key || "_unknown";
        const t = new Date(a.occurred_at).getTime();
        if (!tabMap[tab]) tabMap[tab] = { count: 0, durationMs: 0, lastTs: 0 };
        tabMap[tab].count += 1;
        if (tabMap[tab].lastTs > 0) {
          const gap = t - tabMap[tab].lastTs;
          if (gap > 0 && gap < TAB_GAP_MS) tabMap[tab].durationMs += gap;
        }
        tabMap[tab].lastTs = t;
      }
      return Object.entries(tabMap).map(([tab_key, v]) => ({
        tab_key, count: v.count, duration_ms: v.durationMs,
      })).sort((a, b) => b.count - a.count);
    };

    // Build per-session summaries
    const sessionSummaries = Object.values(sessions).map((s) => {
      const sorted = s.events.slice().sort(
        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );
      const sortedActs = s.activities.slice().sort(
        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );
      const allEv = [...sorted, ...sortedActs];
      if (allEv.length === 0) return null;
      const allTimes = allEv.map(e => new Date(e.occurred_at).getTime());
      const firstTs = Math.min(...allTimes);
      const lastTs = Math.max(...allTimes);
      const last = sorted[sorted.length - 1];
      const lastEventType = last?.event_type || "activity";
      const isStillActive =
        s.token && userActiveSessions.length > 0 &&
        (lastEventType === "login" || lastEventType === "heartbeat" || !last) &&
        now - lastTs < ONLINE_WINDOW_MS;
      const startedAt = new Date(firstTs).toISOString();
      const endedAt = isStillActive ? null : new Date(lastTs).toISOString();
      const durationMs = lastTs - firstTs;

      const tabStats = computeTabStats(sortedActs);
      const calcCount = sortedActs.filter(a => a.action === "calculate").length;
      const saveCount = sortedActs.filter(a => a.action === "save_quote" || a.action === "update_quote").length;

      // Heuristic alerts
      const alerts: string[] = [];
      if (durationMs > 4 * 60 * 60 * 1000) alerts.push("long_session");
      if (calcCount > 10 && saveCount === 0) alerts.push("many_calc_no_save");
      const tabSwitches = sortedActs.filter(a => a.action === "tab_open").length;
      if (tabSwitches > 30) alerts.push("frequent_tab_switching");

      return {
        session_token: s.token,
        started_at: startedAt,
        ended_at: endedAt,
        last_event_type: lastEventType,
        duration_ms: Math.max(0, durationMs),
        device_info: sorted[0]?.device_info || sorted[sorted.length - 1]?.device_info || null,
        ip_address: sorted[0]?.ip_address || sorted[sorted.length - 1]?.ip_address || null,
        event_count: sorted.length,
        activity_count: sortedActs.length,
        calc_count: calcCount,
        save_count: saveCount,
        is_active: isStillActive,
        alerts,
        tab_stats: tabStats,
        events: sorted.map((e) => ({
          event_type: e.event_type,
          occurred_at: e.occurred_at,
          device_info: e.device_info || null,
          ip_address: e.ip_address || null,
        })),
        activities: sortedActs.map((a) => ({
          tab_key: a.tab_key || null,
          action: a.action,
          details: a.details || {},
          occurred_at: a.occurred_at,
        })),
      };
    }).filter(Boolean).sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const totalSessions = sessionSummaries.length;
    const totalDurationMs = sessionSummaries.reduce((acc: number, s: any) => acc + s.duration_ms, 0);
    const totalActivities = sessionSummaries.reduce((acc: number, s: any) => acc + s.activity_count, 0);
    const totalCalcs = sessionSummaries.reduce((acc: number, s: any) => acc + s.calc_count, 0);
    const totalSaves = sessionSummaries.reduce((acc: number, s: any) => acc + s.save_count, 0);
    const lastLoginEv = [...evs].reverse().find((e) => e.event_type === "login");
    const lastLogoutEv = [...evs].reverse().find((e) => e.event_type === "logout" || e.event_type === "auto_logout");
    const isOnline = userActiveSessions.some(
      (s: any) => s.last_active_at && now - new Date(s.last_active_at).getTime() < ONLINE_WINDOW_MS,
    );

    // Aggregate per-tab stats across all sessions
    const overallTabStats = computeTabStats(acts);

    // Performance tier: based on activity in last 30d
    const recentCutoff = now - 30 * 24 * 60 * 60 * 1000;
    const recentActs = acts.filter(a => new Date(a.occurred_at).getTime() >= recentCutoff).length;
    let performance_tier: "active" | "average" | "low" = "low";
    if (recentActs >= 200) performance_tier = "active";
    else if (recentActs >= 50) performance_tier = "average";

    const avgSessionMs = totalSessions > 0 ? totalDurationMs / totalSessions : 0;
    const avgActsPerSession = totalSessions > 0 ? totalActivities / totalSessions : 0;
    const mostUsedTab = overallTabStats[0]?.tab_key || null;

    return {
      user_id: u.id,
      username: u.username,
      is_admin: u.is_admin,
      parent_user_id: u.parent_user_id,
      is_online: isOnline,
      active_session_count: userActiveSessions.length,
      last_login_at: lastLoginEv?.occurred_at || null,
      last_logout_at: lastLogoutEv?.occurred_at || null,
      total_sessions: totalSessions,
      total_duration_ms: totalDurationMs,
      total_activities: totalActivities,
      total_calcs: totalCalcs,
      total_saves: totalSaves,
      avg_session_ms: avgSessionMs,
      avg_acts_per_session: avgActsPerSession,
      most_used_tab: mostUsedTab,
      performance_tier,
      tab_stats: overallTabStats,
      sessions: sessionSummaries.slice(0, limit_users ? 50 : 200),
    };
  });

  return jsonResponse({ analytics });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...params } = await req.json();

    const sessionActions = ["login", "force_login", "verify_session", "logout", "change_password",
      "save_settings", "load_settings",
      "create_employee", "list_employees", "update_employee", "delete_employee", "check_employee_quotes", "transfer_quotes",
      "get_employee_tab_permissions", "update_employee_tab_permissions",
      "save_quote", "update_quote", "delete_quote", "list_quotes", "toggle_employees_view_quotes",
      "get_upload_url", "get_file_url", "delete_file",
      "log_activity_batch"];

    if (!sessionActions.includes(action)) {
      const result = await verifyAdmin(supabase, params.admin_username, params.admin_password);
      if ("error" in result) {
        return jsonResponse({ error: result.error }, result.status);
      }
    }

    switch (action) {
      case "login": return await handleLogin(supabase, params, req);
      case "change_password": return await handleChangePassword(supabase, params);
      case "force_login": return await handleForceLogin(supabase, params, req);
      case "verify_session": return await handleVerifySession(supabase, params);
      case "logout": return await handleLogout(supabase, params);
      case "list": return await handleList(supabase);
      case "login_logs": return await handleLoginLogs(supabase);
      case "get_user_analytics": return await handleGetUserAnalytics(supabase, params);
      case "log_activity_batch": return await handleLogActivityBatch(supabase, params);
      case "create": return await handleCreate(supabase, params);
      case "update": return await handleUpdate(supabase, params);
      case "delete": return await handleDelete(supabase, params);
      case "get_tab_permissions": return await handleGetTabPermissions(supabase, params);
      case "update_tab_permissions": return await handleUpdateTabPermissions(supabase, params);
      case "save_settings": return await handleSaveSettings(supabase, params);
      case "load_settings": return await handleLoadSettings(supabase, params);
      case "get_sessions": return await handleGetSessions(supabase, params);
      case "terminate_session": return await handleTerminateSession(supabase, params);
      case "create_employee": return await handleCreateEmployee(supabase, params);
      case "list_employees": return await handleListEmployees(supabase, params);
      case "update_employee": return await handleUpdateEmployee(supabase, params);
      case "delete_employee": return await handleDeleteEmployee(supabase, params);
      case "check_employee_quotes": return await handleCheckEmployeeQuotes(supabase, params);
      case "transfer_quotes": return await handleTransferQuotes(supabase, params);
      case "get_employee_tab_permissions": return await handleGetEmployeeTabPermissions(supabase, params);
      case "update_employee_tab_permissions": return await handleUpdateEmployeeTabPermissions(supabase, params);
      case "save_quote": return await handleSaveQuote(supabase, params);
      case "update_quote": return await handleUpdateQuote(supabase, params);
      case "delete_quote": return await handleDeleteQuote(supabase, params);
      case "list_quotes": return await handleListQuotes(supabase, params);
      case "toggle_employees_view_quotes": return await handleToggleEmployeesViewQuotes(supabase, params);
      case "get_upload_url": return await handleGetUploadUrl(supabase, params);
      case "get_file_url": return await handleGetFileUrl(supabase, params);
      case "delete_file": return await handleDeleteFile(supabase, params);
      default: return jsonResponse({ error: "إجراء غير معروف" }, 400);
    }
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: "حدث خطأ في الخادم" }, 500);
  }
});
