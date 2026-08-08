# PROMPT-01 — First practical step: templates → DB registry (read-through)

Paste into Claude Code. This is the **safe foundational slice** of `SPEC-01-TEMPLATE-CRUD-DB.md`:
make the template **catalog** DB-backed and have the frontend render from it — **without** the admin
write-UI yet (that's the next slice). Engines stay code. Zero behavior change on day one (the seeded
catalog == today's hardcoded list).

```markdown
# Task: Make the packaging-template CATALOG DB-backed (read-through) — engines stay code

Read first: docs/design-tools/SPEC-01-TEMPLATE-CRUD-DB.md, docs/backend-laravel/03-API-SPECIFICATION.md,
docs/backend-laravel/02-DATABASE-SCHEMA.md, src/lib/tabRegistry.ts, src/components/AppTabs.tsx.
Backend is Laravel (MySQL target, verified per BE-060); frontend is React/TS/Vite, Arabic RTL.

GOAL: the app renders its template/box nav from `GET /api/v1/templates` instead of the hardcoded lists,
resolving each template to its EXISTING code calculator via an engine registry. Do NOT build the admin
CRUD UI yet. Do NOT change any calculator/geometry/3D internals. Keep template keys byte-identical so
saved_quotes + tab permissions keep working.

## 1) Backend — templates table + seeder + read endpoint
- Migration `templates` per SPEC-01 §2 (UUID id; `key` unique; `engine_key`; `name_ar`; `name_en?`;
  `category?`; `icon?`; `thumbnail_svg?` (longtext/json); `default_params?` (json); `min_params?`/`max_params?`
  (json); `pricing?` (json); `is_active` default true; `is_system` default false; `sort_order` default 0;
  timestamps). MySQL rules: VARCHAR(191) on indexed strings, json columns nullable WITHOUT a DB default
  (default via model), indexes `unique(key)` + `(category, sort_order)` + `(is_active)`.
- `Template` model (HasUuids) + `TemplateResource` (public shape from SPEC-01 §3).
- `GET /api/v1/templates` (auth: session.active) → active templates the caller may see, filtered by the
  caller's tab permissions (key == tab_key, same `isTabAvailable` rule server-side), grouped-ready
  (include category + sort_order). Shape per SPEC-01 §3.
- `TemplateSeeder`: one `is_system=true` row per CURRENT hardcoded template — `key`==existing tab key,
  `engine_key`==same, `name_ar` from tabRegistry, `category` from its current group, `default_params`
  from its `reference.ts`, `thumbnail_svg` from its `template-color.svg` if available. Run it so the DB
  catalog is identical to today. Tests: GET returns the seeded catalog; permission filtering works; MySQL+pgsql green.

## 2) Frontend — engine registry + catalog consumption (with static fallback)
- Create `src/lib/templates/engineRegistry.ts`: map every existing template `engine_key` → a lazy import
  of its current calculator component (e.g. `box_d001 → () => import('@/components/boxes/D001Calculator')`,
  `diecut5 → () => import('@/components/DieCutCalculator5')`, … cover ALL current templates). Export `hasEngine(key)`.
- Fetch `GET /templates` via React Query at app load; build the template/box nav groups from the fetched
  catalog (category + sort_order), gated by the SAME `isTabAvailable(key, isAdmin, tabPermissions)` as today.
  Replace the hardcoded box/template lists in `tabRegistry.ts` / `AppTabs.tsx` (and the sidebar nav) with
  this catalog — but KEEP a bundled STATIC copy of the catalog as a fallback used when the fetch fails
  (offline / API error) so nav never disappears (parity safety).
- When a template tab opens, resolve `engine_key → engineRegistry` and lazy-render the EXISTING calculator,
  passing `default_params` from the catalog row. Calculator internals unchanged. Preserve `data-tour="tab-${key}"`.

## 3) Definition of Done
- The app's template/box nav is rendered from `GET /templates`; every template opens the exact same
  calculator/geometry/3D as before (engines untouched); keys unchanged → saved quotes + permissions still work.
- Seeded catalog == today's list (no visible change on day one). Static fallback verified (kill the API → nav still shows).
- No admin write-UI in this slice (next: SPEC-01 §4 admin CRUD).
- `php artisan test` (MySQL+pgsql) + `bun run lint`/`test`/`build` green. PR notes: the table, the seeder mapping
  (each template → row), the engine registry coverage, and the fallback. Flag any template whose key/engine you
  couldn't map 1:1.
```

**Next slices after this:** SPEC-01 §3–4 admin CRUD (create/rename/categorize/reorder/enable/price/permission),
then Phase 2 (data-driven parametric geometry for true self-service template creation).
