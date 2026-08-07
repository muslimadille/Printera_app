# Phase 0 & 1 — Scaffold Audit (`backend/` vs `PHASE-0-1-DETAILED.md`)

> Static audit of the `backend/` scaffold against every acceptance criterion in
> `PHASE-0-1-DETAILED.md`, cross-checked against `supabase/functions/manage-users/index.ts`
> (behavioral source of truth), `02-DATABASE-SCHEMA.md`, and `03-API-SPECIFICATION.md`.
>
> **Method:** every file under `backend/` was read, then the scaffold was installed,
> tested, and linted for real.
>
> **Environment:** PHP 8.5.1, Composer 2.9.2, Laravel 12.61.1, PHPUnit 12.5.33.

---

## Status — every finding, closed

**All findings are fixed or explicitly deferred with a reason.** Delivered across three
tickets: **BE-017** (foundation fixes), **BE-018** (test backfill), **BE-019** (Postgres
verification).

| # | Ticket | Status | Change |
|---|---|---|---|
| F0 | pre-BE-017 | **Fixed** | `composer.json` → `laravel/framework: ^12.61.1`, `jwt-auth: ^2.8`, `phpunit: ^11.5\|^12.0` |
| F1 | pre-BE-017 | **Fixed** | `bootstrap/app.php` — `ValidationException` → 200 Arabic shape; catch-all narrowed to exclude `HttpExceptionInterface`; `AuthenticationException` → 401 `session_expired` |
| F2 | BE-017 | **Fixed** | New `config/printera.php` holds every project env read; `SessionService::idleHours()` and `AdminSeeder` now use `config()`. Proven under `config:cache`: `config()` → `99`, `env()` → `NULL` |
| F3 | BE-017 | **Fixed** | Kept the `database` drivers and added the 5 standard framework migrations (`cache`, `jobs`, `job_batches`, `failed_jobs`, `sessions`) |
| F4 | pre-BE-017 | **Fixed** | `$exceptions->dontReport(ApiException::class)` |
| F5 | BE-017 | **Fixed (locked)** | `POST /auth/heartbeat` route + `AuthController::heartbeat()` removed. `/auth/me` is the sole poll and the only writer of `session_events(heartbeat)` |
| F6 | BE-017 | **Fixed** | `EnsureSessionActive` scopes the session lookup by `user_id = sub` as well as `jti` |
| F7 | BE-017 | **Fixed** | `AuthService::buildSessionUser()` now delegates to `UserResource` — one definition of the contract shape (AGENTS.md §3) |
| F8 | BE-017 | **Documented + deferred** | IP order `x-forwarded-for` → `cf-connecting-ip` → `$request->ip()` recorded in BE-011; the socket fallback is kept deliberately. `->trustProxies()` **deferred to Phase 5 / BE-050**, where it can be tested against the real topology and is actually needed for `https://` signed URLs |
| F10 | BE-017 | **Fixed (locked)** | `expires_at` check removed from `EnsureSessionActive`; force-login still has none. Only `login` rejects expiry — full Supabase parity |
| F11 | BE-017 | **Fixed** | `$token->authenticate()` moved inside the `try`, so `UserNotDefinedException` yields 401 rather than 500 |
| F12 | BE-017 | **Fixed** | Dead `Str::uuid()` dropped from `SessionService::create()`; `app:prune-events` schedule commented out until Phase 2 adds the command; `APP_KEY` added to `phpunit.xml`. Index ASC/DESC — no action, equivalent in Postgres |
| F14 | BE-017 | **Fixed** | `config/jwt.php` published |
| F15 | pre-BE-017 | **Fixed** | `tests/Unit/.gitkeep` |
| F16 | pre-BE-017 | **Fixed** | `pint` across 14 files |
| F17 | pre-BE-017 | **Fixed** | `use Throwable;` removed |
| Test backfill | BE-018 | **Fixed** | See §4 |
| **F18** | BE-019 | **Fixed** | `create_app_users_table` failed on Postgres: the fluent `->primary()` is appended *after* the self-referencing FK, so the FK referenced a column with no unique constraint yet. Now declared explicitly. **Found only because BE-019 ran on a real Postgres** |
| Postgres | BE-019 | **Verified** | Postgres 16.11 — see §6 |

**Design decision recorded (F1):** validation failures return
`{"error": "البيانات غير مكتملة", "errors": {…}}` at HTTP 200. The Arabic constant is used
rather than Laravel's per-field messages because the SPA renders `error` directly into an
Arabic RTL UI; the English field detail is preserved under `errors`, which the client
ignores. Now written into `03-API-SPECIFICATION.md §1`.

**Two product decisions locked into the specs (F5, F10):** both are recorded in
`03-API-SPECIFICATION.md` §Auth and in BE-010 / BE-012 / BE-013, with the reasoning, so a
future reader does not "fix" them back.

---

## 0. Verification run — what actually happened

Run against a throwaway copy of `backend/` (repo untouched):

| Step | Result |
|---|---|
| `composer install` as pinned (`laravel/framework: ^11.9`) | **FAILS — cannot resolve.** See F0. |
| `composer install` with `^12.61.1` + `jwt-auth ^2.8` | Clean. 80 packages, boots on PHP 8.5.1. |
| `php artisan test` (first attempt) | **Aborted** — PHPUnit 12 fatals on the missing `tests/Unit` dir (F15). |
| `php artisan test` (after `mkdir tests/Unit`, removing `use Throwable;`) | **7 passed, 39 assertions.** |
| `./vendor/bin/pint --test` | **FAILS — 14 files.** BE-000 acceptance not met (F16). |
| F1 probe (violate a FormRequest rule) | **CONFIRMED:** `500 {"error":"حدث خطأ في الخادم"}` |
| Migrations on SQLite | Clean (all 7 tests use `RefreshDatabase`). |
| Migrations on **Postgres** | **Still unverified** — no Postgres instance was available. BE-002's primary target. |

The good news: **the auth logic is sound.** Every one of the 7 existing tests passes on
the first real run — login, device-limit → force-login, `/auth/me` → logout revocation,
change-password invalidation, and SHA-256 → bcrypt migration all behave as the tickets
specify. The problems below are in packaging and the error layer, not in the port.

---

## 0b. F0 — Laravel 11 cannot be installed at all · **Blocker**
`backend/composer.json:10`

`composer install` refuses outright:

```
Root composer.json requires laravel/framework ^11.9, found laravel/framework[v11.9.0, ...,
v11.55.0] but these were not loaded, because they are affected by security advisories.
```

| Advisory | Severity | Affected range | Fixed in |
|---|---|---|---|
| `PKSA-mdq4-51ck-6kdq` (CVE-2026-48019) — CRLF injection in default email rule | — | `>=11.0.0,<12.0.0` — **all of 11.x** | 12.60.0 |
| `PKSA-3r5d-mb8f-1qw9` — CRLF injection in default email rule | **high** | `<12.60.0` | 12.60.0 |
| `PKSA-m5cs-t1y6-qpcs` — Temporary Signed URL path confusion | medium | `<12.61.1` | 12.61.1 |

**There is no patched 11.x release.** Every affected range runs to `<12.x` with nothing
above it, i.e. Laravel 11 is past security support and these are fixed only on 12.
Ignoring the advisories (`audit.ignore`, or `block-insecure: false`) would ship a
knowingly-vulnerable framework.

Relevance to *this* product: the CRLF email-rule issue is inert here — identity is
username-only with no email by locked decision (`CLAUDE.md §2`), so the `email` validation
rule is never used. The **signed-URL path confusion is directly on the critical path**:
BE-050 replaces the `montage-files` bucket with temporary signed URLs.

**Verified fix (tested):** `laravel/framework: ^12.61.1`, `php-open-source-saver/jwt-auth: ^2.8`,
`phpunit/phpunit: ^11.5|^12.0`. Installs clean, boots on PHP 8.5.1, all 7 tests pass.
Laravel 12 keeps the Laravel 11 skeleton — `bootstrap/app.php`, `withMiddleware`,
`withExceptions` are unchanged — so no scaffold code needed rewriting for the bump.

**This supersedes the "Laravel 11" wording in BE-000 and in `00-OVERVIEW-AND-MIGRATION-PLAN.md`,
`ARCHITECTURE.md`, and `backend/README.md`.** It is a framework major-version change and
therefore a product-owner decision, not an executor's — flagged, not applied.

---

## 1. Verdict per ticket

| Ticket | Status | Blocking gap |
|---|---|---|
| BE-000 Scaffold + `/api/v1` + health | **Partial** | **F0:** won't install as pinned. `pint --test` fails on 14 files (F16). `.env.example` defaults break on first cache/queue/session write (F3). |
| BE-001 JWT wiring | **Works** | Proven indirectly — JWTs mint and validate in the passing tests. `config/jwt.php` unpublished, `JWT_SECRET` empty (F14). No test decodes `sub`/`role`/`jti`. |
| BE-002 Migrations + models | **Verified on Postgres 16.11** | Matches `02-DATABASE-SCHEMA.md` column-for-column. BE-019 found and fixed **F18**, a migration that failed outright on Postgres while passing on SQLite. |
| BE-003 Error convention + messages + seeder | **Partial** | **F1 (blocker, confirmed by probe):** validation failures render `500`, violating `03 §1`. Also F2, F4. |
| BE-010 `EnsureSessionActive` | **Done** | F6 (hardening), F11 (unreachable edge). |
| BE-011 `POST /auth/login` | **Done** | Faithful port. 4 of 6 acceptance boxes untested (§4). F8 (IP fallback deviation). |
| BE-012 `POST /auth/force-login` | **Done** | Faithful port. 2 of 3 acceptance boxes untested. Inherits an upstream security gap — see F10. |
| BE-013 `GET /auth/me` + heartbeat | **Partial** | **F5:** adding `/auth/heartbeat` silently kills heartbeat auditing, which admin analytics depends on. |
| BE-014 `POST /auth/logout` | **Done** | Idempotency untested. |
| BE-015 `POST /auth/change-password` | **Done** | Only the success branch is tested; 6 Arabic failure branches untested. |
| BE-016 Idle prune (72h) | **Done** | **Zero tests.** Both acceptance boxes unproven. F2 makes the window non-configurable in production. |
| Phase 0/1 exit criteria | **Not met** | 4 of 6 integration criteria untested; `pint --test` fails. |

**Summary:** the *port* is accurate and it works — the Arabic strings, the
login/force-login algorithms, the device-reuse and prune semantics, and the schema all
match their sources, and all 7 existing tests pass on a real run. What is missing is
(a) an installable framework version, (b) one confirmed defect in the error-rendering
layer, (c) production-config hygiene, and (d) roughly two-thirds of the acceptance tests.

---

## 2. Findings

### F1 — Validation failures return `500`, not the required 200-error shape · **Blocker · CONFIRMED**
`backend/bootstrap/app.php:33-42`

Reproduced against the running app — `POST /api/v1/auth/force-login` with
`terminate_session_ids: "not-an-array"` (violating the `array` rule) returns:

```
status=500  body={"error":"حدث خطأ في الخادم"}
```


The catch-all render callback computes
`$status = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500`.
`Illuminate\Validation\ValidationException` carries a public `$status = 422` property
but defines **no `getStatusCode()` method**, so it falls to `500` and returns
`{"error":"حدث خطأ في الخادم"}` — swallowing the 422 before Laravel's handler can
convert it. `AuthenticationException` has the same shape and the same fate.

This directly contradicts `03-API-SPECIFICATION.md §1`:

> **Validation failure:** return the same 200-error shape (not Laravel's default 422)
> for endpoints the current client calls, to avoid changing `userApi.ts` error handling.

Phase 0/1 doesn't trip it today only because every rule in the three `Auth/*Request`
classes is `nullable` — except `terminate_session_ids` (`array`) and
`terminate_session_ids.*` (`string`), which a malformed client already can trip. Every
Phase 2+ FormRequest will. It also masks genuine exceptions during test runs as a
generic Arabic 500.

**Fix:** register an explicit `ValidationException` callback returning
`ApiResponse::business(<first message>)` at 200, and narrow the catch-all so it does not
intercept `HttpExceptionInterface` / `ValidationException`. **The ticket doc is also silent
on how validation maps to the 200 shape** — BE-003 should state the rule and which message
is surfaced.

Note the second-order cost: this callback also swallows genuine exceptions during test
runs into a generic Arabic 500, so a Phase 2+ bug will surface as an opaque status code
rather than a stack trace.

### F2 — `env()` called at runtime; values silently vanish under `config:cache` · **High**
`backend/app/Services/SessionService.php:27`, `backend/database/seeders/AdminSeeder.php:20-21`

`env()` outside a `config/` file returns its default once `php artisan config:cache` has
run, because the cached-config path never loads `.env`.

- `idleHours()` → `env('IDLE_SESSION_HOURS', 72)` silently reverts to 72, so BE-016's
  configurable window is inert in production.
- `AdminSeeder` reads `ADMIN_USERNAME` / `ADMIN_PASSWORD` via `env()` and **throws
  `RuntimeException` even when both are correctly set** in a config-cached deployment —
  the exact "fails loudly without env" behavior, but for the wrong reason.

`config/cors.php:5-9` also uses `env()`, but that is inside a config file and is correct.

**Fix:** add `config/printera.php` (`idle_session_hours`, `admin.username`, `admin.password`)
and read through `config()`.

### F3 — `.env.example` selects `database` cache/queue/session with no such tables · **High**
`backend/.env.example` (`CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `SESSION_DRIVER=database`)

`backend/database/migrations/` contains only the 8 domain tables. Laravel's framework
migrations for `cache`, `jobs`, and `sessions` were never copied in, so the first cache,
queue, or session write fails with a missing-relation error. This includes the
`RateLimiter::for('auth', ...)` limiter defined at
`backend/app/Providers/AppServiceProvider.php:20-29` the moment any route adopts
`throttle:auth` (which `03 §11` calls for).

BE-000's "`php artisan serve` boots" acceptance still passes — the failure only appears
under load, which is worse.

**Fix:** either set `file` / `sync` / `array` in `.env.example`, or add the three
framework migrations. Pick one and state it in BE-000.

### F4 — Business errors are logged as exceptions · **Medium**
`backend/bootstrap/app.php:25-29`

`ApiException` is rendered but never passed to `$exceptions->dontReport()`. Every wrong
password, every device-limit hit, every expired account writes a full stack trace to
`storage/logs`. At the volume these fire, real errors get buried.

**Fix:** `$exceptions->dontReport(ApiException::class);`

### F5 — `/auth/heartbeat` silently disables heartbeat auditing · **Medium (parity regression)**
`backend/app/Http/Controllers/Api/V1/AuthController.php:64-76` and `:86-90`

BE-013 adds `POST /auth/heartbeat` alongside `GET /auth/me` and says "either is
acceptable, but keep both". They interact badly:

1. `EnsureSessionActive` refreshes `last_active_at` on **every** authenticated request,
   including `/auth/heartbeat`.
2. `/auth/heartbeat` itself writes no `session_events` row.
3. `me()`'s throttle fires only when `now - prev_last_active_at > 300s`.

So a client polling `/auth/heartbeat` every 60 s keeps `last_active_at` permanently
fresh, meaning the `me()` throttle **can never fire** and heartbeat events stop entirely.

That matters because `handleGetUserAnalytics`
(`supabase/functions/manage-users/index.ts:1113-1124`) derives per-session `duration_ms`
from `min/max occurred_at` across `session_events` + `activity_events`, and gates
`is_active` on `last_event_type ∈ {login, heartbeat}` within a 2-minute window. Without
heartbeat rows, every session in the admin panel collapses to a near-zero duration and
reads as offline. This surfaces in Phase 4 (BE-040+), long after Phase 1 is signed off.

**Fix:** decide one polling endpoint. Either give `/auth/heartbeat` the same throttled
`session_events` write, or drop it and keep `/auth/me` as the sole poll (matching
`verify_session` today). BE-013 must state the choice rather than leaving it open.

### F6 — Session row is not bound to the JWT's `sub` · **Low (defense in depth)**
`backend/app/Http/Middleware/EnsureSessionActive.php:37-46`

The user is loaded from the token's `sub`; the session is looked up by `jti` alone. No
current code path can mint a JWT whose `jti` belongs to another user's session, so this
is not exploitable today — but the two lookups being independent means any future bug in
token issuance becomes a cross-tenant session confusion rather than a failed request.

**Fix:** `->where('user_id', $payload->get('sub'))` on the `UserSession` query.

### F7 — `UserResource` is dead code · **Low**
`backend/app/Http/Resources/UserResource.php` vs `backend/app/Services/AuthService.php:60-70`

The tickets specify `user: UserResource` for login, force-login, and `/auth/me`. All
three actually use `AuthService::buildSessionUser()`. Both produce identical output
today, but a contract shape with two definitions will drift. Delete one.

### F8 — `clientIp()` falls back to the socket IP where the reference returns `null` · **Low**
`backend/app/Http/Controllers/Api/V1/AuthController.php:29-37`

`manage-users` (`index.ts:146`) yields `null` when neither `x-forwarded-for` nor
`cf-connecting-ip` is present. The scaffold falls back to `$request->ip()`, so
`login_logs.ip_address` and `session_events.ip_address` will hold a value where the old
backend stored `NULL`. Arguably better; it is still an observable change and BE-011's
acceptance says "ip from `x-forwarded-for`/`cf-connecting-ip`". Relatedly,
`bootstrap/app.php` never calls `->trustProxies()`, so `$request->ip()` is the proxy's
address behind a load balancer, and `URL::temporarySignedRoute()` (BE-050) will generate
`http://` URLs behind TLS termination.

**Fix:** state the intended semantics in BE-011, and add `->trustProxies()` before Phase 5.

### F10 — `force-login` bypasses the subscription-expiry check (inherited) · **Note**
`backend/app/Services/AuthService.php:174-236`, mirroring `index.ts:880-1005`

`login` rejects an account whose `expires_at` has passed; `force-login` never checks.
The scaffold reproduces this faithfully — correct per BE-012's "match reference".

Worth surfacing to the product owner: in the rebuild the hole partially closes by
accident, because `EnsureSessionActive` **does** check `expires_at`
(`EnsureSessionActive.php:50-52`) while `handleVerifySession` never did. Net effect: on
Supabase an expired user who force-logs-in stays working until logout; on Laravel they
get a session and are then 401'd on their next request. Different observable behavior in
both directions — decide deliberately and record it in BE-012.

### F11 — `UserNotDefinedException` escapes the `try` · **Low**
`backend/app/Http/Middleware/EnsureSessionActive.php:43`

`$token->authenticate()` sits outside the `catch (JWTException)` block and can throw
`UserNotDefinedException` (a `JWTException` subclass) → uncaught → generic Arabic 500
instead of `401 session_expired`. Practically unreachable, since
`user_sessions.user_id` cascades on user delete, so a missing user implies a missing
session row that would already have thrown. Cheap to fix anyway.

### F12 — Cosmetic / no action needed
- `SessionService.php:77` passes `'id' => (string) Str::uuid()` to `UserSession::create()`,
  but `id` is not in `$fillable` — mass assignment drops it and `HasUuids` fills it
  instead. Harmless, misleading; delete the line.
- Indexes are declared ASC where `02 §2.3/2.5/2.6` writes `DESC`. Postgres scans a
  b-tree backwards at equal cost; no change needed.
- `routes/console.php:8` schedules `app:prune-events`, which does not exist until
  Phase 2. `php artisan schedule:list` / `schedule:run` will error until then; ordinary
  artisan commands are unaffected.
- `phpunit.xml` sets no `APP_KEY`. Nothing in Phase 0/1 resolves the encrypter, so tests
  boot fine; add it before anything uses `encrypt()` or signed URLs.

### F14 — BE-001 steps 1–2 not performed · **Low**
`config/jwt.php` was never published and `JWT_SECRET` is empty in `.env.example`. Neither
blocks anything — the package merges its own defaults, so `JWT_TTL=43200` is honored, and
the test run proves JWTs mint and validate correctly from the `phpunit.xml` secret. But
`php artisan jwt:secret` is a required install step and is missing from
`backend/README.md`'s critical path.

### F15 — Missing `tests/Unit` aborts the entire test suite · **High · CONFIRMED**
`backend/phpunit.xml:8-10`, `backend/tests/`

`phpunit.xml` declares a `Unit` testsuite pointing at `tests/Unit`, which does not exist.
Under PHPUnit 12 (what Laravel 12 pulls) this is **fatal, not a warning**:

```
Test directory ".../tests/Unit" not found
```

The run aborts before executing a single test — so `php artisan test` reports nothing at
all rather than "7 passed". Anyone running the suite for the first time sees a dead
toolchain and no signal about whether the code works.

**Fix:** add `tests/Unit/.gitkeep`, or drop the suite from `phpunit.xml`.

### F16 — `./vendor/bin/pint --test` fails on 14 files · **Medium · CONFIRMED**
BE-000 acceptance: "`./vendor/bin/pint --test` passes". It does not.

Failing fixers, by file: `AuthController` (`single_line_empty_body`), `UserResource`
(`fully_qualified_strict_types`, `ordered_imports`), `AppUser` (+`unary_operator_spaces`,
`not_operator_with_successor_space`), `SavedQuote`/`SessionEvent` (`phpdoc_align`),
`UserSession`, `AppServiceProvider`, `AuthService`, `Messages`
(`class_attributes_separation`), `bootstrap/app.php`, `bootstrap/providers.php`,
`config/auth.php`, the `session_events` migration (`class_definition`, `single_quote`,
`braces_position`), and `AuthTest` (`no_unused_imports` — `UserSession` is imported and
never used).

All are auto-fixable with `./vendor/bin/pint`. Worth doing before more code lands, so the
first real diff isn't buried in formatting noise.

### F17 — `use Throwable;` emits a warning on every boot under PHP 8.5 · **Medium · CONFIRMED**
`backend/bootstrap/app.php:9`

```
Warning: The use statement with non-compound name 'Throwable' has no effect
in .../bootstrap/app.php on line 9
```

PHP 8.5 warns on importing a global-namespace name into a namespace-less file. It fires
on **every** web request and every artisan command, and it turned all 7 passing tests
into PHPUnit *warnings* (`7 warnings` instead of `7 passed`) — which is exactly the kind
of noise that trains people to ignore test output.

**Fix:** delete the line. `bootstrap/app.php` has no namespace, so `Throwable` already
resolves. Verified: removing it yields a clean `7 passed`.

---

## 3. Verified-correct (no action)

These were checked line-by-line against `manage-users` and match:

- **Arabic strings** in `App\Support\Messages` are byte-identical to the edge function.
- **Login algorithm** (`AuthService.php:110-166`): lookup → verify → expiry → hash
  migrate → prune → device reuse → device cap → create, with `login_logs` +
  `session_events(login)` on both paths. Order matches `index.ts:128-237` exactly.
- **`max_devices ?: 1`** reproduces the reference's `user.max_devices || 1` for both
  `0` and `NULL`.
- **Force-login** (`AuthService.php:174-236`) matches `index.ts:880-1005`, including
  own-device reuse before termination, the `slice(0,1)` safety cap, `auto_logout`
  logging, and the 403 re-check. The scaffold additionally scopes the termination lookup
  by `user_id` — a strict improvement over the reference, which looks up by id and only
  scopes the delete.
- **Change-password** branch order and messages match `index.ts:99-125`.
- **Idle prune** (72 h) is invoked at the same point in both flows.
- **Schema** matches `02-DATABASE-SCHEMA.md` exactly, including `max_devices` default `2`
  (confirmed against `supabase/migrations/20260405204504_*.sql:42`), the partial unique
  index `(user_id, device_id) WHERE device_id IS NOT NULL` (confirmed against
  `20260425065039_*.sql:3`), the `event_type` CHECK, and the deliberate absence of FKs on
  `session_events` / `activity_events`.
- **The 401 deviation is safe.** BE-010 specifies `401` where `handleVerifySession`
  returned `200 + session_expired`. `src/lib/userApi.ts:15` branches on
  `status === 401 || data?.session_expired`, treating both identically, so the SPA needs
  no change. Worth recording in the ticket as a checked assumption rather than a risk.

---

## 4. Test coverage vs acceptance criteria — **closed in BE-018**

Grew from **7 tests / 39 assertions** to **58 tests / 196 assertions**, across six files:

| File | Covers |
|---|---|
| `tests/Feature/AuthTest.php` | health, login happy path, bad credentials, device-limit → force-login, me → logout revocation, change-password invalidation, SHA-256 → bcrypt |
| `tests/Feature/LoginTest.php` | BE-001 JWT claims (`sub`/`role`/`jti`) incl. all three role tiers · device reuse (rotates token, no extra row, old JWT revoked) · device-limit payload shape · `max_devices` 0 → 1 · deactivated login · IP from `x-forwarded-for` / `cf-connecting-ip` · BE-012 own-device reuse, oldest-session termination, still-over-cap 403 |
| `tests/Feature/SessionLifecycleTest.php` | BE-016 idle prune (4 tests incl. the config-driven window and the cap-frees-up case) · BE-010 `last_active_at` refresh, deactivated → 401, cross-user `jti` → 401, garbage token → 401 · BE-013 `/auth/me` shape + 5-minute heartbeat throttle + no separate heartbeat route · BE-014 logout event/revocation/double-call · F10 expiry parity (3 tests) |
| `tests/Feature/ChangePasswordTest.php` | BE-015 — all six Arabic failure branches asserted with `assertExactJson` against `App\Support\Messages`, plus branch *ordering* and the success path |
| `tests/Feature/AdminSeederTest.php` | BE-003 — one admin from config, bcrypt hash, idempotent re-run, aborts loudly on missing username/password, no row on abort |
| `tests/Unit/NoLegacyCredentialsTest.php` | BE-003 — no legacy demo password (`1234`, `M123123`) appears as a string literal anywhere in `database/`; no seeder hardcodes a hash or calls `env()`. Tokenized so comments *warning* about those passwords don't false-positive, plus a guard-the-guard test |

The device-limit assertion gap is closed: `max_devices`, the `active_sessions` element
shape, the count, and the exact Arabic string are all asserted now.

### Spec mismatch found while testing — BE-014 "idempotent"

BE-014 and `03 §3` say logout is "idempotent if already gone". In the reference,
`handleLogout` is **unauthenticated** and takes the token in the body, so deleting an
already-deleted token returns `{success:true}`. In the rebuild, logout sits behind
`session.active`, so the second call never reaches the handler — it returns
`401 session_expired` because the allow-list row is gone.

Flagged rather than changed: moving logout outside the middleware would contradict
`03 §2` ("`POST /auth/logout` | JWT") and hand an unauthenticated caller the ability to
delete sessions by token. The end state is identical (no session, no crash) and the SPA
treats 401 and `session_expired` the same way. `test_logging_out_twice_does_not_error`
documents the actual behavior. **Suggested spec edit:** reword BE-014's acceptance to
"calling twice does not error — the second call returns `401 session_expired`".

---

## 7. Phase 2 — deliberate deviations worth remembering

Recorded here because they are the kind of thing a future reader would otherwise "fix".

### `/activity/batch` is exempt from `EnsureSessionActive` (BE-025)
The only authenticated-in-spirit route outside the middleware. `activityTracker.ts` flushes
via `navigator.sendBeacon()` on page hide, where a `401` silently loses the batch and
nothing can read the response. The reference is `200`-always for this action
(`index.ts:340-374`). The token therefore travels in the JSON body — `sendBeacon` cannot set
an `Authorization` header — and is still verified as a signed JWT whose `jti` is matched
against `user_sessions` scoped by `sub`, so events cannot be attributed to another user.
`last_active_at` is deliberately **not** refreshed, so a background beacon cannot make an
idle session look alive to analytics or to the 72h prune. Full rationale in
`03-API-SPECIFICATION.md §7`.

### `transferred` now reports the real count (BE-024)
`handleTransferQuotes` returns `count || 0` from a supabase `.update()` called **without**
`{ count: 'exact' }`, so the reference reports `0` on every successful transfer. `03 §4` and
the backlog both specify `{success:true, transferred:N}`, so the Laravel version returns the
true affected-row count. The SPA only branches on `success`.

### Quote mutation is family-scoped, listing is flag-scoped (BE-022 / BE-023)
`employees_can_view_quotes` gates **listing only**. An employee can `PATCH`/`DELETE` the
owner's quote even when it is hidden from their list, because the reference's
`getFamilyUserIds` gate does not consult the flag. Faithful port; tests document it rather
than quietly diverging.

> **Accepted / won't change — matches Supabase.** Reviewed during Phase 3 planning and
> settled as a product decision: parity with the reference wins. Do not re-raise; do not
> "fix" it by teaching `getFamilyUserIds` about the flag.

### `sometimes|string` on quote PATCH fields (BE-023)
The text columns are `NOT NULL` and the reference passes an explicit `null` straight to the
database. Validating instead turns that into the standard `200` business error rather than a
generic Arabic `500`. The client never sends `null` (`JSON.stringify` drops `undefined`).

### JS falsy-coalescing on quote defaults (BE-021)
`source_type || 'calculator'` means an **empty string** takes the default. PHP's `??` would
keep `''`. `QuoteService::orDefault()` reproduces the JS semantics.

---

## 7b. Phase 3 — deliberate deviations worth remembering

### No role middleware in front of `/employees` (BE-030..035)
Deliberate, and required for parity. The reference blocks non-owners **structurally**: an
employee is created with `max_employees = 0`, so the create cap fires first, and every
`{id}` lookup is scoped to `parent_user_id = caller.id`, which an employee can never satisfy
because it has no children. A `role:account_owner` guard would answer with a *different*
Arabic string than the reference does. `GET /employees` likewise returns `[]` for an
employee rather than `403`. Only BE-036 checks a role directly, because its target is the
caller's own row and there is nothing to scope by.

### Duplicate username maps to the Arabic constant (BE-030 / BE-032)
`index.ts:565` sniffs the driver message for `"unique"` and otherwise returns
`error.message` **raw** at `400`. Laravel classifies the violation
(`UniqueConstraintViolationException`), so the sniff is unnecessary and the Arabic string is
identical — but non-unique driver errors now surface as the generic `500`
`"حدث خطأ في الخادم"` instead of echoing PostgreSQL's text to the client.

### Catching a unique violation needs a savepoint under PostgreSQL (BE-032)
Found while verifying BE-032 on pgsql, not on SQLite. A failed statement aborts the
enclosing transaction (`SQLSTATE[25P02] current transaction is aborted, commands ignored
until end of transaction block`), so a `catch` that intends to return a clean `400` instead
poisons every later query on that connection. `EmployeeService::rejectingDuplicateUsername()`
wraps the write in a transaction purely to give the catch a savepoint to roll back to.
SQLite has no such rule, which is why the default suite could never have caught it. Same
class of driver-divergence as F18.

### Required fields where the reference validated nothing (BE-030 / BE-035 / BE-036)
`username`+`password` on create, `permissions` on the tab-permission PUT, and `enabled` on
the view-quotes toggle are now validated, turning a NOT NULL violation / a `TypeError` on
iterating `undefined` / a silent no-op into the standard `200` `INCOMPLETE_DATA` body. The
SPA always sends all of them. One consequence worth knowing: for a create request that is
**both** over cap and malformed, validation now answers first where the reference answered
with the cap error.

### `transfer_to` may name the employee being deleted (BE-033)
A reference quirk, ported as-is. The id passes the "is an employee of the caller" check
because it *is* one, the quotes are moved to themselves, and the cascade then deletes them —
so asking for a handover to the departing employee silently discards the quotes. The SPA
never offers that combination. Covered by a test so it stays a decision.

### `transfer_to` is read from both the query string and the body (BE-033)
`03 §4` specifies `?transfer_to=`; `src/lib/userApi.ts` sends a single JSON envelope.
Laravel's `input()` resolves against the JSON payload on a JSON request and would miss a
query value entirely, so `DeleteEmployeeRequest` checks the query first, then the body.

### Deterministic ordering where the reference had none (BE-035)
`GET /employees/{id}/tab-permissions` now orders by `tab_key`. The reference issues an
unordered `select`, so no order was ever guaranteed and nothing could have depended on one.

### Transactions around multi-write operations (BE-030 / BE-033)
Create + inherit-permissions, and transfer-quotes + delete, each run in one transaction. The
reference issues them unguarded, where a failure between the two steps leaves an employee
with no permissions, or quotes orphaned on a user that still exists. Nothing observable
changes on the success path.

---

## 7c. Phase 4 — deliberate deviations worth remembering

### `EnsureAdmin` reads only the session-resolved caller (BE-040)
It previously fell back to `auth('api')->user()`, which resolves a caller straight from the
JWT. Unreachable while the route group is ordered `session.active → role.admin`, but it
meant a **revoked-yet-unexpired admin token** would have satisfied the admin gate if that
order ever changed. Now fails closed; a test registers `role.admin` on its own to prove it.

The gate also reads `is_admin` from the row the session layer loaded, **not** from the JWT
`role` claim — so demoting an admin takes effect on their next request rather than at the
token's 30-day expiry.

### Unknown `{id}` on admin routes answers Arabic, not PostgREST (BE-041/042/043/044)
The reference has no existence check anywhere in the admin handlers:
- `handleUpdate` lets `.single()` fail and returns PostgREST's **English** *"JSON object
  requested, multiple (or no) rows returned"* at 400;
- `handleGetTabPermissions` returns `{permissions: []}` for a user that does not exist;
- `handleUpdateTabPermissions` returns `{success:true}` having written nothing (the loop
  ignores errors, so the FK violation is swallowed).

All now answer `400 "المستخدم المستهدف غير موجود"` (an existing verbatim constant).
**`DELETE /admin/users/{id}` and `DELETE /admin/sessions/{id}` deliberately stay
idempotent**, matching the reference — their postcondition holds whether or not the row
existed, unlike a read or an update, which have nothing to return.

### An admin can delete its own account (BE-042) · **worth a product decision**
The reference has no self-delete guard and neither does this port; adding one would be
inventing product behavior. The cascade takes the caller's own sessions, so the request
succeeds and the very next one is a `401`. If the last admin does this, nobody can reach
the admin panel again. Ported and tested as-is — **flagged, not fixed.**

### Terminating a session now writes `auto_logout` (BE-045) · **addition**
Sanctioned by `04-ADMIN-CONTROL-PANEL-SPEC.md §5` ("optionally log `auto_logout`"); the
reference writes nothing. Without it, an admin-killed session is indistinguishable in
analytics from a user who closed their laptop. Attributed to the **session owner**, not the
admin, and carries the `session_token` so the event closes out the real session summary.

> Related, **not changed** because it is Phase 1 code outside these tickets: force-login's
> own `auto_logout` (`AuthService`) omits the `session_token`, exactly as the reference does
> (index.ts:927-935 selects everything *but* the token). Those events therefore land in a
> synthetic `__nokey_` analytics bucket instead of closing their session.

### `is_active` is always a boolean in analytics (BE-046)
The reference computes `s.token && …`, which evaluates to **`null`** when the session token
is null — a JS truthiness artifact that contradicts its own `is_active: boolean` interface
in `src/lib/userApi.ts`. This port returns a real `false`. Falsy either way to the SPA.

### Analytics quirks reproduced on purpose (BE-046)
- **Asymmetric grouping of legacy tokenless rows.** `session_events` with no token bucket by
  the **minute** they occurred in; `activity_events` with no token all share **one**
  `__nokey_act` bucket (index.ts:1069-1080). Tidying this would silently redraw session
  boundaries in historical data.
- **The 20k caps read oldest-first.** `order by occurred_at asc limit 20000` means that past
  20k events the window shows the **oldest** slice, not the most recent. Kept per `04 §4.5`,
  which already flags an aggregation table as the eventual fix.
- The dead `synth++` counter in the reference's grouping loop (immediately overwritten by
  the minute-bucket key) is simply not ported — it has no observable effect.

### Shared services rather than duplicated handlers (BE-041/043)
`TabPermissionService` and the `RejectsDuplicateUsernames` trait were extracted out of
`EmployeeService` so the owner-scoped and admin-scoped endpoints run the *same* code behind
different gates — the reference duplicates each pair of handlers. Behavior-preserving: the
114 Phase 3 tests passed unchanged against the extracted code.

---

## 6. BE-019 — PostgreSQL verification

**Instance:** PostgreSQL **16.11** (Debian, `postgres:16` container, port 55432 to avoid a
locally installed Postgres on 5432). **Runtime:** PHP 8.5.1 with `pdo_pgsql` loaded
per-command (`php -d extension=pdo_pgsql …`) — the Laragon build ships the DLL but does not
enable it, and no global `php.ini` was modified.

**Repeatable from the repo:** `backend/phpunit.pgsql.xml` + `tests/Feature/PostgresSchemaTest.php`
(15 tests, skipped automatically under any non-pgsql driver).

| Step | Result |
|---|---|
| `php artisan migrate:fresh --seed --force` | **FAILED first** — see F18 below. **Passes after the fix**: all 13 migrations + `AdminSeeder` |
| Full suite on Postgres | **73 tests, 242 assertions, OK** |
| Full suite on SQLite (unchanged default) | **58 passed, 15 skipped** (the pgsql-only ones) |
| `pint --test` | clean |

### F18 — `create_app_users_table` was broken on Postgres · **High · found by BE-019**
`backend/database/migrations/2026_01_01_000001_create_app_users_table.php`

```
SQLSTATE[42830]: Invalid foreign key: 7 ERROR: there is no unique constraint matching
given keys for referenced table "app_users"
```

`Blueprint::addFluentIndexes()` appends a fluent `$table->uuid('id')->primary()` to the
**end** of the command list, while an explicit `$table->foreign(...)` keeps its position.
On Postgres both are emitted as separate `ALTER TABLE` statements, so the self-referencing
FK on `parent_user_id` ran *before* the primary key existed and the table could not be
created at all. SQLite inlines foreign keys into `CREATE TABLE` and never evaluated the
ordering, so the entire test suite passed against a schema that could not deploy.

Only `app_users` is affected — every other FK targets an already-created `app_users`. Fixed
by declaring the key explicitly (`$table->uuid('id'); $table->primary('id');`) before the
FK, with a comment so it is not "tidied" back into the fluent form.

### What the three pgsql-only behaviors actually do

1. **Partial unique index** `user_sessions_user_device_unique` exists with
   `WHERE (device_id IS NOT NULL)`. Verified behaviorally: a second row with the same
   `(user_id, device_id)` is rejected; two rows with `device_id IS NULL` for the same user
   are allowed; the same `device_id` across *different* users is allowed.
2. **`jsonb` defaults** apply. `quote_data`, `details`, and `setting_value` are genuinely
   `jsonb` (asserted against `information_schema`), and inserting via the query builder
   while omitting them yields `{}` — so `->default('{}')` needed no `DB::raw` cast.
   **Newly documented:** `jsonb` does **not** preserve object key order (it sorts by key
   length then bytewise), which SQLite hides by storing JSON text verbatim. Harmless —
   `quote_data` is opaque and read by key — but no consumer may depend on key order, and
   `test_jsonb_reorders_object_keys` pins it so a switch to `json` would be noticed.
3. **`session_events_event_type_check`** exists and enforces: all four documented types
   insert successfully, an unknown value is rejected.

Also verified on Postgres: every documented table plus the 5 framework tables exist; the
`user_settings` / `user_tab_permissions` upsert targets are unique; deleting an owner
cascades to employees and sessions; `username` is unique.

> **Caveat:** run on Postgres **16**. `02-DATABASE-SCHEMA.md` does not pin a major version
> and the local client is 18.1. Nothing used here is version-sensitive, but if production
> targets a different major it is worth re-running `phpunit.pgsql.xml` against it.

---

## 5. Recommended order of work

1. **F0 — decide the framework version.** Nothing else can proceed; the project cannot
   install. Laravel `^12.61.1` is verified working end-to-end. Product-owner call.
2. **F15, F17, F16** — three mechanical fixes (one `.gitkeep`, one deleted line, one
   `pint` run) that turn the toolchain from "aborts" into "7 passed, lint clean".
3. **F1** — fix the exception renderer and add the BE-003 shape tests. Everything after
   Phase 1 depends on validation behaving as specified.
4. **F3, F2** — production config hygiene; both are silent failures, which is the
   expensive kind.
5. **Verify BE-002 against Postgres.** SQLite passes, but Postgres is the deployment
   target and the one place the partial unique index, `jsonb` defaults, and the
   `event_type` CHECK actually take effect.
6. **F5** — decide the heartbeat contract before Phase 4 builds analytics on it.
7. **Backfill the tests in §4**, BE-016 first (zero coverage, and the prune is what makes
   the device cap usable).
8. **F4, F6, F7, F8, F11, F12, F14** — small cleanups, batchable into one ticket.

Items 1, 3, 6 and F10 change what the tickets say, not just the code —
`PHASE-0-1-DETAILED.md` and `03-API-SPECIFICATION.md` need the corresponding edits, and
F0 additionally touches `00-OVERVIEW-AND-MIGRATION-PLAN.md`, `ARCHITECTURE.md`, and
`backend/README.md`.
