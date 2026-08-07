# 05 — Implementation Backlog (executor tickets)

> Phased, spec-linked tickets for the executor agents (Codex/GLM/MiniMax). **Work
> one ticket at a time**, follow `AGENTS.md`, and satisfy the **Acceptance** list
> before handing back. IDs are stable references. Ordering respects dependencies.
> Spec sources: `00`–`04` in this folder. Reference behavior: `manage-users/index.ts`.

Legend — **Files**: primary paths to create/change · **Refs**: spec + reference action ·
**Acceptance**: done criteria (all required).

---

## Phase 0 — Foundations

### BE-000 · Scaffold Laravel app
- **Files:** `backend/` (fresh Laravel), `routes/api.php` (`/api/v1` group), CORS config.
- **Refs:** `00 §2–3`.
- **Acceptance:** `composer install` + `php artisan serve` boot; `GET /api/v1/health` → `200 {ok:true}`; Pint configured.

### BE-001 · JWT auth wiring
- **Files:** install JWT lib (record in `AGENTS.md §7`), `config/auth.php` guard `api`→jwt, `php artisan jwt:secret`, `AppUser` implements `JWTSubject`.
- **Refs:** `03 §1` (JWT + session registry).
- **Acceptance:** can mint/verify a JWT for a user in a test; `jti` claim carries a `user_sessions.session_token`.

### BE-002 · Migrations + models for all 8 tables
- **Files:** `database/migrations/*` (app_users, user_sessions, session_events, login_logs, activity_events, saved_quotes, user_settings, user_tab_permissions), `app/Models/*` with `HasUuids`, relations, casts (jsonb→array).
- **Refs:** `02` (entire).
- **Acceptance:** `php artisan migrate` clean; unique/index constraints present exactly as `02`; factories exist.

### BE-003 · Error convention + admin seeder
- **Files:** exception handler mapping to **200-with-error-body** + `401 session_expired` + `500 "حدث خطأ في الخادم"`; `lang/ar` strings; `AdminSeeder` (env-driven).
- **Refs:** `03 §1`, `02 §2.1` (no legacy passwords).
- **Acceptance:** a thrown business error renders as `200 {error}`; seeder makes one admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD`; no `1234`/`M123123` anywhere.

---

## Phase 1 — Auth & sessions  *(depends: BE-000..003)*

### BE-010 · `EnsureSessionActive` middleware (jti allow-list)
- **Files:** `app/Http/Middleware/EnsureSessionActive.php`, register on `auth:api` routes.
- **Refs:** `03 §1`.
- **Acceptance:** deleting the `user_sessions` row makes the token 401 `session_expired`; `last_active_at` is touched per request.

### BE-011 · POST /auth/login
- **Files:** `AuthController@login`, `LoginRequest`, `AuthService`, `SessionService`, `UserResource`.
- **Refs:** `03 §3` + `handleLogin`.
- **Acceptance:** success body matches (`user`,`session_token`(JWT),`tab_permissions`,`settings`); device reuse by `device_id`; device-limit payload exact; bcrypt verify; **SHA-256→bcrypt auto-migrate**; writes `login_logs`+`session_events(login)`. Arabic errors verbatim.

### BE-012 · POST /auth/force-login
- **Refs:** `03 §3` + `handleForceLogin`.
- **Acceptance:** terminates selected/oldest session (logs `auto_logout`), re-checks cap, creates session; own-device reuse path; same success body.

### BE-013 · GET /auth/me  (+ POST /auth/heartbeat)
- **Refs:** `03 §3` + `handleVerifySession`.
- **Acceptance:** returns `{valid,user,tab_permissions}`; throttled `heartbeat` event (≤1/5min); expired → `401 session_expired`.

### BE-014 · POST /auth/logout
- **Acceptance:** deletes caller session, logs `logout`; idempotent; `{success:true}`.

### BE-015 · POST /auth/change-password
- **Refs:** `03 §3` + `handleChangePassword`.
- **Acceptance:** min-6 / must-differ / verify-old / active+not-expired; rehash; **invalidates all sessions**; exact Arabic strings.

### BE-016 · Idle-session prune on login (72h)
- **Acceptance:** sessions with `last_active_at` older than 72h are removed before the device-count check (parity with `cleanupIdleSessions`).

---

## Phase 2 — Settings, quotes, activity  *(depends: Phase 1)*

### BE-020 · GET/PUT /settings
- **Refs:** `03 §5` + `handleLoad/SaveSettings`.
- **Acceptance:** self-only (foreign `user_id` → `403 "غير مصرح"`); upsert on `(user_id,setting_key)`; GET returns `{settings:{key:value}}`.

### BE-021 · POST /quotes (create)
- **Acceptance:** creates under caller; returns `{quote}`; defaults match (`source_type` default `'calculator'`).

### BE-022 · GET /quotes (list + family visibility)
- **Refs:** `03 §6` + `handleListQuotes`.
- **Acceptance:** owner sees employees' quotes tagged `employee_username`; employee sees siblings always + owner's only if `employees_can_view_quotes` (tagged `is_parent_quote`); shape `{quotes,related_quotes}`. **Visibility matrix tests required.**

### BE-023 · PATCH/DELETE /quotes/{id}
- **Acceptance:** family-membership gate; `404 "العرض غير موجود"`, `403 "غير مصرح"`; update touches `updated_at`.

### BE-024 · POST /quotes/transfer
- **Acceptance:** owner-scoped checks on both ids; moves rows; `{success:true,transferred:N}`.

### BE-025 · POST /activity/batch
- **Refs:** `03 §7` + `handleLogActivityBatch`.
- **Acceptance:** accepts `sendBeacon` blob (`application/json`); caps 200; filters to allowed actions; tags caller+`jti`; `{success:true,logged:N}`; invalid session → `200 {session_expired:true}`; never throws.

---

## Phase 3 — Employees & permissions  *(depends: Phase 1)*

### BE-030 · POST /employees (create + cap + inherit)
- **Refs:** `03 §4` + `handleCreateEmployee`.
- **Acceptance:** enforces `max_employees` (`400 "وصلت للحد الأقصى من الموظفين (N)"`); copies owner's tab-permission rows; duplicate → `400 "اسم المستخدم موجود مسبقاً"`.

### BE-031 · GET /employees · BE-032 · PATCH /employees/{id}
- **Acceptance:** ownership gate (`parent_user_id=caller`); update supports `username,is_active,max_devices,password`.

### BE-033 · DELETE /employees/{id} (+ transfer_to)
- **Acceptance:** optional quote transfer to caller/own-employee before delete; ownership validated.

### BE-034 · GET /employees/{id}/quotes-count
- **Acceptance:** `{count:N}`, ownership gate.

### BE-035 · GET/PUT /employees/{id}/tab-permissions
- **Acceptance:** ownership gate; upsert on `(user_id,tab_key)`.

### BE-036 · POST /account/employees-view-quotes
- **Acceptance:** owner-only (`403 "غير مصرح - فقط المستخدم الرئيسي"`); toggles flag; returns new value.

---

## Phase 4 — Admin & analytics  *(depends: Phase 1)*

### BE-040 · Admin guard (role:admin) + retire per-request admin creds
- **Files:** `role:admin` middleware/policy; admin route group.
- **Refs:** `04 §3`, `03 §10`.
- **Acceptance:** non-admin → `403 "غير مصرح"`; admin identified by JWT (no body password).

### BE-041 · GET/POST /admin/users  ·  BE-042 · PATCH/DELETE /admin/users/{id}
- **Refs:** `03 §10`, `04 §5` + `handleList/Create/Update/Delete`.
- **Acceptance:** create seeds default tab permissions (exact enabled/disabled sets); duplicate handling; delete cascades; list includes `employees_can_view_quotes`.

### BE-043 · GET/PUT /admin/users/{id}/tab-permissions
- **Acceptance:** admin may edit any user; upsert; supports `default_tab:<key>`.

### BE-044 · GET /admin/users/{id}/sessions · BE-045 · DELETE /admin/sessions/{id}
- **Acceptance:** list sessions; terminate revokes the JWT (row delete); optional `auto_logout` event.

### BE-046 · GET /admin/login-logs · GET /admin/analytics
- **Refs:** `04 §4` + `handleLoginLogs`, `handleGetUserAnalytics`.
- **Acceptance:** login logs latest 100; analytics payload + heuristics match `04 §4.4–4.5` (online window, tab-duration gap rule, alerts, tiers, 20k caps).

---

## Phase 5 — Storage & voice  *(depends: Phase 1)*

### BE-050 · Storage disk + signed URLs
- **Files:** `config/filesystems.php` `montage` disk, `FilesController`, `StorageService`.
- **Refs:** `03 §8`.
- **Acceptance:** upload-url/download-url/delete; key `"{user_id}/{ts}-{sanitized}"`; **enforce caller prefix** on download/delete; private.

### BE-051 · POST /voice/parse
- **Refs:** `03 §9` + `parse-voice-input`.
- **Acceptance:** same Arabic system prompt + per-`calcType` field schema; returns `{fields,transcript}`; provider key server-side only.

---

## Phase 6 — Frontend cutover  *(depends: Phases 1–5 at parity)*

### FE-060 · `src/lib/apiClient.ts`
- **Acceptance:** base URL from `VITE_API_BASE_URL`; attaches `Authorization: Bearer`; reproduces `parseApiResponse` semantics (200-error, 401 `session_expired` → dispatch event).

### FE-061 · Rewire `userApi.ts` (no signature changes)
- **Acceptance:** every exported function maps its former `action` to the REST endpoint in `03 §2`; component code unchanged; JWT stored in `printCalc_session`; `device_id` logic kept.

### FE-062 · Rewire `activityTracker.ts`
- **Acceptance:** batching + `sendBeacon` preserved; only URL changes; points at `/activity/batch`.

### FE-063 · Admin functions → admin JWT
- **Acceptance:** admin calls stop sending `admin_password`; use admin JWT; UI unchanged.

### FE-064 · Env + base-URL toggle for verification
- **Acceptance:** app can run against Supabase or Laravel via env for side-by-side parity.

---

## Phase 7 — Data & storage migration  *(depends: Phase 6 in staging)*

### OPS-070 · DB export/import (8 tables, ids preserved)
- **Acceptance:** row counts equal per table; FKs intact; spot-check users log in.

### OPS-071 · Storage object copy
- **Acceptance:** `montage-files` objects copied to `montage` disk, keys preserved.

### OPS-072 · Rewrite attachment URLs in `saved_quotes.quote_data`
- **Acceptance:** existing attachments open via new signed URLs.

### OPS-073 · Go-live parity sign-off
- **Acceptance:** parity checklist (`03 §12`) archived across all endpoints.

---

## Phase 8 — Decommission Supabase  *(depends: Phase 7 verified)*

### OPS-080 · Remove Supabase from frontend
- **Acceptance:** delete `src/integrations/supabase/`; `bun remove @supabase/supabase-js`; 0 `supabase`/`functions/v1`/`manage-users` refs in `src/`.

### OPS-081 · Env & secrets cleanup
- **Acceptance:** remove `VITE_SUPABASE_*`; add `VITE_API_BASE_URL`; rotate/scrub old service-role key; revoke `LOVABLE_API_KEY` if provider changed.

### OPS-082 · Archive `supabase/` → `legacy/` (or delete)
- **Acceptance:** reference kept out of build; CI updated.

### OPS-083 · Backup, pause, then delete Supabase project
- **Acceptance:** final DB+storage backup taken; project paused; deleted after the safety window; DNS/CI/webhooks updated.

---

## Suggested order & parallelism
- Serial spine: **BE-000→001→002→003→010→011**.
- After BE-011: Phases **2, 3, 4, 5** can run in parallel (independent resource groups).
- **Phase 6** starts once the endpoints a screen needs are at parity (can go screen-by-screen).
- **Phases 7–8** are ops, gated on staging parity sign-off.
