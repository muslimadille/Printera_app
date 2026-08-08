# SPEC-01 — DB-managed Templates (Template CRUD)

> Make the packaging-template **catalog** data-driven so admins can add / rename /
> categorize / enable-disable / reorder / price / permission templates from the UI
> **without a redeploy** — while the **geometry engines stay in code** (Phase 1,
> hybrid). This is the foundation for later self-service template creation.
>
> Context: `docs/PRINTERA_CONTROL_AND_DESIGN_TOOLS_AR.md`. Backend conventions:
> `docs/backend-laravel/03-API-SPECIFICATION.md` + `01-ROLES-AND-PERMISSIONS.md`.
> First executable slice: `PROMPT-01-templates-to-db.md`.

---

## 1. Problem & approach

**Today:** each template is hardcoded — `src/lib/{key}/{types,reference,geometry,nesting}.ts`
+ `src/components/boxes/{Key}Calculator.tsx`, registered in `tabRegistry.ts` / `AppTabs.tsx`,
with its 3D `faceCoords` inside the Calculator. Adding/renaming/pricing a template = code + deploy.
There is **no CRUD**.

**Approach — HYBRID (Phase 1):** move the **catalog + metadata + availability + pricing +
ordering + permission** into a DB `templates` table. The **geometry/3D engine stays code**,
referenced by a stable `engine_key`. The frontend renders the catalog from the API and resolves
`engine_key → code engine` via a registry. Result: full admin CRUD over the catalog, zero redeploy,
no risk to the calc/geometry math.

> **Out of scope here (Phase 2, separate spec):** data-driven parametric geometry (creating brand-new
> templates from an uploaded/tagged dieline without code). This spec only makes the CATALOG dynamic.

---

## 2. Data model

New table **`templates`** (UUID PK, same conventions as `02-DATABASE-SCHEMA.md`; MySQL: VARCHAR(191)
on indexed strings, `json` columns nullable without DB default per BE-060):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `key` | varchar(191), **unique** | stable slug; MUST equal the existing tab/source_type key (e.g. `box_d001`, `diecut5`) so quotes + permissions keep working |
| `engine_key` | varchar(191) | which CODE engine renders it (see registry §4). Usually == `key` for built-ins |
| `name_ar` | varchar(255) | Arabic display name (e.g. "علبة دواء") |
| `name_en` | varchar(255), nullable | |
| `category` | varchar(191), nullable | e.g. `boxes`, `diecut`, `bags`, `magazines` (for grouping in nav) |
| `description_ar` | text, nullable | |
| `icon` | varchar(64), nullable | lucide icon name for the nav |
| `thumbnail_svg` | longtext / json, nullable | the `template-color.svg` for the picker card (or a storage path) |
| `default_params` | json, nullable | reference dimensions (L/W/H/flaps…) used to seed the calculator |
| `min_params` / `max_params` | json, nullable | dimension bounds for validation |
| `pricing` | json, nullable | per-template pricing hooks/overrides (optional; default reuses the existing size-based pricing) |
| `is_active` | boolean, default true | hide/show without deleting |
| `is_system` | boolean, default false | built-in (protected from delete) vs admin-created |
| `sort_order` | integer, default 0 | ordering within a category |
| `created_at` / `updated_at` | timestamps | |

Indexes: `unique(key)`, `index(category, sort_order)`, `index(is_active)`.

**Permissions:** templates map 1:1 to the existing per-user **tab keys** (`user_tab_permissions.tab_key`
== `templates.key`). Reuse that system — no new permission table. `isTabAvailable(key, isAdmin, perms)`
still governs visibility.

**Quotes:** `saved_quotes.source_type` already stores the template key — **keep keys stable** so old
quotes still resolve. No change to `saved_quotes`.

---

## 3. API (Laravel `/api/v1`)

Follow existing conventions (JWT auth, `role.admin` for writes, API Resources, Arabic business errors,
200-with-error, MySQL+pgsql tested).

**Authenticated (any user) — the catalog the app renders:**
- `GET /templates` → active templates the caller may see (filtered by tab permissions), grouped/ordered:
  ```json
  { "templates": [ { "key","engine_key","name_ar","name_en","category","icon",
                     "thumbnail_svg","default_params","sort_order","is_active" } ] }
  ```

**Admin (`role.admin`) — CRUD:**
- `GET /admin/templates` → all templates (incl. inactive) for management.
- `POST /admin/templates` `{ key, engine_key, name_ar, name_en?, category?, icon?, thumbnail_svg?,
   default_params?, min_params?, max_params?, pricing?, is_active?, sort_order? }` →
   `key` must be unique (`400 "المفتاح مستخدم مسبقاً"`) and `engine_key` must exist in the code registry
   (`400 "المحرك غير معروف"`). `is_system` is server-controlled (admins create non-system rows).
- `PATCH /admin/templates/{id}` → update metadata/pricing/active/order. For `is_system` rows, allow
  metadata/active/order/pricing edits but **block** changing `key`/`engine_key` and block delete.
- `DELETE /admin/templates/{id}` → only non-system; `403` for system rows. (Prefer `is_active=false`.)
- `PATCH /admin/templates/reorder` `{ order: [{id, sort_order}] }` → bulk reorder.

Resources: `TemplateResource` (public shape) + `AdminTemplateResource` (full). Policy: `TemplatePolicy`
(admin only for writes). Validation via Form Requests (lenient → business errors, per the project convention).

---

## 4. Frontend

**Engine registry (code side)** — `src/lib/templates/engineRegistry.ts`:
```ts
// engine_key → lazy code engine (the existing Calculator + geometry). Built-ins register here.
export const TEMPLATE_ENGINES: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  box_d001: () => import('@/components/boxes/D001Calculator'),
  diecut5:  () => import('@/components/DieCutCalculator5'),
  // …every existing template…
};
export const hasEngine = (k: string) => k in TEMPLATE_ENGINES;
```

**Catalog consumption:**
- Fetch `GET /templates` via React Query on load; cache it. Replace the **hardcoded box/template lists**
  in `tabRegistry.ts` / `AppTabs.tsx` (and the sidebar nav) with the fetched catalog — render nav
  groups from `category` + `sort_order`, gated by `isTabAvailable(key,…)` exactly as today.
- When a template tab is opened, resolve `engine_key → TEMPLATE_ENGINES[engine_key]` and lazy-render the
  existing Calculator, passing `default_params`/bounds from the catalog row. **Calculator internals unchanged.**
- Fallback: if the catalog fails to load, fall back to a bundled static copy of the catalog so the app
  still works offline / on API error (parity safety).

**Admin UI** — a "القوالب" management screen (mirror `UserManagement` patterns): list (with category +
active toggle + drag-reorder), create (pick an `engine_key` from the registry + fill metadata + upload
`thumbnail_svg`), edit, enable/disable, delete (non-system), set per-user permission (reuse the existing
tab-permission editor keyed by `templates.key`).

---

## 5. Seeding / migration (no data loss)

- **Seeder** `TemplateSeeder`: insert one `templates` row per CURRENTLY hardcoded template, with
  `is_system=true`, `key`==the existing tab key, `engine_key`==same, `name_ar` from `tabRegistry`,
  `category` from its current group, `thumbnail_svg` from the template's `template-color.svg`,
  `default_params` from its `reference.ts`. This makes the DB catalog identical to today on day one.
- Keys are **byte-identical** to the current tab/source_type keys → existing `saved_quotes` and
  `user_tab_permissions` keep working untouched.

---

## 6. Acceptance criteria

- Admin can, from the UI and **without a deploy**: add a template (bound to an existing engine),
  rename, categorize, reorder, enable/disable, set pricing, and set per-user visibility.
- The app renders its template nav from `GET /templates`; opening any template still loads the exact
  same calculator/geometry/3D as before (engines untouched).
- Built-in (`is_system`) templates cannot be deleted or have their `key`/`engine_key` changed; they can
  be renamed/reordered/hidden/priced.
- Existing saved quotes and tab permissions continue to resolve (keys unchanged).
- Catalog fetch has a static fallback (no white screen on API failure).
- Tests: API CRUD + permission + unique-key + system-protection; a frontend test that the nav renders
  from a mocked catalog and resolves an engine. `pint`/`php artisan test` (MySQL+pgsql) + `bun run test` green.

---

## 7. Phasing

- **Phase 1 (this spec):** DB catalog + engines-as-code registry + admin CRUD. Low risk.
- **Phase 2 (later spec):** data-driven parametric geometry — create brand-new templates from an
  uploaded/tagged dieline (builds on `DielineImport` + the `TEMPLATE_ONBOARDING_PROTOCOL` boundaries
  model), so `engine_key` can point to a generic interpreter instead of bespoke code. High risk — spike first.

> First executable slice (read-through catalog, no admin UI yet): `PROMPT-01-templates-to-db.md`.
