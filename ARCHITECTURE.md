# ARCHITECTURE.md — Printera

> Current architecture (Supabase) and the target architecture (Laravel + JWT).
> Business context: `docs/PROJECT_STATUS_AR.md`. Rebuild specs:
> `docs/backend-laravel/`. Planning rules: `CLAUDE.md`. Execution rules: `AGENTS.md`.

---

## 1. System overview

Printera is a **client-heavy SPA** with a **thin RPC backend**. Almost all domain
logic (pricing math, dieline geometry, nesting, PDF/Excel export, 3D preview) runs
**in the browser**. The backend exists for **identity, persistence, and analytics**
only: authentication + device/session management, per-user cloud settings, saved
quotes, file storage, and activity logging.

```
┌────────────────────────── Browser (React SPA) ──────────────────────────┐
│  UI: shadcn/ui + Tailwind (Arabic RTL)                                   │
│  State: Zustand (printingStore) + localStorage drafts                    │
│  Domain: calc engines, geometry, nesting, 3D (Three.js), export (pdf/xlsx)│
│  Backend seam:  src/lib/userApi.ts  +  src/lib/activityTracker.ts        │
└───────────────┬──────────────────────────────────────────────────────────┘
                │  HTTPS  (today: POST {action,...} to one function)
                ▼
┌────────────────────────── Backend ───────────────────────────────────────┐
│  TODAY (Supabase):                                                        │
│    Edge fn manage-users  → service-role → Postgres (RLS deny-all)         │
│    Edge fn parse-voice-input → Lovable AI gateway (Gemini)                │
│    Storage bucket: montage-files (private, signed URLs)                   │
│                                                                           │
│  TARGET (Laravel):                                                        │
│    /api/v1/* controllers → services → Eloquent → Postgres/MySQL           │
│    JWT auth guard + user_sessions registry (revocable)                    │
│    Storage disk (local/S3) + signed URLs                                  │
│    Voice: /api/v1/voice/parse → AI provider                              │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend architecture (unchanged by the rebuild)

- **Entry:** `src/main.tsx` → `src/App.tsx`. Beta router exposes only `/app`
  (`Index`) and `/__internal/errors`; everything else redirects to `/app`.
- **Session bootstrap:** `src/pages/Index.tsx` restores a "remember me" session
  from `localStorage` (`printCalc_session`), runs a **60s heartbeat**
  (`verifySession`), enforces **tab permissions**, and force-logs-out on 401.
- **Domain state:** `src/store/printingStore.ts` — Zustand store holding
  `paperTypes`, `priceSettings` (per-size color/finishing rates), `finishingItems`,
  `profitMargins`, calculator inputs, and the **Excel-parity calc engine**
  (`useCalculations`, `useMagazineCalculations`). Drafts persist to `localStorage`;
  canonical settings sync to the cloud via `save_settings`/`load_settings`.
- **Feature surface:** `src/components/AppTabs.tsx` + `src/lib/tabRegistry.ts`
  define ~40 tabs across groups: **item-cost calculators** (hybridengine, itemcost,
  flat, costcalc, smartengine, mergeitems, calculator), **templates/boxes**
  (Die-Cut 1–5, Carrying-Handle, Lid-Tuck, Medicine, 10001, SVG-nest, D001, D003,
  T0001, T0002, A01010000, A01700000, generic — parametric dieline engines with
  2D SVG + 3D + nesting + export), **montage** (montage, templatemontage, montag),
  **magazines** (magazinesheet, magazines, newmagazine, magazine), **bags**
  (bagcalc), **tools** (savedquotes, settings, papertypes, finishing, bulkimport,
  quote, employee), **admin** (users, loginhistory), **guide**.
- **The backend seam (critical):**
  - `src/lib/userApi.ts` — every backend call: `callApi({ action, ... })` → POST to
    `${SUPABASE_URL}/functions/v1/manage-users`. Exposes `loginUser`, `forceLogin`,
    `verifySession`, `logoutSession`, `changePassword`, user CRUD, employee CRUD,
    tab-permission CRUD, settings load/save, quotes CRUD, storage helpers, analytics.
  - `src/lib/activityTracker.ts` — client-side buffer that batches activity events
    and flushes (`log_activity_batch`) every 30s and on page hide (`sendBeacon`).
  - `src/integrations/supabase/client.ts` — Supabase JS client; today only used to
    build the function URL + carry the anon `apikey`.
  > **These are the only files that must change for the backend swap.**

---

## 3. Current backend (Supabase) — detailed

### 3.1 Auth is custom (not Supabase Auth)
- Users live in **`app_users`** with `username` (unique) + `password_hash`.
  Hashing: **bcrypt**, with a legacy **SHA-256** path that auto-migrates to bcrypt
  on next successful login (`migrateHashIfNeeded`).
- Sessions are **opaque random 256-bit tokens** stored in **`user_sessions`**
  (`session_token`, `device_id`, `device_info`, `ip_address`, `last_active_at`).
  There is **no JWT** today.
- **Device limits:** login counts active sessions; if `>= max_devices` it returns a
  `device_limit_reached` payload with the active sessions so the UI can offer
  **force login** (terminate the oldest/selected session). Same device (`device_id`)
  re-login **reuses** its row.
- **Heartbeat:** `verify_session` updates `last_active_at` and (throttled to 5 min)
  logs a `heartbeat` into `session_events`. Idle sessions (>72h) are pruned on login.
- **Admin auth is per-request:** admin-only actions require `admin_username` +
  `admin_password` **in every call** (`verifyAdmin`) rather than a session. (This is
  a smell the rebuild fixes — see §5.)

### 3.2 The monolith
`supabase/functions/manage-users/index.ts` dispatches ~40 `action`s in one function
with the **service-role key** (bypasses RLS). Groups:
`login / force_login / verify_session / logout / change_password`,
`list / create / update / delete` (users, admin-gated),
`create_employee / list_employees / update_employee / delete_employee /
check_employee_quotes / transfer_quotes`,
`get_tab_permissions / update_tab_permissions / get_employee_tab_permissions /
update_employee_tab_permissions`,
`save_settings / load_settings`,
`save_quote / update_quote / delete_quote / list_quotes / toggle_employees_view_quotes`,
`get_sessions / terminate_session`,
`login_logs / get_user_analytics`,
`get_upload_url / get_file_url / delete_file`,
`log_activity_batch`.

### 3.3 Data model (8 tables)
| Table | Purpose | Key columns |
|-------|---------|-------------|
| `app_users` | identities & tenancy | `username`, `password_hash`, `is_admin`, `is_active`, `parent_user_id`, `max_devices`, `max_employees`, `employees_can_view_quotes`, `expires_at` |
| `user_sessions` | active device sessions | `session_token` (unique), `device_id`, `device_info`, `ip_address`, `last_active_at` |
| `session_events` | login/logout/heartbeat/auto_logout audit | `event_type`, `occurred_at` |
| `login_logs` | login audit | `username`, `ip_address`, `logged_in_at` |
| `activity_events` | in-app actions (tab_open, calculate, save_quote, export…) | `tab_key`, `action`, `details` jsonb |
| `saved_quotes` | persisted quotes | `source_type`, `quote_data` jsonb, `customer_name`, `quote_number` |
| `user_settings` | cloud settings per user | `setting_key`, `setting_value` jsonb (paperTypes, priceSettings, finishingItems, profitMargins) |
| `user_tab_permissions` | per-user feature flags | `tab_key`, `is_enabled` |

RLS: all tables **deny-all** for `anon`/`authenticated`; only the service role
(edge functions) touches them. Cleanup triggers prune `activity_events` /
`session_events` older than 30 days (~1% of inserts).

### 3.4 Storage & AI
- **Storage:** private `montage-files` bucket; the function issues signed
  upload/download URLs (`get_upload_url`, `get_file_url`, `delete_file`), scoped by
  `user.id/` filename prefixes.
- **AI voice:** `parse-voice-input` sends the Arabic transcript + calc-type field
  schema to the **Lovable AI gateway** (`google/gemini-2.5-flash`) and returns
  parsed form fields.

---

## 4. Target backend (Laravel) — design

### 4.1 Shape
- **Laravel** app under `backend/`, REST under **`/api/v1`**, JSON only.
- Layering: **routes → controllers (thin) → Form Requests → Services → Eloquent →
  DB**. **API Resources** for all output. **Policies** for role checks.
- Same DB schema (table/column names identical to §3.3) so data migration is a copy.

### 4.2 Auth: JWT + session registry (revocable)
- **JWT** (guard-based, e.g. `php-open-source-saver/jwt-auth`) is the bearer token
  the SPA/mobile send as `Authorization: Bearer <jwt>`.
- On login we still write a **`user_sessions`** row and put its id (or a `jti`) into
  the JWT claims. Middleware validates the JWT **and** that the session row still
  exists (allow-list) → tokens become **revocable**, preserving:
  - **device limits** (row count vs `max_devices`),
  - **force login** (delete oldest/selected row → its token stops validating),
  - **heartbeat** (`POST /auth/heartbeat` updates `last_active_at`),
  - **idle prune** (>72h).
- **Admin actions** move to a proper **role-gated, session-authenticated** flow
  (JWT of an admin user) instead of resending `admin_username`/`admin_password`.
  Full contract: `docs/backend-laravel/03-API-SPECIFICATION.md`.

### 4.3 Endpoint groups (map of the monolith → REST)
`/auth` (login, force-login, logout, verify/me, heartbeat, change-password) ·
`/users` (admin) · `/employees` (owner) · `/tab-permissions` · `/settings` ·
`/quotes` · `/sessions` · `/activity` · `/analytics` · `/login-logs` ·
`/files` (upload/download/delete) · `/voice/parse`.
Each endpoint's request/response and its origin action are tabulated in the API spec.

### 4.4 Storage & AI
- **Storage:** Laravel filesystem disk (local for dev, **S3-compatible** for prod)
  with **temporary signed URLs**; keep the `montage-files` naming + per-user prefix.
- **AI voice:** `/api/v1/voice/parse` proxies to the configured AI provider; the
  prompt/field-schema logic ports 1:1 from `parse-voice-input`.

---

## 5. Known issues the rebuild should fix (tracked, not silently changed)

1. **Per-request admin credentials** — admin endpoints resend username+password each
   call. Replace with JWT + admin **Policy**. (Behavioral change → coordinate with FE.)
2. **Anon apikey as the only gate** on the function — replace with JWT middleware.
3. **No rate limiting / lockout** on login — add Laravel throttling.
4. **`quote_data`/`setting_value` are opaque JSON blobs** — keep as JSON (frontend
   owns the shape) but validate size/structure at the edge.
5. **Analytics computed in-request over ≤20k rows** — acceptable now; plan a
   materialized/aggregated path if data grows.
6. **Password reset requires an admin** (no email by decision) — document this in the
   admin panel spec so it's an intended flow, not a gap.

---

## 6. Cutover strategy (summary)

1. Stand up Laravel `/api/v1` reaching **parity** with `manage-users`, table-for-table.
2. Introduce a thin FE client behind the **existing `userApi.ts` signatures**; switch
   the base URL via env. Components stay untouched.
3. **Dual-run / verify parity** endpoint by endpoint (same input → same output).
4. Migrate data (straight table copy) and storage objects.
5. Flip the frontend to Laravel; delete `@supabase/supabase-js` and
   `src/integrations/supabase/`; retire the Supabase project.

Detailed, phased steps: `docs/backend-laravel/00-OVERVIEW-AND-MIGRATION-PLAN.md`.
