# Backend Rebuild Specs — Printera (Supabase → Laravel/JWT)

This folder is the **spec set** for replacing the Supabase backend with a Laravel
REST API (JWT auth), reaching behavioral parity first, then removing Supabase.

**Read in order:**

1. [`00-OVERVIEW-AND-MIGRATION-PLAN.md`](./00-OVERVIEW-AND-MIGRATION-PLAN.md) — strategy, target stack, phases, Supabase removal checklist.
2. [`01-ROLES-AND-PERMISSIONS.md`](./01-ROLES-AND-PERMISSIONS.md) — the three roles, tenancy, capability matrix, tab permissions.
3. [`02-DATABASE-SCHEMA.md`](./02-DATABASE-SCHEMA.md) — the 8 tables (identical names), constraints, retention, storage, data-migration map.
4. [`03-API-SPECIFICATION.md`](./03-API-SPECIFICATION.md) — every REST endpoint, JWT+session mechanic, request/response shapes, action→REST map, parity checklist.
5. [`04-ADMIN-CONTROL-PANEL-SPEC.md`](./04-ADMIN-CONTROL-PANEL-SPEC.md) — admin endpoints + analytics payload + computation rules.
6. [`05-IMPLEMENTATION-BACKLOG.md`](./05-IMPLEMENTATION-BACKLOG.md) — phased executor tickets (BE-/FE-/OPS-) with acceptance criteria.

**Context (repo root):** `CLAUDE.md` (planner), `AGENTS.md` (executor rules),
`ARCHITECTURE.md` (current + target), `docs/PROJECT_STATUS_AR.md` (business + stage, Arabic).

**Locked decisions:** Laravel + **JWT** (+ `user_sessions` allow-list for revocation),
identity stays **username+password (no email)**, roles stay **admin/owner/employee +
tab permissions**, technical docs **English** / business docs **Arabic**, API is
**mobile-ready** under `/api/v1`. Reference behavior lives in
`supabase/functions/manage-users/index.ts` — port it 1:1, keep Arabic strings.
