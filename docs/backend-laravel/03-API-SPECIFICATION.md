# 03 — REST API Specification (Laravel, JWT, mobile-ready)

> Full contract for the Laravel API that replaces `manage-users`. Every endpoint
> traces to a current action. Base path **`/api/v1`**, JSON only. Preserve the
> **200-with-error-body** convention and **Arabic** messages verbatim.
> Roles/authorization: `01-ROLES-AND-PERMISSIONS.md`. Schema: `02-DATABASE-SCHEMA.md`.

---

## 1. Conventions

- **Base URL:** `{host}/api/v1`. Frontend reads it from `VITE_API_BASE_URL`.
- **Content type:** `application/json` for requests and responses.
- **Auth header:** `Authorization: Bearer <JWT>` on authenticated endpoints.
  (The old public `apikey` header is dropped.)
- **Success:** HTTP `200`/`201` with a resource body.
- **Business errors (KEEP THIS):** HTTP **`200`** with `{ "error": "<arabic>" , ...flags }`.
  The frontend's `parseApiResponse` treats any body with `error`,
  `device_limit_reached`, or `session_expired` as a thrown error. **Match this.**
- **Auth failure:** HTTP **`401`** with `{ "error": "...", "session_expired": true }`.
  The client maps 401 / `session_expired` → dispatch `printCalc:sessionExpired` → force logout.
- **Validation failure:** return the same 200-error shape (not Laravel's default 422)
  for endpoints the current client calls, to avoid changing `userApi.ts` error handling.
  Concretely: `200 { "error": "البيانات غير مكتملة", "errors": { field: [...] } }`. The
  Arabic constant (`Messages::INCOMPLETE_DATA`) is what the SPA renders — Laravel's
  per-field messages are English and would land in an Arabic RTL UI — while the field
  detail is preserved under `errors`, which the client ignores.
- **Server error:** HTTP `500` with `{ "error": "حدث خطأ في الخادم" }`.
- **Timestamps:** ISO-8601 UTC strings (as today).
- **Rate limiting:** throttle `login`/`force_login`/`change_password` (new; see §11).

### JWT + session registry (the core auth mechanic)
- Login issues a JWT with claims: `sub` = user id, `jti` = **the `user_sessions.session_token`
  value** (unique), plus `role`. TTL configurable (e.g. 30 days to match "remember me").
- **`EnsureSessionActive` middleware** on every authenticated route:
  1. Validate JWT signature/expiry, and resolve the user from `sub`.
  2. Look up `user_sessions` where `session_token = jti` **and `user_id = sub`**. If missing
     → **401 `session_expired`** (this is how force-logout / device termination revokes a
     token). Scoping by `user_id` binds the two independent claims so a token-issuance bug
     fails closed rather than crossing tenants.
  3. If `!is_active` → 401. **`expires_at` is NOT checked here** — see `/auth/me`.
  4. Touch `last_active_at`.
- Device limit, force-login, heartbeat, idle-prune all operate on `user_sessions`
  exactly as the current function does.

---

## 2. Endpoint map (action → REST)

### Auth & session
| Current action | Method & path | Auth |
|---|---|---|
| `login` | `POST /auth/login` | public |
| `force_login` | `POST /auth/force-login` | public |
| `verify_session` | `GET /auth/me` | JWT |
| (heartbeat — part of `verify_session`, **no separate endpoint**) | `GET /auth/me` | JWT |
| `logout` | `POST /auth/logout` | JWT |
| `change_password` | `POST /auth/change-password` | public (username+old pw in body, as today) |

### Account owner — employees
| `create_employee` | `POST /employees` | owner |
| `list_employees` | `GET /employees` | owner |
| `update_employee` | `PATCH /employees/{id}` | owner |
| `delete_employee` | `DELETE /employees/{id}` (`?transfer_to=`) | owner |
| `check_employee_quotes` | `GET /employees/{id}/quotes-count` | owner |
| `transfer_quotes` | `POST /quotes/transfer` | owner |
| `get_employee_tab_permissions` | `GET /employees/{id}/tab-permissions` | owner |
| `update_employee_tab_permissions` | `PUT /employees/{id}/tab-permissions` | owner |
| `toggle_employees_view_quotes` | `POST /account/employees-view-quotes` | owner |

### Settings & quotes (any authenticated user)
| `save_settings` | `PUT /settings` | JWT (self) |
| `load_settings` | `GET /settings` | JWT (self) |
| `save_quote` | `POST /quotes` | JWT |
| `update_quote` | `PATCH /quotes/{id}` | JWT (family) |
| `delete_quote` | `DELETE /quotes/{id}` | JWT (family) |
| `list_quotes` | `GET /quotes` | JWT |

### Activity
| `log_activity_batch` | `POST /activity/batch` | JWT (also accepts `sendBeacon`) |

### Files (storage)
| `get_upload_url` | `POST /files/upload-url` | JWT |
| `get_file_url` | `POST /files/download-url` | JWT |
| `delete_file` | `POST /files/delete` | JWT |

### Voice
| (parse-voice-input fn) | `POST /voice/parse` | JWT |

### Admin only
| `list` | `GET /admin/users` | admin |
| `create` | `POST /admin/users` | admin |
| `update` | `PATCH /admin/users/{id}` | admin |
| `delete` | `DELETE /admin/users/{id}` | admin |
| `get_tab_permissions` | `GET /admin/users/{id}/tab-permissions` | admin |
| `update_tab_permissions` | `PUT /admin/users/{id}/tab-permissions` | admin |
| `get_sessions` | `GET /admin/users/{id}/sessions` | admin |
| `terminate_session` | `DELETE /admin/sessions/{sessionId}` | admin |
| `login_logs` | `GET /admin/login-logs` | admin |
| `get_user_analytics` | `GET /admin/analytics` (`?user_id=`) | admin |

> **Admin auth change:** today admin endpoints resend `admin_username`+`admin_password`.
> The rebuild uses the **admin's JWT** + a `role:admin` policy. Coordinate the matching
> `userApi.ts` change (the functions currently take `adminUsername, adminPassword` — keep
> the signature but ignore/stop sending the password once JWT admin is live; see §10).

---

## 3. Auth endpoints (detailed)

### POST /auth/login
Request:
```json
{ "username": "string", "password": "string",
  "device_info": "string?", "device_id": "string?" }
```
Behavior (port `handleLogin`): verify active + not expired + password (bcrypt, with
SHA-256 auto-migrate). Idle-prune (>72h). If `device_id` already has a session → **reuse**
(rotate token). Else if `active_sessions >= max_devices` → return **device-limit payload**.
Else create session. Write `login_logs` + `session_events(login)`.

Success `200`:
```json
{ "success": true,
  "user": { "id","username","is_admin","max_employees","employees_can_view_quotes","parent_user_id" },
  "session_token": "<JWT>",
  "tab_permissions": [ { "tab_key","is_enabled" } ],
  "settings": { "paperTypes": ..., "priceSettings": ..., "finishingItems": ..., "profitMargins": ... } }
```
> `session_token` now carries the **JWT** (the client already stores it as `session_token`).

Device-limit `200`:
```json
{ "success": false, "error": "تم الوصول للحد الأقصى من الأجهزة المسموح بها. يرجى تسجيل الخروج من جهاز آخر أولاً",
  "device_limit_reached": true, "max_devices": 2,
  "active_sessions": [ { "id","device_info","last_active_at" } ] }
```
Invalid creds / inactive / expired `200`: `{ "error": "اسم المستخدم أو كلمة المرور غير صحيحة" }`
(or `"انتهت صلاحية هذا الحساب"`). **Do not** reveal which field was wrong.

### POST /auth/force-login
Request adds `terminate_session_ids: string[]` (client sends exactly one — the oldest/selected).
Behavior = `handleForceLogin`: reuse own device if present; else terminate the selected
(or oldest) session, log `auto_logout`, re-check cap, create session. Same success body as login.

> **Expiry is deliberately NOT checked here.** `handleForceLogin` verifies username +
> password only — it has no `expires_at` branch — so an expired account that hits the device
> cap can still force-login and keep working. **Locked decision: match Supabase exactly.**
> `POST /auth/login` is the *only* endpoint that rejects an expired account; neither
> `/auth/force-login` nor the `EnsureSessionActive` middleware does. Net observable
> behavior: an expired subscription continues to function until the user logs out.
> Do not "fix" this without a product decision — see `PHASE-0-1-AUDIT.md` F10.

### GET /auth/me  (replaces `verify_session`) — **the sole heartbeat endpoint**
Auth: JWT. Behavior = `handleVerifySession`: touch `last_active_at`, throttled `heartbeat`
event (≤ once / 5 min), return latest tab permissions. The client polls this every 60s, as today.
Success `200`:
```json
{ "valid": true,
  "user": { "id","username","is_admin","max_employees","employees_can_view_quotes","parent_user_id" },
  "tab_permissions": [ { "tab_key","is_enabled" } ] }
```
Expired/invalid → `401 { "error":"جلسة منتهية","session_expired": true }`.

> **There is no `POST /auth/heartbeat`.** An earlier draft offered it as a lightweight
> split; it was removed because `EnsureSessionActive` refreshes `last_active_at` on *every*
> authenticated request. A client polling a separate heartbeat endpoint keeps that timestamp
> permanently fresh, so the 5-minute throttle in `/auth/me` can never fire and
> `session_events(heartbeat)` rows stop being written entirely — which silently breaks the
> admin analytics that derive per-session `duration_ms` and `is_active` from those rows
> (`handleGetUserAnalytics`). One polling endpoint, and it writes the audit event.
> See `tickets/PHASE-0-1-AUDIT.md` F5.

> **`/auth/me` deliberately does NOT check `expires_at`.** `handleVerifySession` checks only
> `is_active`, so an expired subscription keeps working until the user logs out; only
> `POST /auth/login` rejects an expired account. This is intentional parity, not an
> oversight — see the note under `/auth/force-login` and `PHASE-0-1-AUDIT.md` F10.

### POST /auth/logout
Auth: JWT. Delete the caller's `user_sessions` row (by `jti`), log `session_events(logout)`.
`200 { "success": true }`. (Idempotent if already gone.)

### POST /auth/change-password
Request: `{ "username", "old_password", "new_password" }` (unauthenticated, as today).
Rules (port `handleChangePassword`): `new_password` ≥ 6 chars, must differ, verify old,
account active + not expired. On success: rehash (bcrypt), **delete all sessions** for the
user (force re-login). Errors return 200-error with the exact Arabic strings, e.g.
`"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"`, `"كلمة المرور الحالية غير صحيحة"`.

---

## 4. Employees (owner)

All require `role=account_owner` and target ownership `parent_user_id = caller.id`.

- **POST /employees** `{ username, password, max_devices? }` → enforce `max_employees` cap
  (`400 { "error":"وصلت للحد الأقصى من الموظفين (N)" }`), create with `parent_user_id=caller`,
  `is_admin=false`, `max_employees=0`, then **copy caller's tab-permission rows** to the new
  employee. Return `{ "employee": {…} }`. Duplicate username → `400 "اسم المستخدم موجود مسبقاً"`.
- **GET /employees** → `{ "employees": [ AppUser… ] }` (ordered by `created_at`).
- **PATCH /employees/{id}** `{ username?, is_active?, max_devices?, password? }` → ownership
  check then update; `403 "غير مصرح"` if not own employee.
- **DELETE /employees/{id}?transfer_to=<id>** → if `transfer_to` given, validate it's the
  caller or another own employee, move that employee's quotes, then delete.
- **GET /employees/{id}/quotes-count** → `{ "count": N }`.
- **GET /employees/{id}/tab-permissions** → `{ "permissions":[{tab_key,is_enabled}] }`.
- **PUT /employees/{id}/tab-permissions** `{ permissions:[{tab_key,is_enabled}] }` → upsert
  each on `(user_id, tab_key)`; `{ "success": true }`.
- **POST /account/employees-view-quotes** `{ enabled: bool }` → owner-only
  (`403 "غير مصرح - فقط المستخدم الرئيسي"` if employee); updates
  `employees_can_view_quotes`; returns `{ success:true, employees_can_view_quotes }`.

---

## 5. Settings (self only)

- **PUT /settings** `{ settings:[{ key, value }] }` → upsert each on `(user_id, setting_key)`
  for the **caller only** (ignore any body `user_id` that isn't the caller → `403 "غير مصرح"`).
  `{ "success": true }`.
- **GET /settings** → `{ "settings": { key: value, … } }` for the caller.

---

## 6. Quotes (family-scoped)

- **POST /quotes** `{ title, customer_name, quote_number, source_type, quote_data }` →
  create under caller; `{ "quote": SavedQuote }`.
- **PATCH /quotes/{id}** `{ title?, customer_name?, quote_number?, quote_data? }` →
  allowed iff quote `user_id ∈ family_ids(caller)`; else `403 "غير مصرح"`; `404 "العرض غير موجود"`.
- **DELETE /quotes/{id}** → same family rule.
- **GET /quotes** → returns the caller's own quotes + related quotes with the **visibility
  matrix** (owner sees all employees' quotes tagged with `employee_username`; employee sees
  sibling quotes always + owner's quotes only if `employees_can_view_quotes`, tagged
  `is_parent_quote`). Shape:
  ```json
  { "quotes": [ SavedQuote… ], "related_quotes": [ { ...SavedQuote, "employee_username":"...", "is_parent_quote":true? } ] }
  ```
- **POST /quotes/transfer** `{ from_user_id, to_user_id }` → owner-scoped ownership checks on
  both ids (self or own employee), move rows, `{ success:true, transferred:N }`.

`SavedQuote` = `{ id, user_id, title, customer_name, quote_number, source_type, quote_data,
created_at, updated_at }`.

---

## 7. Activity

- **POST /activity/batch** `{ session_token, events:[{ tab_key?, action, details?, occurred_at? }] }` →
  accept up to 200; filter to the **allowed action set** (`02 §2.5`); insert rows tagged with
  the caller's id/username + `jti`. Must accept a raw JSON body from `navigator.sendBeacon`
  (Blob, `application/json`). Return `{ success:true, logged:N }`. Never block; invalid → 200.
  Session invalid → `200 { session_expired:true }` (tracker silently re-queues).

> ### ⚠ Auth exception: this route is NOT behind `EnsureSessionActive`
>
> It is the **only** authenticated-in-spirit route that skips the middleware, and that is
> deliberate. `src/lib/activityTracker.ts` flushes the queue from
> `navigator.sendBeacon()` on `visibilitychange` / `pagehide` / `beforeunload`. A beacon
> is fire-and-forget: the page is already unloading, nothing reads the response, and a
> `401` simply loses the batch. The reference is `200`-always for this action
> (`index.ts:340-374`) and the client depends on that.
>
> Consequences, all intentional:
> - **The token travels in the JSON body.** `sendBeacon` cannot set an `Authorization`
>   header — that is a browser API limitation, not a design choice. A bearer header is
>   also accepted, for the `fetch` path and future mobile clients.
> - **Every outcome is HTTP 200.** Missing token → `{ error:"جلسة غير صالحة",
>   session_expired:true }`; unresolvable/revoked session or deactivated user →
>   `{ error:"جلسة منتهية", session_expired:true }`; write failure →
>   `{ success:false, error:"تعذر تسجيل النشاط" }`. Any uncaught throwable is caught and
>   reported as that last shape, never a 5xx.
> - **Branch order is load-bearing.** The missing-token check precedes the payload check,
>   but an *empty* batch short-circuits to `{ success:true, logged:0 }` **without**
>   validating the session — so a stale tab with nothing queued never generates noise.
> - **`last_active_at` is NOT refreshed.** A background beacon must not make an idle
>   session look alive; admin analytics and the 72h idle prune both read that column. The
>   reference likewise reads `user_sessions` directly here instead of going through
>   `getUserFromSession`.
>
> Identity still comes from the JWT — the body's `session_token` is verified as a signed
> token and its `jti` matched against `user_sessions` (scoped by `sub`), so a caller
> cannot attribute events to another user by putting `user_id` in the payload.

---

## 8. Files (storage)

Disk `montage` (local/S3), key `"{user_id}/{ts}-{sanitized}"`, private, signed URLs.
- **POST /files/upload-url** `{ file_name }` → `{ path, upload_url, token }` (signed PUT).
- **POST /files/download-url** `{ file_path }` → `{ signed_url }` (1-hour expiry).
- **POST /files/delete** `{ file_path }` → `{ success:true }`.
> Enforce that `file_path` begins with the caller's `user_id/` prefix (defense-in-depth;
> the current function scopes uploads by prefix but doesn't re-check on download/delete — the
> rebuild should).

---

## 9. Voice

- **POST /voice/parse** `{ transcript, calcType, paperTypeNames?[] }` → returns
  `{ fields: {…}, transcript }` (port `parse-voice-input`: same Arabic system prompt, per
  `calcType` field schema for `employee|box|magazine|manual`, JSON-object response). Provider
  key from server env; never expose it to the client.

---

## 10. Admin

All require `role:admin` (admin JWT). Bodies no longer carry `admin_username`/`admin_password`.

- **GET /admin/users** → `{ users:[ AppUser(+employees_can_view_quotes) ] }` (ordered by created).
- **POST /admin/users** `{ username, password, is_admin?, expires_at?, max_devices?, max_employees? }`
  → create + seed default tab permissions (primary ON / secondary OFF as in `handleCreate`).
  Duplicate → `400 "اسم المستخدم موجود مسبقاً"`.
- **PATCH /admin/users/{id}** `{ username?, is_active?, is_admin?, expires_at?, max_devices?, max_employees?, password? }`.
- **DELETE /admin/users/{id}** → cascade deletes sessions/quotes/settings/permissions/employees.
- **GET /admin/users/{id}/tab-permissions** / **PUT** `{ permissions:[…] }` (upsert).
- **GET /admin/users/{id}/sessions** → `{ sessions:[ user_sessions… ] }`.
- **DELETE /admin/sessions/{sessionId}** → terminate one session.
- **GET /admin/login-logs** → `{ logs:[…] }` (latest 100).
- **GET /admin/analytics?user_id=** → `{ analytics:[ UserAnalytics… ] }` (port
  `handleGetUserAnalytics`: per-user online status, totals, per-session summaries with
  durations/alerts, per-tab stats, performance tier). See `04-ADMIN-CONTROL-PANEL-SPEC.md`
  for the full `UserAnalytics` shape and computation rules.

`AppUser` (list/CRUD) = `{ id, username, is_active, is_admin, expires_at, created_at,
max_devices, max_employees, parent_user_id }`.

---

## 11. New (mobile/hardening) — additive, not in the old function

These are **additions** the API should expose; none change existing shapes:
- **Throttling / lockout** on `login`, `force-login`, `change-password` (Laravel rate limiter).
- **`GET /health`** (public) for uptime checks.
- **`GET /meta/tabs`** (JWT) — optional: return the tab catalog so a mobile app can render
  labels without shipping `tabRegistry.ts`. (Backend still treats `tab_key` as opaque.)
- **Refresh** — with a 30-day JWT + session allow-list, a refresh endpoint is optional; if
  added, `POST /auth/refresh` rotates the JWT while keeping the same `user_sessions` row/`jti`.
- **Versioning** — everything under `/api/v1`; breaking changes go to `/api/v2`.

---

## 12. Parity checklist (per ported endpoint)

For each endpoint, before marking the ticket done:
- [ ] Same **success shape** as the `manage-users` action (field names identical).
- [ ] Same **error shape + Arabic string** for each failure branch.
- [ ] Same **HTTP semantics** (business error = 200; auth = 401 `session_expired`).
- [ ] Same **authorization** (family/ownership/admin) — verified with a denial test.
- [ ] Side effects match (writes to `login_logs` / `session_events` / cascade deletes / upserts).
- [ ] A request captured from the current app returns an equivalent body from Laravel.
