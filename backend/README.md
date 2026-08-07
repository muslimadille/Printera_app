# Printera Backend (Laravel + JWT)

Replacement for the Supabase `manage-users` edge function. This is the **initial
scaffold**: **Phase 0** (foundations) and the core of **Phase 1** (auth & sessions)
are implemented; Phases 2–5 endpoints are wired in `routes/api.php` with stub
controllers that point at their tickets. See the specs in `../docs/backend-laravel/`
and the detailed tickets in `../docs/backend-laravel/tickets/PHASE-0-1-DETAILED.md`.

> **Status:** installed and verified — `php artisan test` is green (11 passed) and
> `./vendor/bin/pint --test` is clean on PHP 8.5.1. Tests run on in-memory SQLite;
> **the migrations have not yet been run against PostgreSQL**, which is the deployment
> target. See `../docs/backend-laravel/tickets/PHASE-0-1-AUDIT.md` for the full gap list.

## Requirements
- PHP 8.2+ (verified on 8.5.1)
- Composer
- PostgreSQL (recommended; matches the current schema) — SQLite is used for tests

> **Framework version:** Laravel **12.61.1+** is required, not Laravel 11. Every 11.x
> release is blocked by unpatched security advisories — including a temporary signed-URL
> path confusion that BE-050 depends on — and Composer refuses to install them. Laravel 12
> keeps the same skeleton, so no application code changed for the bump.

## Setup
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# JWT (php-open-source-saver/jwt-auth)
php artisan vendor:publish --provider="PHPOpenSourceSaver\JWTAuth\Providers\LaravelServiceProvider"
php artisan jwt:secret

# Configure DB + admin bootstrap in .env:
#   DB_*  and  ADMIN_USERNAME / ADMIN_PASSWORD   (no legacy demo passwords!)
php artisan migrate --seed

php artisan serve   # http://localhost:8000/api/v1/health
```

## What works now (Phase 0 + Phase 1)
- `GET  /api/v1/health`
- `POST /api/v1/auth/login` — device reuse, device-limit payload, bcrypt + legacy
  SHA-256 auto-migrate, `login_logs` + `session_events`, JWT whose `jti` is the
  `user_sessions.session_token`.
- `POST /api/v1/auth/force-login`
- `GET  /api/v1/auth/me` (verify_session) + `POST /api/v1/auth/heartbeat`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/change-password`
- `session.active` middleware = JWT validation **+** revocable session allow-list.
- `role.admin` middleware for `/api/v1/admin/*`.

## What's stubbed (returns HTTP 501 with its ticket id)
Settings, quotes, activity, employees, files, voice, and all `/admin/*` endpoints.
Implement per the tickets in `../docs/backend-laravel/05-IMPLEMENTATION-BACKLOG.md`
and `../docs/backend-laravel/tickets/PHASE-0-1-DETAILED.md`.

## Tests
```bash
php artisan test            # or ./vendor/bin/phpunit
./vendor/bin/pint --test    # code style (PSR-12)
```
`tests/Feature/AuthTest.php` covers part of the Phase 1 acceptance criteria (login, device
limit → force login, me/logout revocation, change-password invalidation, SHA-256→bcrypt).
`tests/Feature/ErrorConventionTest.php` covers BE-003's response shapes.

> Coverage is **11 tests against ~28 acceptance criteria**. BE-016 (idle prune) has none
> at all. The full gap matrix is in `../docs/backend-laravel/tickets/PHASE-0-1-AUDIT.md` §4.

## Error convention (do not change)
- Business errors → **HTTP 200** with `{ "error": "<arabic>", ...flags }`.
- **Validation failures → HTTP 200** with `{ "error": "البيانات غير مكتملة", "errors": {…} }`
  — *not* Laravel's 422. The Arabic string is what the SPA renders; `errors` carries the
  per-field English detail for debugging only.
- Auth failure → **HTTP 401** with `{ "error": "...", "session_expired": true }`.
- Server error → **HTTP 500** with `{ "error": "حدث خطأ في الخادم" }`.
- Exceptions that carry their own HTTP status (404, 405, 429, …) keep Laravel's handling.
Arabic strings live in `app/Support/Messages.php`, copied verbatim from the current
edge function. The SPA depends on these shapes.

## Layout
```
app/
  Http/Controllers/Api/V1/    AuthController (done) + stubs (+ Admin/)
  Http/Middleware/            EnsureSessionActive, EnsureAdmin
  Http/Requests/Auth/         Login/ForceLogin/ChangePassword
  Http/Resources/             UserResource
  Services/                   AuthService, SessionService
  Support/                    Messages, ApiResponse
  Exceptions/                 ApiException
  Models/                     8 Eloquent models (UUID)
database/migrations/          8 tables (identical names to Supabase)
database/seeders/             AdminSeeder (env-driven)
routes/api.php                /api/v1 (auth live, rest stubbed)
```
