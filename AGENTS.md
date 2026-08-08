# AGENTS.md — Execution Rules for Coding Agents

> **Audience:** the executor models (**Codex, GLM, MiniMax**) and any autonomous
> coding agent working in this repo. **Claude plans; you implement.**
> Planning/architecture context is in `CLAUDE.md` and `ARCHITECTURE.md`. The
> backend rebuild specs are in `docs/backend-laravel/`. **Follow the spec; do not
> improvise product behavior.**

---

## 0. Golden rules (read every time)

1. **One ticket at a time.** Implement exactly the ticket from
   `docs/backend-laravel/05-IMPLEMENTATION-BACKLOG.md`. Do not expand scope.
2. **The spec wins.** If code and spec disagree, follow the spec and flag the
   mismatch in your PR notes. If the spec is missing, **stop and ask for a spec**
   — do not guess product behavior.
3. **Preserve observable behavior.** Arabic user-facing strings (errors, labels)
   are part of the contract — copy them **verbatim**. Endpoint responses must
   match the shapes in `03-API-SPECIFICATION.md`.
4. **Never touch calculator math.** `src/store/printingStore.ts` and
   `src/lib/*Engine.ts` are Excel-parity pricing logic and are **out of scope**
   for backend work.
5. **Security:** never hardcode or print secrets. Service keys, JWT secrets, DB
   creds come from env only. Never weaken the "deny-all + server-side access"
   model.
6. **Tests are not optional.** Every ticket lists acceptance tests. Code without
   passing tests is not done.

---

## 1. Repository layout you will touch

```
Frontend (React, do NOT rewrite — only the backend seam changes):
  src/lib/userApi.ts            ← all client → backend calls (the seam)
  src/lib/activityTracker.ts    ← batched activity logging
  src/integrations/supabase/    ← REMOVE after cutover

Current backend (reference while porting, then delete):
  supabase/functions/manage-users/index.ts   ← ~40 actions = the whole API
  supabase/functions/parse-voice-input/index.ts
  supabase/migrations/*.sql                   ← the DB schema history

New backend (create here):
  backend/                      ← Laravel app (see 00-OVERVIEW-AND-MIGRATION-PLAN.md)

Specs (your instructions):
  docs/backend-laravel/00..05-*.md
```

---

## 2. Toolchain & commands

### Frontend (existing)
```bash
bun install            # install deps (use bun, respect bun.lock)
bun run dev            # Vite dev server
bun run build          # production build
bun run lint           # eslint
bun run test           # vitest run (unit)
bunx playwright test   # e2e (if the ticket needs it)
```
> Use **Bun**, not npm/yarn. Do not delete `bun.lock`. A `package-lock.json`
> exists but Bun is the source of truth.

### Backend (Laravel — to be created under `backend/`)
```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan jwt:secret          # JWT signing key (see auth spec)
php artisan migrate --seed
php artisan test                # Pest/PHPUnit — REQUIRED before "done"
./vendor/bin/pint               # code style (PSR-12) — REQUIRED
php artisan serve               # local API
```

---

## 3. Coding standards

### TypeScript / React (frontend seam)
- Match the existing style: functional components, hooks, `@/` path alias, Tailwind classes.
- **Keep public function signatures in `userApi.ts` stable** so components stay untouched.
  Example: `loginUser(username, password, deviceInfo)` must keep returning the same
  `LoginResult` shape even after the backend is Laravel.
- Preserve the existing error convention: business errors return `200 OK` with a JSON
  body (`{ error, session_expired?, device_limit_reached? }`); only auth failures use `401`.
  The client (`parseApiResponse`) depends on this — **do not change it** without a spec change.

### PHP / Laravel (new backend)
- **PSR-12**, enforced by **Laravel Pint**. Strict types where practical.
- Structure: **thin controllers → Form Requests (validation) → Services → Eloquent models**.
  No business logic in controllers.
- One resource area per controller (Auth, Users, Employees, Quotes, Settings,
  TabPermissions, Sessions, Activity, Analytics, Storage) — mirror the spec's grouping,
  **not** the old single-function monolith.
- Use **API Resources** (`JsonResource`) for every response shape.
- Use **Policies** for role checks (admin vs owner vs employee); never inline role logic ad hoc.
- Return Arabic error messages via a `lang/ar` file, keyed — but the **string values must
  match the current ones** in `manage-users/index.ts`.
- Migrations must reproduce the schema in `docs/backend-laravel/02-DATABASE-SCHEMA.md`
  (which is derived from `supabase/migrations/`). Keep table/column names identical so
  data migration is a straight copy.

---

## 4. Definition of Done (per ticket)

A ticket is complete only when **all** hold:

- [ ] Behavior matches the spec section it references (shapes, status codes, Arabic strings).
- [ ] Feature/unit tests written and green (`php artisan test` and/or `bun run test`).
- [ ] Lint/style clean (`pint` for PHP, `bun run lint` for TS).
- [ ] No secret is committed; new env keys are documented in `.env.example` and the ticket.
- [ ] Parity check done: for a ported endpoint, the response equals what `manage-users`
      returned for the same input (see the parity checklist in `03-API-SPECIFICATION.md`).
- [ ] PR notes list: what changed, which spec section, any deviations (with reason), test evidence.

---

## 5. Workflow per ticket

1. **Claim** the ticket (mark it in the backlog / task list). Read the ticket + the
   spec sections it links.
2. **Read the reference** implementation in `manage-users/index.ts` for the action(s)
   you are porting — it is the behavioral source of truth.
3. **Implement** following §3 standards. Small, reviewable commits.
4. **Test** — write the acceptance tests from the ticket, run them, run lint.
5. **Self-verify parity** against the old behavior.
6. **Hand back** with PR notes for Claude to review against acceptance criteria.
   Do **not** start the next ticket until this one is reviewed unless told to.

---

## 6. Hard "do NOT" list

- ❌ Do not rewrite calculators, geometry engines, or pricing math.
- ❌ Do not change the request/response error convention (200-with-error-body).
- ❌ Do not translate, reword, or "improve" Arabic user-facing strings.
- ❌ Do not introduce email/OAuth/social login — identity stays `username`+`password`.
- ❌ Do not add a dependency without noting it in the ticket and here in §7.
- ❌ Do not switch package managers (Bun stays) or add a second Laravel "god controller".
- ❌ Do not expose the DB directly to the client — all access stays server-side.
- ❌ Do not carry old demo/admin passwords from `supabase/migrations/` into seeders.

---

## 7. Dependency ledger (keep updated)

Record every dependency the rebuild adds, so reviewers can audit it.

| Package | Layer | Why | Added by ticket |
|---------|-------|-----|-----------------|
| `php-open-source-saver/jwt-auth` (or agreed JWT lib) | Laravel | JWT auth guard | BE-001 |
| _add rows as you go_ | | | |

---

## 8. When stuck

- Missing/ambiguous spec → **stop**, write down the question, request a spec update
  from the planner. Do not invent behavior.
- Behavior differs between spec and `manage-users` → follow the spec, flag it.
- A change would break a frontend function signature → **don't**; adapt the backend
  to the existing signature, or raise it as a planning question.
