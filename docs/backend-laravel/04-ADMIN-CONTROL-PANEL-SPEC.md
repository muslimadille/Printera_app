# 04 — Admin Control Panel Specification

> Contract for the **Admin Control Panel** (backend endpoints + the data shapes the
> panel renders). Today the admin UI lives inside the SPA as the `users` and
> `loginhistory` tabs (`src/components/UserManagement.tsx`, `LoginHistory.tsx`) and is
> powered by the admin actions in `manage-users`. The rebuild exposes the same
> capabilities as **`/api/v1/admin/*`** behind an **admin JWT + `role:admin` policy**.

---

## 1. Scope & audience

- **Audience:** platform admins (`is_admin = true`) — the Printera/Sanabil operator.
- **Purpose:** manage tenant accounts (owners) and their employees, control feature
  access (tab permissions), monitor login history and per-user usage analytics, and
  manage active device sessions.
- **Not** a tenant tool — account owners manage their own employees via `/employees`
  (see `03-API-SPECIFICATION.md §4`). The admin panel can see across all tenants.

---

## 2. Panel sections (map to endpoints)

| Section | What it does | Endpoints |
|---|---|---|
| **Users list** | table of all accounts (owners, employees, admins) with status, role, subscription, device/employee caps, online indicator | `GET /admin/users`, `GET /admin/analytics` |
| **Create / edit user** | create accounts, set `is_admin`, `expires_at`, `max_devices`, `max_employees`, reset password, activate/deactivate | `POST /admin/users`, `PATCH /admin/users/{id}` |
| **Delete user** | remove an account (cascades sessions/quotes/settings/permissions/employees) | `DELETE /admin/users/{id}` |
| **Tab permissions** | per-user feature flags + default tab | `GET/PUT /admin/users/{id}/tab-permissions` |
| **Sessions / devices** | list a user's active sessions, terminate one | `GET /admin/users/{id}/sessions`, `DELETE /admin/sessions/{id}` |
| **Login history** | recent logins (username, ip, time) | `GET /admin/login-logs` |
| **User analytics** | per-user usage: online status, totals, per-session breakdown, tab usage, performance tier, heuristic alerts | `GET /admin/analytics?user_id=` |

---

## 3. Authorization

- Every `/admin/*` route requires a valid **admin JWT** (`role(caller)=admin`) via a
  `role:admin` middleware/policy. Non-admin → `403 { "error": "غير مصرح" }`.
- This **replaces** the current pattern of sending `admin_username` + `admin_password`
  in each request body (`verifyAdmin`). Coordinate the FE change in `userApi.ts`
  (admin functions keep their signatures during transition; the password stops being
  sent once admin-JWT is live — see `03 §10`).

---

## 4. Data shapes

### 4.1 AppUser (list / CRUD)
```ts
{ id, username, is_active, is_admin, expires_at, created_at,
  max_devices, max_employees, parent_user_id }
```
`GET /admin/users` additionally returns `employees_can_view_quotes`.

### 4.2 UserSession
```ts
{ id, user_id, session_token, device_id, device_info, ip_address, last_active_at, created_at }
```

### 4.3 LoginLog
```ts
{ id, user_id, username, logged_in_at, ip_address }
```

### 4.4 UserAnalytics (the analytics dashboard payload)
Port `handleGetUserAnalytics` exactly. Per user:
```ts
{
  user_id, username, is_admin, parent_user_id,
  is_online,                    // any active session touched in last 2 min
  active_session_count,
  last_login_at, last_logout_at,
  total_sessions, total_duration_ms,
  total_activities, total_calcs, total_saves,
  avg_session_ms, avg_acts_per_session,
  most_used_tab,
  performance_tier,             // 'active' (≥200 acts/30d) | 'average' (≥50) | 'low'
  tab_stats: [ { tab_key, count, duration_ms } ],
  sessions: [ UserSessionSummary ]   // capped (200, or 50 when listing all users)
}
```
`UserSessionSummary`:
```ts
{ session_token, started_at, ended_at, last_event_type,
  duration_ms, device_info, ip_address,
  event_count, activity_count, calc_count, save_count,
  is_active,
  alerts: string[],             // 'long_session' | 'many_calc_no_save' | 'frequent_tab_switching'
  tab_stats: [ { tab_key, count, duration_ms } ],
  events: [ { event_type, occurred_at, device_info, ip_address } ],
  activities: [ { tab_key, action, details, occurred_at } ] }
```

### 4.5 Computation rules (must match current heuristics)
- **Online window:** active session with `last_active_at` within **2 min** → online.
- **Tab duration:** sum gaps between consecutive activity events in the same tab, only
  counting gaps `< 5 min` (idle gaps beyond 5 min don't accrue time).
- **Session grouping:** group `session_events` + `activity_events` by `session_token`
  (synthesize a key for legacy null-token rows by minute bucket).
- **Alerts:** `long_session` if duration > 4h; `many_calc_no_save` if `calc_count>10 &&
  save_count==0`; `frequent_tab_switching` if `tab_open` count > 30 in a session.
- **Performance tier:** count activities in last 30 days → `active`≥200, `average`≥50, else `low`.
- **Data window caps:** read at most 20k `session_events` and 20k `activity_events` per
  query (as today). Note: fine at current scale; revisit with an aggregation table if data grows.
  ⚠ The rows are ordered **oldest-first**, so past 20k events the window shows the *oldest*
  slice, not the most recent. Ported as-is; this is the concrete symptom the aggregation
  table would fix.
- **Legacy tokenless rows** are grouped **asymmetrically**: `session_events` without a
  `session_token` bucket by the *minute* they occurred in, while `activity_events` without
  one all share a *single* bucket. Reproduced deliberately — changing it would redraw
  session boundaries in historical data. See PHASE-0-1-AUDIT.md §7c.
- **`is_active`** on a session summary is a real boolean. The reference emits `null` for
  tokenless sessions (`s.token && …`), contradicting its own TypeScript interface.

---

## 5. Behavioral rules for admin operations

- **Create user** seeds default tab permissions: enabled `['costcalc','savedquotes',
  'settings','papertypes']`; disabled `['calculator','employee','quote','finishing',
  'magazine','manual','boxpricing','guide','bulkimport']` (port `handleCreate`). The rest
  fall back to the `DEFAULT_ON_KEYS` resolution rule at read time.
- **Deactivate vs delete:** prefer `is_active=false` (reversible; blocks login) over delete.
  Delete cascades and is irreversible.
- **Subscription:** `expires_at` in the past blocks login with `"انتهت صلاحية هذا الحساب"`.
- **Reset password (admin):** `PATCH /admin/users/{id}` with `password` → rehash (bcrypt).
  Because there is **no email** (locked decision), this admin/owner reset is the **intended**
  password-recovery path — document it in the panel UI copy.
- **Terminate session:** deletes the `user_sessions` row → its JWT `jti` stops validating
  (immediate revocation). Optionally log `auto_logout` in `session_events`.
- **Tab permissions:** `PUT` upserts on `(user_id, tab_key)`; support the special
  `default_tab:<key>` row for the user's landing tab.

---

## 6. Panel UX notes (for the existing SPA admin tabs)

The current admin UI already implements most of this in `UserManagement.tsx`
(user table + per-user analytics dialog with session list, tab-usage bars, performance
badge, online dot) and `LoginHistory.tsx`. The rebuild should:
- Keep these components; only their data now comes from `/admin/*` via `userApi.ts`.
- Keep Arabic labels and the performance badges (`نشط / متوسط / منخفض`).
- Add nothing to the client's trust boundary — all authorization stays server-side.

---

## 7. Future (optional, post-parity)

- Cross-tenant search/filter and CSV export of users/logs.
- Aggregated analytics tables (daily rollups) to remove the 20k-row in-request scan.
- Audit trail for admin actions (who created/deleted/deactivated whom).
- A dedicated admin JWT scope/guard separate from tenant tokens.
These are **not** required for parity and must be separate tickets.
