# CLAUDE.md — Planner Guide for the Printera Project

> **Read this first.** This file is the single source of truth for **how Claude
> plans work** on this repository. Claude is the **planner/architect**; the
> executor models (Codex / GLM / MiniMax) implement against the specs. Execution
> rules for those models live in **`AGENTS.md`**. Deep architecture lives in
> **`ARCHITECTURE.md`**. The backend rebuild specs live in
> **`docs/backend-laravel/`**.

---

## 1. What this project is (in one paragraph)

**Printera** (repo: `cct.printera-app`) is a **B2B SaaS web application for
print & packaging cost estimation and quoting** used by Egyptian/Arabic printing
houses (المطابع). It replaces hand-maintained Excel pricing sheets with a large
set of specialized calculators (item cost, flat sheets, die-cut boxes, parametric
dieline templates with 2D/3D preview + auto-nesting, magazines, bags, montage),
plus saved quotes, per-user pricing settings, a multi-tenant user/employee system,
and an admin analytics panel. The UI is **Arabic, RTL**. The current backend is
**Supabase** (Postgres + Deno Edge Functions). **The mission is to replace
Supabase with a Laravel JWT API** that is also **mobile-app ready**.

For the full business narrative and current build status, read
**`docs/PROJECT_STATUS_AR.md`** (Arabic).

---

## 2. Decisions already locked (do not re-litigate)

These were decided with the product owner. Treat them as constraints:

| Topic | Decision |
|-------|----------|
| Target backend | **Laravel** REST API (replaces Supabase entirely) |
| API auth | **JWT** (stateless token transport) + a **server-side session/device registry** to preserve device limits, remote logout, and heartbeat (see §6) |
| Identity model | **Keep exactly as today**: `username` + `password` only. **No email.** Password resets are done by an admin / account owner, not by self-service email |
| Roles | **Same three tiers** — `admin`, `account_owner`, `employee` — plus the existing **per-user tab permissions** feature-flag system |
| Docs language | **Technical docs & specs in English**; **business/status docs in Arabic** |
| Mobile | APIs must be consumable by a future **mobile app** (clean REST, JWT bearer, versioned under `/api/v1`) |

If a future request conflicts with one of these, **stop and confirm** before planning around it.

---

## 3. Current tech stack (frontend — stays as-is)

- **React 18 + TypeScript + Vite 5**, package manager **Bun** (`bun.lock`).
- Bootstrapped with **Lovable** (`lovable-tagger`, `.lovable/`); code has since been hand-refined.
- UI: **shadcn/ui** (Radix primitives) + **Tailwind CSS 3**, Arabic RTL.
- State: **Zustand** (`src/store/printingStore.ts`) with heavy `localStorage` persistence.
- Server state: **TanStack React Query**.
- Routing: **react-router-dom** — beta exposes only `/app` (see `src/App.tsx`).
- Geometry/packaging: `@doodle3d/clipper-lib`, custom NFP nesting, **Three.js** 3D box previews.
- Export: `jspdf`, `pdfjs-dist`, `svg2pdf.js`, `xlsx` (SheetJS).
- AI voice input: `parse-voice-input` edge function (Lovable AI gateway, Gemini 2.5 Flash).
- Tests: **Vitest** + Testing Library + **Playwright**.

> The frontend is **not** being rewritten. The rebuild only swaps the backend
> that `src/lib/userApi.ts` and `src/lib/activityTracker.ts` talk to. See §7.

---

## 4. Current backend (Supabase — being replaced)

- **Project id:** `fcnvyeqpvvascybcvzhi` (env in `.env`, `src/integrations/supabase/`).
- **Auth is custom, NOT Supabase Auth.** A single Deno edge function
  `supabase/functions/manage-users/index.ts` (~1300 lines, ~40 actions) is the
  **entire backend API**: login/session/device management, user & employee CRUD,
  tab permissions, cloud settings, saved quotes, storage signed URLs, activity
  logging, and admin analytics. It runs with the **service-role key** and bypasses RLS.
- Second function `supabase/functions/parse-voice-input/index.ts` = AI voice → form fields.
- **8 tables:** `app_users`, `user_sessions`, `session_events`, `login_logs`,
  `activity_events`, `saved_quotes`, `user_settings`, `user_tab_permissions`.
- **RLS:** every table has a **deny-all RESTRICTIVE** policy for `anon`/`authenticated`;
  only the edge function (service role) reads/writes. The client never touches the DB directly.
- **Storage:** private `montage-files` bucket, served via signed URLs.

The full current + target architecture is documented in **`ARCHITECTURE.md`**.

---

## 5. The three roles (authoritative summary)

The backend rebuild keeps these exactly. Full contract in
`docs/backend-laravel/01-ROLES-AND-PERMISSIONS.md`.

1. **Admin** (`is_admin = true`) — platform operator (Sanabil/Printera side).
   Manages **all** accounts, sees login history and per-user analytics, sets
   subscriptions (`expires_at`), device limits (`max_devices`) and employee caps
   (`max_employees`). UI tabs: `users`, `loginhistory`.
2. **Account Owner** (`is_admin = false`, `parent_user_id = null`) — a printing
   company tenant. Owns its pricing data and quotes, creates **employees** up to
   `max_employees`, controls each employee's tab permissions, and toggles
   `employees_can_view_quotes`.
3. **Employee** (`parent_user_id = <owner id>`) — a sub-user of an owner. Inherits
   the owner's tab permissions on creation; sees sibling quotes and (optionally)
   the owner's quotes.

Feature gating is per-user via `user_tab_permissions` (a row per tab key, e.g.
`itemcost`, `diecut5`, `savedquotes`). The full tab catalog is in
`src/lib/tabRegistry.ts` and `src/components/AppTabs.tsx`.

---

## 6. Auth model for the Laravel rebuild (important nuance)

Pure stateless JWT cannot express the product's existing security features
(**max N devices**, **admin force-terminate a session**, **60s heartbeat**,
"login from a new device" prompt). The plan therefore uses **JWT + a session
registry**:

- On login, issue a **JWT** whose `jti` (token id) is also written to a
  `user_sessions` row together with `device_id`, `device_info`, `ip`, `last_active_at`.
- Every authenticated request validates the JWT **and** checks the `jti` still
  exists in `user_sessions` (allow-list) — this is what makes tokens **revocable**.
- Device limit = count of rows in `user_sessions` for the user; `force_login`
  deletes the selected/oldest row (revoking that `jti`).
- Heartbeat updates `last_active_at`; idle rows (>72h) are pruned on login.

This preserves 100% of current behavior. Details + endpoint contracts:
`docs/backend-laravel/03-API-SPECIFICATION.md` §Auth.

---

## 7. The frontend seam (what actually changes)

Almost all client↔backend traffic goes through **two files**:

- `src/lib/userApi.ts` — every `callApi({ action, ... })` POST to `manage-users`.
- `src/lib/activityTracker.ts` — batched `log_activity_batch` POSTs.

Plus `src/integrations/supabase/client.ts` (Supabase JS client, used only for the
function URL + anon key today). **Cutover strategy:** re-point these to the new
Laravel `/api/v1` endpoints behind a thin client, keep the same function
signatures so component code is untouched, then delete `@supabase/supabase-js`
and `src/integrations/supabase/`. Storage (`montage-files`) moves to a Laravel
disk (local/S3) with signed URLs. See
`docs/backend-laravel/00-OVERVIEW-AND-MIGRATION-PLAN.md`.

---

## 8. How Claude plans (planning protocol)

1. **Ground every plan in the specs.** Before proposing work, read the relevant
   file(s) under `docs/backend-laravel/`. If the spec is missing or ambiguous,
   the deliverable is **a spec update**, not code.
2. **Map, don't invent.** Every Laravel endpoint must trace back to a current
   `manage-users` action (or be explicitly marked *new*). The mapping table lives
   in `docs/backend-laravel/03-API-SPECIFICATION.md`.
3. **Preserve behavior first, improve second.** Call out any change to observable
   behavior (error strings are Arabic and user-visible — keep them) and flag it.
4. **Produce executor-ready tickets.** Plans should decompose into the phased
   tickets in `docs/backend-laravel/05-IMPLEMENTATION-BACKLOG.md`: each ticket has
   scope, files to touch, acceptance criteria, and test requirements.
5. **Always include verification.** Every plan ends with how it will be proven
   (unit tests, Postman/HTTP checks, parity against the Supabase behavior).
6. **Keep the three-doc contract in sync.** If a plan changes architecture, update
   `ARCHITECTURE.md`; if it changes execution rules, update `AGENTS.md`.

### Division of labor
- **Claude (planner):** reads code, writes/updates specs & tickets, reviews diffs
  against acceptance criteria, keeps docs coherent.
- **Codex / GLM / MiniMax (executors):** implement one ticket at a time following
  `AGENTS.md`, never expand scope, always run the ticket's tests.

---

## 9. Repo map (orientation)

```
cct.printera-app/
├── CLAUDE.md            ← this file (planner)
├── AGENTS.md            ← executor rules (Codex/GLM/MiniMax)
├── ARCHITECTURE.md      ← current + target architecture
├── src/
│   ├── lib/             ← calc engines + userApi.ts + activityTracker.ts (the backend seam)
│   ├── components/       ← calculators, AppTabs.tsx, UserManagement.tsx (admin panel UI)
│   ├── store/printingStore.ts  ← domain model + Excel-parity calc engine
│   └── integrations/supabase/  ← TO BE REMOVED after cutover
├── supabase/            ← current backend (functions + migrations) — reference during rebuild
├── docs/
│   ├── PROJECT_STATUS_AR.md          ← business + current stage (Arabic)
│   ├── TEMPLATE_ONBOARDING_PROTOCOL.md ← how dieline templates are certified (domain)
│   └── backend-laravel/              ← the rebuild specs (00→05)
└── .agents/skills/create-template/   ← existing skill for adding packaging templates
```

---

## 10. Guardrails

- **Never** commit or expose the Supabase **service-role key**. The `.env` anon
  key is public by design; treat any service key as a secret.
- **Do not** change calculator math when doing backend work — pricing logic in
  `printingStore.ts` and `src/lib/*Engine.ts` is Excel-parity and out of scope.
- **Keep Arabic user-facing strings** (errors, labels) byte-for-byte during migration.
- **No new dependencies** without noting them in the ticket and in `AGENTS.md`.
- The default admin seed (`admin`/`owner`) and any demo passwords in old
  migrations must **not** be carried into production seeds.
