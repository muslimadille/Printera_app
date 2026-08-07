# 01 — Roles & Permissions Specification

> Authoritative contract for **who can do what**. The rebuild keeps the current
> three-tier model exactly. Derived from `app_users` columns and the authorization
> checks in `supabase/functions/manage-users/index.ts`.

---

## 1. The three roles

Roles are **derived from `app_users` columns**, not a separate roles table:

| Role | Definition | Identifies as |
|------|------------|---------------|
| **Admin** | `is_admin = true` | Platform operator (Printera/Sanabil) |
| **Account Owner** | `is_admin = false` AND `parent_user_id IS NULL` | A printing-house tenant |
| **Employee** | `parent_user_id = <owner id>` (and `is_admin = false`) | A sub-user of one owner |

Helper used across the API (server-side):

```
role(user) =
  user.is_admin            -> 'admin'
  else parent_user_id null -> 'account_owner'
  else                     -> 'employee'
```

> **Tenancy = the "family".** An owner + all its employees form one tenant/family.
> `family_ids(user) = [owner_id] ∪ {employee ids under owner_id}` where
> `owner_id = user.parent_user_id ?? user.id`. This is the visibility boundary for
> quotes (see `03-API-SPECIFICATION.md`).

---

## 2. Account attributes (on `app_users`)

| Column | Meaning | Set by |
|--------|---------|--------|
| `is_active` | account enabled; login blocked if false | admin (users), owner (employees) |
| `expires_at` | subscription end; login blocked if past | admin |
| `max_devices` | concurrent device/session cap | admin (users), owner (employees, default 1) |
| `max_employees` | how many employees an owner may create (0 for employees) | admin |
| `employees_can_view_quotes` | employees may see the owner's quotes | owner |
| `parent_user_id` | tenancy link (null = owner/admin) | system on employee create |

---

## 3. Capability matrix

✅ allowed · ❌ denied · 🔸 scoped (see notes)

| Capability | Admin | Owner | Employee |
|---|:--:|:--:|:--:|
| Log in / heartbeat / logout / change own password | ✅ | ✅ | ✅ |
| Use calculators (subject to tab permissions) | ✅ (all) | 🔸 | 🔸 |
| Save/list/edit/delete **own** quotes | ✅ | ✅ | ✅ |
| See **employees'** quotes | ✅ (any) | ✅ (own employees) | 🔸 siblings always; owner's only if `employees_can_view_quotes` |
| Save/load **own** cloud settings | ✅ | ✅ | ✅ |
| Create/list/update/delete **employees** | ❌¹ | ✅ (≤ `max_employees`) | ❌ |
| Set **employee tab permissions** | ✅ (as admin, any user) | ✅ (own employees) | ❌ |
| `toggle_employees_view_quotes` | ❌¹ | ✅ | ❌ |
| Create/update/delete **accounts** (any user) | ✅ | ❌ | ❌ |
| Set any user's **tab permissions** | ✅ | ❌ (only own employees) | ❌ |
| View **login logs** | ✅ | ❌ | ❌ |
| View **user analytics** | ✅ | ❌ | ❌ |
| List/terminate **any user's sessions** | ✅ | ❌ | ❌ |
| Upload/download/delete **files** | ✅ | ✅ | ✅ |

¹ Admins operate the platform; they are not tenants and don't own employees/quotes.
The owner-scoped actions belong to account owners.

---

## 4. Tab permissions (feature flags)

Per-user feature gating via **`user_tab_permissions`** (`tab_key`, `is_enabled`).

- **Resolution rule** (mirror `src/lib/tabRegistry.ts::isTabAvailable`):
  1. **Admin → everything visible** (ignores rows).
  2. Else if a row exists for `tab_key` → use `is_enabled`.
  3. Else → default: **primary tabs ON**, secondary tabs **OFF** (the `DEFAULT_ON_KEYS` set).
- **Default tab:** stored as a special row `default_tab:<key>` with `is_enabled=true`
  (`getDefaultTabKey`).
- **Employee inheritance:** on `create_employee`, copy the owner's tab-permission
  rows to the new employee (see `manage-users` `handleCreateEmployee`).
- **Tab catalog:** the source of truth is `src/lib/tabRegistry.ts` +
  `src/components/AppTabs.tsx` (primary, secondary, box-template, montage, admin, guide groups).
  The backend treats `tab_key` as an **opaque string** — it stores/returns flags and
  never hard-codes the catalog (so adding a calculator needs no backend change).

### Who may edit which tab flags
| Editor | Target | Endpoint origin |
|---|---|---|
| Admin | any user | `get_tab_permissions` / `update_tab_permissions` |
| Owner | own employees only | `get_employee_tab_permissions` / `update_employee_tab_permissions` (verifies `parent_user_id = owner`) |

---

## 5. Authorization rules the backend MUST enforce

1. **Session identity is the JWT subject** — never trust a `user_id` in the body for
   "own" resources. `save_settings`/`load_settings` must assert `target == caller`.
2. **Owner→employee ownership check** on every employee action: the target row must
   have `parent_user_id = caller.id` (as in `handleUpdateEmployee` etc.). Otherwise `403`.
3. **Quote access = family membership.** update/delete/read allowed iff the quote's
   `user_id ∈ family_ids(caller)`; with the employee visibility nuances in §3.
4. **Admin-only endpoints** require `role(caller) == admin` via Policy (replacing the
   old per-request `admin_username`/`admin_password`).
5. **Employee cap** enforced on create: `count(employees) < max_employees` else `400`
   with the Arabic message `وصلت للحد الأقصى من الموظفين (N)`.
6. **Device cap** enforced on login (see auth spec) using `user_sessions` count.
7. **Active + not expired** required to authenticate (`is_active`, `expires_at`).

---

## 6. Laravel mapping (implementation note)

- Represent role via a `role()` accessor on `AppUser` (computed as §1) — do **not**
  add DB role columns.
- Policies: `UserPolicy` (admin), `EmployeePolicy` (owner→employee), `QuotePolicy`
  (family), `SettingPolicy` (self), `TabPermissionPolicy` (admin any / owner own-employee).
- Middleware `role:admin` on admin route group; `EnsureSessionActive` (jti allow-list)
  on all authenticated routes.
- Keep Arabic denial messages identical (e.g. `غير مصرح`, `غير مصرح - فقط المستخدم الرئيسي`).
