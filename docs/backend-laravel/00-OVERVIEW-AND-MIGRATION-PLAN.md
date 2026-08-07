# 00 — Backend Rebuild: Overview & Migration Plan (Supabase → Laravel)

> **Goal:** replace the Supabase backend (Postgres + `manage-users` edge function)
> with a **Laravel REST API** authenticated by **JWT**, reaching **behavioral
> parity** first, then **removing Supabase entirely**, while keeping the React
> frontend essentially untouched and making the API **mobile-ready**.
>
> Read alongside: `ARCHITECTURE.md`, and the sibling specs 01–05 in this folder.
> Locked decisions are in `CLAUDE.md §2`.

---

## 1. Principles

1. **Parity before improvement.** Port behavior 1:1 (including Arabic error strings
   and the "200-with-error-body" convention) before changing anything.
2. **The frontend seam is sacred.** Keep the public signatures of
   `src/lib/userApi.ts` and `src/lib/activityTracker.ts` stable so component code
   is not rewritten. Swap only the transport + base URL.
3. **Same schema, same names.** Laravel migrations reproduce the current tables and
   column names (see `02-DATABASE-SCHEMA.md`) so data migration is a straight copy.
4. **Revocable JWT.** JWT for transport + a `user_sessions` allow-list so device
   limits / force-logout / heartbeat survive (see `03-API-SPECIFICATION.md §Auth`).
5. **Ship in verifiable phases.** Each phase has an exit criterion and a parity check.

---

## 2. Target stack

| Concern | Choice |
|---|---|
| Framework | **Laravel 12** (`^12.61.1` minimum), PHP 8.2+ — verified on 8.5.1. **Not Laravel 11:** every 11.x release is blocked by unpatched security advisories and Composer refuses to install them (see `tickets/PHASE-0-1-AUDIT.md` §0b) |
| Auth | **JWT** guard (`php-open-source-saver/jwt-auth`, the maintained `tymon` fork) + `user_sessions` registry |
| DB | PostgreSQL (recommended — matches current) or MySQL; schema identical either way |
| Storage | Laravel filesystem disk: local (dev) / **S3-compatible** (prod), signed temporary URLs |
| Validation | Form Requests |
| Serialization | API Resources |
| Authorization | Policies (admin / owner / employee) |
| AI (voice) | Provider-agnostic service behind `/voice/parse` |
| Tests | Pest or PHPUnit + Laravel HTTP tests |
| Style | Laravel Pint (PSR-12) |
| API base | `/api/v1`, JSON only, CORS for the SPA + mobile |

---

## 3. Repository layout after the rebuild

```
cct.printera-app/
├── backend/                      # NEW — Laravel app
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/{Auth,Users,Employees,Quotes,Settings,
│   │   │        TabPermissions,Sessions,Activity,Analytics,LoginLogs,Files,Voice}Controller.php
│   │   ├── Http/Requests/...      # Form Requests (validation)
│   │   ├── Http/Resources/...     # API Resources (output shapes)
│   │   ├── Http/Middleware/EnsureSessionActive.php   # JWT jti ↔ user_sessions allow-list
│   │   ├── Models/{AppUser,UserSession,SessionEvent,LoginLog,ActivityEvent,
│   │   │        SavedQuote,UserSetting,UserTabPermission}.php
│   │   ├── Policies/...           # admin/owner/employee gates
│   │   └── Services/...           # Auth, Session, Employee, Quote, Analytics, Storage, Voice
│   ├── database/migrations/       # mirrors 02-DATABASE-SCHEMA.md
│   ├── database/seeders/          # admin bootstrap (NO old demo passwords)
│   ├── routes/api.php             # /api/v1/*
│   └── tests/                     # parity + feature tests
├── src/lib/apiClient.ts           # NEW thin client (base URL from env, JWT header)
├── src/lib/userApi.ts             # SAME signatures, now calling apiClient
├── src/integrations/supabase/     # DELETED at cutover
└── supabase/                      # kept read-only as reference, retired at the end
```

---

## 4. Phases

### Phase 0 — Foundations  *(tickets BE-000..BE-003)*
- Scaffold `backend/` Laravel app, `/api/v1` group, CORS, JSON error handler that
  reproduces the **200-with-error-body** convention.
- Install & configure JWT; `php artisan jwt:secret`.
- Create migrations for **all 8 tables** (identical names) + models + factories.
- Seed a single admin (env-driven password; **not** the old `1234`/`M123123`).
- **Exit:** `php artisan migrate --seed` works; health endpoint returns `200`.

### Phase 1 — Auth & sessions  *(BE-010..BE-016)*
- Port `login`, `force_login`, `verify_session` (→ `/auth/me` + `/auth/heartbeat`),
  `logout`, `change_password`.
- Implement **device limit / reuse / force-login** using `user_sessions` + JWT `jti`
  allow-list middleware; port bcrypt verify + **SHA-256→bcrypt auto-migrate**.
- Emit `login_logs` + `session_events` (login/logout/heartbeat/auto_logout) exactly as today.
- **Exit:** login→heartbeat→logout parity; device-limit + force-login parity; tokens revocable.

### Phase 2 — Core tenant features  *(BE-020..BE-028)*
- **Settings:** `save_settings` / `load_settings` (own-user only).
- **Quotes:** `save/update/delete/list_quotes` incl. the **family visibility** rules
  (owner sees employees; employees see siblings + owner-if-allowed);
  `toggle_employees_view_quotes`.
- **Activity:** `log_activity_batch` (accept `sendBeacon` blobs), allowed-action filter, 200-cap.
- **Exit:** settings + quotes + activity parity, including visibility matrix tests.

### Phase 3 — Employees & permissions  *(BE-030..BE-036)*
- Owner **employee CRUD** with `max_employees` cap, tab-permission inheritance,
  `check_employee_quotes`, `transfer_quotes`, employee tab-permission get/update.
- **Exit:** employee lifecycle + permission inheritance parity.

### Phase 4 — Admin & analytics  *(BE-040..BE-046)*
- Admin **user CRUD**, `get_tab_permissions`/`update_tab_permissions`,
  `get_sessions`/`terminate_session`, `login_logs`, `get_user_analytics`.
- Replace per-request admin creds with **admin JWT + Policy** (coordinate FE change).
- **Exit:** admin panel spec (`04-ADMIN-CONTROL-PANEL-SPEC.md`) endpoints green.

### Phase 5 — Storage & voice  *(BE-050..BE-053)*
- File upload/download/delete via Laravel disk + signed URLs (per-user prefix).
- `/voice/parse` porting the `parse-voice-input` prompt + field schema.
- **Exit:** attachment round-trip + voice parse parity.

### Phase 6 — Frontend cutover  *(FE-060..FE-064)*
- Add `src/lib/apiClient.ts` (base URL from `VITE_API_BASE_URL`, `Authorization: Bearer`).
- Rewire `userApi.ts` + `activityTracker.ts` to Laravel **without changing signatures**.
- Store JWT where the session is stored today (`printCalc_session`); keep `device_id` logic.
- Feature-flag/base-URL toggle to run against either backend during verification.
- **Exit:** full app works against Laravel in staging; parity checklist passes.

### Phase 7 — Data & storage migration  *(OPS-070..OPS-073)*
- Export the 8 Supabase tables → import into the new DB (straight copy; ids preserved).
- Copy `montage-files` objects to the new disk, keeping paths.
- Re-point `saved_quotes.quote_data` attachment URLs if the storage host changes.
- **Exit:** row counts match; spot-checked users can log in and see their quotes/settings.

### Phase 8 — Decommission Supabase  *(OPS-080..OPS-083)* — see §6
- Remove Supabase from the frontend and delete the project after a safety window.

---

## 5. Frontend cutover detail (the seam)

Today (`src/lib/userApi.ts`): every call is
`POST ${SUPABASE_URL}/functions/v1/manage-users` with `{ action, ...params }` and an
`apikey` header. After cutover:

- `apiClient.ts` maps each former **action** to a REST call under `VITE_API_BASE_URL`
  (`/api/v1/...`) and attaches `Authorization: Bearer <jwt>`.
- **Keep** `parseApiResponse` semantics: business errors as **HTTP 200 + `{error}`**,
  auth failure as **401 + `{session_expired:true}`** (which dispatches
  `printCalc:sessionExpired`). The Laravel error handler must mirror this exactly.
- **Keep** all exported function names/shapes (`loginUser`, `verifySession`,
  `listQuotes`, `getUserAnalytics`, …) so no component changes.
- `activityTracker.ts` keeps batching + `sendBeacon`; only the URL changes.

---

## 6. Supabase removal checklist (Phase 8 — do only after Phase 7 verified)

- [ ] Delete `src/integrations/supabase/` (`client.ts`, `types.ts`).
- [ ] Remove `@supabase/supabase-js` from `package.json` + `bun.lock` (`bun remove`).
- [ ] Remove Supabase env keys from `.env` / hosting: `VITE_SUPABASE_URL`,
      `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`; add
      `VITE_API_BASE_URL`.
- [ ] Grep the repo for `supabase`, `functions/v1`, `manage-users`, `montage-files`
      → 0 references in `src/` (outside the retired `supabase/` folder).
- [ ] Move `supabase/` to `legacy/supabase/` (or delete) once parity is signed off.
- [ ] Rotate/scrub the old service-role key; ensure it is nowhere in git history.
- [ ] Revoke the `LOVABLE_API_KEY` if the voice provider changed.
- [ ] Take a final Supabase DB + storage backup, then **pause**, then (after a
      safety window) **delete** the Supabase project `fcnvyeqpvvascybcvzhi`.
- [ ] Update CI/CD, DNS, and any webhooks pointing at Supabase.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Behavioral drift (error strings, edge cases) | Parity checklist per endpoint; keep `manage-users` as reference; HTTP tests assert exact bodies |
| JWT can't revoke → device limits break | `user_sessions` allow-list middleware (jti check) — designed in from Phase 1 |
| Admin-auth change breaks FE | Do it in Phase 4 with a matching FE change; keep old shape until FE updates |
| Data migration mismatches | Preserve ids + column names; verify row counts + spot checks in Phase 7 |
| Storage URL changes invalidate saved attachments | Re-sign/rewrite URLs during Phase 7; keep object paths identical |
| Analytics performance | Same in-request approach at parity; note a future aggregation path |

---

## 8. Definition of Done (whole rebuild)

- All `manage-users` actions have REST equivalents at parity (see mapping table in
  `03-API-SPECIFICATION.md`).
- Frontend runs on Laravel with **no component changes** beyond the seam.
- Data + storage migrated; users log in and see identical data.
- Supabase fully removed (checklist §6 complete).
- Admin control panel spec (`04`) implemented; API is mobile-ready (`/api/v1`, JWT).
- Test suites green; parity checklist archived.
