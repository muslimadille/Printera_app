# Phase 0 & 1 — Detailed, Ready-to-Execute Tickets

> Fully specified tickets for the **Foundations** (BE-000..003) and **Auth &
> Sessions** (BE-010..016) phases. Each ticket is self-contained: context, exact
> files, step-by-step, code contracts, and acceptance tests. Follow `AGENTS.md`.
> A working scaffold that already realizes most of this lives in **`backend/`** —
> these tickets describe what "done" means and what remains to wire after
> `composer install`.
>
> **Reference behavior (source of truth):** `supabase/functions/manage-users/index.ts`.
> **Specs:** `../03-API-SPECIFICATION.md`, `../02-DATABASE-SCHEMA.md`, `../01-ROLES-AND-PERMISSIONS.md`.

---

## Conventions used below

- **Business error** = HTTP `200` + `{ "error": "<arabic>", ...flags }`.
- **Auth failure** = HTTP `401` + `{ "error": "...", "session_expired": true }`.
- Arabic strings are **copied verbatim** from `manage-users`. They are collected in
  `App\Support\Messages` (scaffold) — never retype them inline.
- JWT `jti` claim == the `user_sessions.session_token` value (the allow-list key).
- All timestamps ISO-8601 UTC.

---

# PHASE 0 — Foundations

## BE-000 · Scaffold Laravel app + `/api/v1` + health
**Goal:** a booting Laravel **12** app with an `/api/v1` route group and JSON error handling.

> **Version correction (verified 2026-08-07).** This ticket originally said Laravel 11.
> Composer cannot install *any* 11.x release — all are blocked by unpatched advisories
> (`PKSA-mdq4-51ck-6kdq` / CVE-2026-48019, `PKSA-3r5d-mb8f-1qw9`, and
> `PKSA-m5cs-t1y6-qpcs` temporary signed-URL path confusion, which BE-050 relies on).
> There is no patched 11.x. Pin `laravel/framework: ^12.61.1` and
> `php-open-source-saver/jwt-auth: ^2.8`. Laravel 12 keeps the 11 skeleton, so no
> application code changed. See `PHASE-0-1-AUDIT.md` §0b.

**Files**
- `backend/composer.json`, `backend/bootstrap/app.php`, `backend/routes/api.php`,
  `backend/public/index.php`, `backend/artisan`, `backend/.env.example`,
  `backend/config/cors.php`.

**Steps**
1. `composer install` (pulls Laravel 12 + `php-open-source-saver/jwt-auth`).
2. `cp .env.example .env && php artisan key:generate`.
3. Confirm `bootstrap/app.php` loads `routes/api.php` under prefix `api` and the app
   version group is nested at `/api/v1` (see scaffold `routes/api.php`).
4. Add `GET /api/v1/health` → `{ "ok": true }`.

**Driver decision (F3).** `.env.example` keeps `CACHE_STORE=database`,
`QUEUE_CONNECTION=database`, `SESSION_DRIVER=database`, and the scaffold now ships the
standard Laravel migrations that back them: `create_cache_table`, `create_jobs_table`,
`create_job_batches_table`, `create_failed_jobs_table`, `create_sessions_table`. Without
them the first cache/queue write — including the `throttle:auth` rate limiter that
`03 §11` calls for — failed on a missing relation, and only under load.

**Acceptance**
- [x] `php artisan serve` boots; `GET /api/v1/health` returns `200 {"ok":true}`.
- [x] CORS allows the SPA origin(s) from `.env` (`FRONTEND_URLS`).
- [x] `./vendor/bin/pint --test` passes.
- [x] Cache/queue/session tables exist, so the committed `.env` drivers work out of the box.

---

## BE-001 · JWT auth wiring
**Goal:** JWT guard configured; `AppUser` is a JWT subject; `jti` carries the session token.

**Files**
- `backend/config/auth.php` (guard `api` → driver `jwt`, provider `app_users`),
- `backend/app/Models/AppUser.php` (`implements JWTSubject`),
- `.env.example` (`JWT_TTL`, `JWT_SECRET` placeholder).

**Steps**
1. `php artisan vendor:publish --provider="PHPOpenSourceSaver\JWTAuth\Providers\LaravelServiceProvider"`.
2. `php artisan jwt:secret` (writes `JWT_SECRET`).
3. In `config/auth.php`: set default guard `api`; `guards.api = { driver: jwt, provider: app_users }`;
   `providers.app_users = { driver: eloquent, model: App\Models\AppUser }`.
4. `AppUser` implements `getJWTIdentifier()` (returns `id`) and
   `getJWTCustomClaims()` (returns `['role' => $this->role()]`). The **`jti` is set at
   login time** to the `user_sessions.session_token` via `JWTAuth::claims(['jti'=>$token])`.

**Contract**
```php
// AppUser
public function getJWTIdentifier(): mixed { return $this->getKey(); }
public function getJWTCustomClaims(): array { return ['role' => $this->role()]; }
public function role(): string {
    return $this->is_admin ? 'admin' : ($this->parent_user_id === null ? 'account_owner' : 'employee');
}
```

**Acceptance**
- [ ] A test can mint a JWT for a user and decode `sub`, `role`, and a custom `jti`.
- [ ] `JWT_TTL` configurable (default 43200 min = 30 days, matching "remember me").

---

## BE-002 · Migrations + models for all 8 tables
**Goal:** schema identical to `02-DATABASE-SCHEMA.md`; UUID PKs; jsonb casts.

**Files** — `backend/database/migrations/*` (8) and `backend/app/Models/*` (8):
`app_users, user_sessions, session_events, login_logs, activity_events,
saved_quotes, user_settings, user_tab_permissions`.

**Key rules**
- UUID PK via `HasUuids`; `$incrementing=false`, `$keyType='string'`.
- `app_users`: `unique(username)`, self-FK `parent_user_id` ON DELETE CASCADE,
  index on `parent_user_id`. Hidden: `password_hash`. Casts: booleans, `expires_at`→datetime.
- `user_sessions`: `unique(session_token)`, `unique(user_id,device_id) where device_id not null`,
  index `last_active_at`. `$timestamps=false` (only `created_at` + `last_active_at`).
- `user_settings`: `unique(user_id,setting_key)`; `setting_value` cast `array`.
- `user_tab_permissions`: `unique(user_id,tab_key)`; `$timestamps=false` (created_at only).
- `saved_quotes`: `quote_data` cast `array`.
- `session_events`: `event_type` CHECK in (`login,logout,heartbeat,auto_logout`); `$timestamps=false`.
- `activity_events`: `details` cast `array`; indexes per spec; `$timestamps=false`.
- `login_logs`: `$timestamps=false` (`logged_in_at` only).

**Acceptance**
- [ ] `php artisan migrate` runs clean on Postgres **and** SQLite (for tests).
- [ ] Every unique/index constraint from `02` exists (assert via a schema test or `migrate:status` + review).
- [ ] Models expose the relationships in `02 §3` (`employees()`, `sessions()`, `quotes()`, `settings()`, `tabPermissions()`, `parent()`).

---

## BE-003 · Error convention, messages, admin seeder
**Goal:** the 200-with-error-body convention, Arabic message catalog, and a safe admin seed.

**Files**
- `backend/app/Support/ApiResponse.php`, `backend/app/Exceptions/ApiException.php`,
  `backend/app/Support/Messages.php`, `backend/bootstrap/app.php` (exception rendering),
  `backend/database/seeders/{DatabaseSeeder,AdminSeeder}.php`, `.env.example`.

**Contracts**
```php
// ApiException — thrown anywhere; rendered by bootstrap/app.php withExceptions
ApiException::business(string $msg, array $extra = []);      // → 200 {error, ...extra}
ApiException::sessionExpired(string $msg = Messages::SESSION_INVALID); // → 401 {error, session_expired:true}
ApiException::forbidden(string $msg = Messages::NOT_AUTHORIZED);       // → 403 {error}

// ApiResponse helpers
ApiResponse::ok(array $data);        // 200
ApiResponse::business(string $msg, array $extra=[]); // 200 {error,...}
```
- `bootstrap/app.php` `->withExceptions()` renders `ApiException` to the shapes above,
  and maps uncaught throwables to `500 {"error":"حدث خطأ في الخادم"}` for `/api/*`.
- `Messages` holds every Arabic string as a constant (see scaffold).

**Admin seeder**
- Reads `ADMIN_USERNAME` / `ADMIN_PASSWORD` from env; creates one admin
  (`is_admin=true, is_active=true`) with a **bcrypt** hash. Aborts if either env is missing.
- **Must NOT** contain `1234`, `M123123`, or the legacy `owner` seed.

**Acceptance**
- [ ] Throwing `ApiException::business('x')` yields `200 {"error":"x"}`.
- [ ] Uncaught error on an `/api` route yields `500 {"error":"حدث خطأ في الخادم"}`.
- [ ] `php artisan db:seed --class=AdminSeeder` creates exactly one admin from env; fails loudly without env.
- [ ] No legacy passwords anywhere in `database/`.

---

# PHASE 1 — Auth & Sessions

## BE-010 · `EnsureSessionActive` middleware (jti allow-list)
**Goal:** make JWTs **revocable** by checking the `jti` against `user_sessions`.

**Files** — `backend/app/Http/Middleware/EnsureSessionActive.php`; alias `session.active`
in `bootstrap/app.php`; apply to the `auth:api` route group.

**Logic**
1. Resolve the JWT (via the `api` guard) **and** the user from `sub`, both inside one
   `try`. Invalid/expired/unknown-subject → `ApiException::sessionExpired()`.
2. Read `jti` claim; find `user_sessions` where `session_token = jti` **and
   `user_id = sub`**. Missing → `ApiException::sessionExpired(Messages::SESSION_ENDED)`.
3. `!is_active` → `sessionExpired(Messages::ACCOUNT_DISABLED)`.
4. `touch` `last_active_at = now()`. Stash the session + user on the request.

> **Locked: no `expires_at` check here.** `handleVerifySession` checks only `is_active`, so
> an expired subscription keeps working until logout. Only `POST /auth/login` rejects an
> expired account. Adding a check here would diverge from Supabase in both directions —
> intentional parity, see `PHASE-0-1-AUDIT.md` F10 and `03-API-SPECIFICATION.md` §Auth.

**Acceptance**
- [x] Deleting the `user_sessions` row → next request returns `401 session_expired`.
- [x] Each authed request updates `last_active_at`.
- [x] Inactive account → `401 session_expired` with the right Arabic string.
- [x] **Expired** account with a live session → still `200` (parity, not a bug).
- [x] A `jti` whose session belongs to a different `user_id` → `401 session_expired`.

---

## BE-011 · `POST /auth/login`
**Goal:** parity with `handleLogin` incl. device reuse, device limit, hash migrate, logging.

**Files** — `AuthController@login`, `Http/Requests/Auth/LoginRequest`,
`Services/AuthService::login()`, `Services/SessionService`, `Http/Resources/UserResource`.

**Algorithm (port exactly)**
1. Find `app_users` by `username`, `is_active=true`. Not found → `Messages::BAD_CREDENTIALS` (business 200).
2. `verifyPassword(password, hash)`:
   - if hash is 64-hex → SHA-256 compare; on success **re-hash to bcrypt** (`migrateHashIfNeeded`).
   - else `password_verify` (bcrypt).
   Fail → `BAD_CREDENTIALS`.
3. `expires_at` past → `Messages::ACCOUNT_EXPIRED`.
4. `SessionService::pruneIdle(user)` (delete sessions with `last_active_at < now()-72h`).
5. **Device reuse:** if `device_id` present and a row exists for `(user_id, device_id)` →
   rotate its `session_token` (new random 64-hex), update `device_info/ip/last_active_at`,
   write `login_logs` + `session_events(login)`, mint JWT with `jti=session_token`, return success.
6. Else count active sessions; if `>= max_devices` (default 1 when null) → **device-limit payload**
   (`device_limit_reached:true`, `active_sessions:[{id,device_info,last_active_at}]`, `max_devices`).
7. Else insert a new `user_sessions` row (new token, device fields), write `login_logs` +
   `session_events(login)`, mint JWT, return success.

**Success body** (`03 §3`): `{ success, user: UserResource, session_token:<JWT>, tab_permissions:[…], settings:{…} }`.
`UserResource` = `{ id, username, is_admin, max_employees, employees_can_view_quotes, parent_user_id }`.
`settings` = map of `user_settings.setting_key → setting_value`.

**Acceptance**
- [ ] Valid login returns the exact success shape; `session_token` is a decodable JWT whose `jti` == the new `user_sessions.session_token`.
- [ ] Same `device_id` re-login reuses the row (session count unchanged) and rotates the token.
- [ ] `max_devices` exceeded → device-limit payload (200) with active sessions listed.
- [ ] SHA-256 user logs in and the stored hash becomes bcrypt afterwards.
- [ ] Wrong password / inactive / expired → correct Arabic business errors (200).
- [ ] `login_logs` + `session_events(login)` rows written with ip from `x-forwarded-for`/`cf-connecting-ip`.

> **Client IP semantics (decided).** Resolution order is `x-forwarded-for` (first hop) →
> `cf-connecting-ip` → `$request->ip()`. The reference stores `NULL` when neither header is
> present; the socket-IP fallback is a deliberate improvement — an audit row with an IP
> beats one without, and no client behavior depends on the null. `->trustProxies()` is
> **deferred to Phase 5**: it changes what `$request->ip()` means behind a load balancer and
> is needed for `URL::temporarySignedRoute()` to emit `https://` in BE-050, so it belongs in
> that ticket where it can be tested against the real deployment topology.
> See `PHASE-0-1-AUDIT.md` F8.

---

## BE-012 · `POST /auth/force-login`
**Goal:** parity with `handleForceLogin` (terminate the selected/oldest session, then log in).

**Files** — `AuthController@forceLogin`, `ForceLoginRequest`, `AuthService::forceLogin()`.

**Algorithm**
1. Validate credentials as in BE-011 (no expiry check needed before termination — match reference: it verifies user+password, then prunes idle).

> **Locked: force-login never checks `expires_at`.** `handleForceLogin` has no expiry
> branch, so an expired account that hits the device cap can force-login and keep working.
> Combined with BE-010 (middleware also does not check), the net behavior matches Supabase
> exactly: only `POST /auth/login` rejects an expired account, and an expired subscription
> continues to function until logout. Confirmed product decision — do not add a check.
> See `PHASE-0-1-AUDIT.md` F10.
2. **Own-device reuse** first (same as login step 5) → return success.
3. Else terminate `terminate_session_ids[0]` (safety: only one) belonging to the user:
   log `session_events(auto_logout)` for it, delete the row. If none supplied, delete the **oldest** by `last_active_at` (also log `auto_logout`).
4. Re-check remaining sessions vs `max_devices`; still `>=` → `403 { error: Messages::STILL_TOO_MANY_DEVICES }`.
5. Create session, write logs, mint JWT, return success (same body as login).

**Acceptance**
- [ ] Terminating the selected session frees a slot and logs `auto_logout`; login then succeeds.
- [ ] Own-device path reuses the row.
- [ ] If still over the cap after termination → `403` with the exact Arabic string.

---

## BE-013 · `GET /auth/me` — the sole heartbeat endpoint
**Goal:** parity with `handleVerifySession` — refresh activity, throttle heartbeat log, return latest permissions.

**Files** — `AuthController@me`.

> **Locked: there is no `POST /auth/heartbeat`.** An earlier draft of this ticket said
> "keep both". That is withdrawn. `EnsureSessionActive` refreshes `last_active_at` on every
> authenticated request, so a client polling a separate heartbeat endpoint keeps the
> timestamp permanently fresh — the 5-minute throttle in `me()` can then never fire, and
> `session_events(heartbeat)` rows stop entirely. Admin analytics derives per-session
> `duration_ms` and `is_active` from exactly those rows, so the regression would only
> surface in Phase 4. One polling endpoint, and it writes the audit event.
> See `PHASE-0-1-AUDIT.md` F5.

**Algorithm (`/auth/me`)**
1. Middleware `session.active` has already validated + touched `last_active_at`.
2. If `now - previous last_active_at > 5 min` → write `session_events(heartbeat)` (throttle).
3. Return `{ valid:true, user: UserResource, tab_permissions:[…] }`.

The client keeps polling `/auth/me` every 60s, exactly as today.

**Acceptance**
- [ ] `/auth/me` returns `valid:true` + fresh `tab_permissions`.
- [ ] A heartbeat row is written at most once per 5 minutes per session.
- [ ] Revoked/expired session → `401 session_expired` (from middleware).

---

## BE-014 · `POST /auth/logout`
**Goal:** parity with `handleLogout`.

**Algorithm**: find the caller's session by `jti`; write `session_events(logout)` (capture
user/device/ip before delete); delete the `user_sessions` row. Return `{ success:true }`. Idempotent.

**Acceptance**
- [ ] Session row removed; `logout` event written; token no longer validates.
- [ ] Calling twice does not error.

---

## BE-015 · `POST /auth/change-password`
**Goal:** parity with `handleChangePassword` (unauthenticated; username+old+new in body).

**Rules** (return the exact Arabic strings as **business 200**):
- Missing fields → `Messages::INCOMPLETE_DATA`.
- `new_password` shorter than 6 → `Messages::PASSWORD_TOO_SHORT`.
- `new_password === old_password` → `Messages::PASSWORD_MUST_DIFFER`.
- User not found / inactive → `Messages::BAD_CREDENTIALS`.
- `old_password` wrong → `Messages::CURRENT_PASSWORD_WRONG`.
- `expires_at` past → `Messages::ACCOUNT_EXPIRED`.
- On success: bcrypt-hash new password, **delete ALL** `user_sessions` for the user, return `{ success:true }`.

**Acceptance**
- [ ] Each failure branch returns the correct Arabic string with HTTP 200.
- [ ] Success re-hashes and invalidates every session (all tokens for that user 401 afterward).

---

## BE-016 · Idle-session prune on login (72h)
**Goal:** parity with `cleanupIdleSessions` — runs before the device-count check in login & force-login.

**Files** — `SessionService::pruneIdle(AppUser $user)`.

**Acceptance**
- [ ] Sessions with `last_active_at < now()-72h` are deleted before counting devices.
- [ ] A user at the device cap whose other session is >72h idle can log in on a new device without a force-login.

---

## Phase 0/1 exit criteria (integration)
- [ ] Full happy path in a feature test: **login → me → me(heartbeat throttle) → logout**.
- [ ] Device-limit → force-login flow test.
- [ ] Change-password invalidates sessions test.
- [ ] SHA-256→bcrypt migration test.
- [ ] All Arabic strings asserted against `App\Support\Messages` (which mirrors `manage-users`).
- [ ] `pint --test` clean; `php artisan test` green (SQLite).
