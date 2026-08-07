# 02 — Database Schema Specification (Laravel migrations)

> The Laravel schema **reproduces the current Supabase Postgres schema** table- and
> column-for-column so data migration is a straight copy. Derived from
> `supabase/migrations/*.sql` and `src/integrations/supabase/types.ts`.
> **Do not rename tables/columns.** IDs are UUID (`gen_random_uuid()` today) — keep UUID PKs.

---

## 1. Conventions

- **PK:** `uuid` (`id`), default UUID. In Laravel: `$table->uuid('id')->primary()` and
  models with `HasUuids` (keep incrementing OFF).
- **Timestamps:** `timestamptz` (`created_at`, `updated_at`). Keep names as-is; some
  tables only have `created_at` / `occurred_at` — match the current set exactly.
- **JSON:** `jsonb` (Postgres). On MySQL use `json`. Keys/shapes are owned by the
  frontend — store opaque, don't reshape.
- **FKs:** `ON DELETE CASCADE` where the current schema uses it (all child tables).
- **No client access.** There is no RLS equivalent needed: the client never reaches
  the DB in Laravel; all access is server-side. (The old deny-all RLS policies do
  not need porting.)

---

## 2. Tables

### 2.1 `app_users` — identities & tenancy
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `username` | text, **unique**, not null | login id |
| `password_hash` | text, not null | bcrypt; legacy 64-char SHA-256 hex auto-migrates on login |
| `is_active` | bool, not null, default `true` | |
| `is_admin` | bool, not null, default `false` | |
| `expires_at` | timestamptz, nullable | subscription end |
| `max_devices` | int, not null, default `2` | concurrent sessions |
| `max_employees` | int, not null, default `0` | owner's employee cap |
| `parent_user_id` | uuid, nullable, FK→`app_users(id)` ON DELETE CASCADE | tenancy link |
| `employees_can_view_quotes` | bool, not null, default `false` | |
| `created_at` / `updated_at` | timestamptz, not null, default now | `updated_at` via trigger today; use Eloquent timestamps |

Indexes: `unique(username)`, `index(parent_user_id)`.

> **Seeder:** create exactly one admin from env (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).
> Do **NOT** reuse old demo hashes/passwords (`1234`, `M123123`, the `owner` seed).

### 2.2 `user_sessions` — active device sessions (JWT allow-list)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `session_token` | text, **unique**, not null | today: opaque token. Rebuild: store the JWT **`jti`** here (still unique) |
| `device_id` | text, nullable | stable per-browser id (client-generated) |
| `device_info` | text, nullable | UA/string |
| `ip_address` | text, nullable | |
| `last_active_at` | timestamptz, not null, default now | heartbeat |
| `created_at` | timestamptz, not null, default now | |

Indexes: `unique(session_token)`, `unique(user_id, device_id) WHERE device_id IS NOT NULL`,
`index(last_active_at)`.

> **Rebuild semantics:** a row here = a live token. Middleware checks the JWT `jti`
> exists here (allow-list) → revocation = delete row. Device cap = row count per user.

### 2.3 `session_events` — session audit
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null | (no FK in current schema — keep as-is or add nullable FK) |
| `username` | text, not null | denormalized |
| `session_token` | text, nullable | |
| `device_id` / `device_info` / `ip_address` | text, nullable | |
| `event_type` | text, not null, **CHECK in (`login`,`logout`,`heartbeat`,`auto_logout`)** | |
| `occurred_at` | timestamptz, not null, default now | |

Indexes: `index(user_id)`, `index(user_id, occurred_at DESC)`, `index(session_token)`.
Retention: prune > 30 days (was a trigger; use a scheduled job — see §4).

### 2.4 `login_logs` — login audit
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `username` | text, not null | |
| `logged_in_at` | timestamptz, not null, default now | |
| `ip_address` | text, nullable | |

### 2.5 `activity_events` — in-app actions
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null | |
| `username` | text, not null | |
| `session_token` | text, nullable | |
| `tab_key` | text, nullable (≤64 chars enforced in app) | |
| `action` | text, not null | allow-list (§ below) |
| `details` | jsonb, not null, default `{}` | |
| `occurred_at` | timestamptz, not null, default now | |

Indexes: `index(user_id, occurred_at DESC)`, `index(tab_key)`, `index(session_token)`, `index(occurred_at)`.
**Allowed `action` values:** `tab_open, calculate, save_quote, update_quote,
delete_quote, export_pdf, export_excel, import_excel, settings_change, voice_input,
upload_attachment, input_change`. Reject others. Retention: prune > 30 days (§4).

### 2.6 `saved_quotes` — persisted quotes
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | owner of the quote |
| `title` | text, not null, default `''` | |
| `customer_name` | text, not null, default `''` | |
| `quote_number` | text, not null, default `''` | |
| `source_type` | text, not null, default `'calculator'` | which calculator produced it (maps to a tab) |
| `quote_data` | jsonb, not null, default `{}` | opaque; frontend owns shape (may include `attachmentUrl`) |
| `created_at` / `updated_at` | timestamptz, not null | |

Indexes: `index(user_id)`, `index(created_at DESC)`.

### 2.7 `user_settings` — cloud settings
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `setting_key` | text, not null | e.g. `paperTypes`, `priceSettings`, `finishingItems`, `profitMargins` |
| `setting_value` | jsonb, not null, default `{}` | opaque |
| `created_at` / `updated_at` | timestamptz, not null | |

Constraint: **`unique(user_id, setting_key)`** (upsert target).

### 2.8 `user_tab_permissions` — per-user feature flags
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `tab_key` | text, not null | opaque; incl. special `default_tab:<key>` |
| `is_enabled` | bool, not null, default `true` | |
| `created_at` | timestamptz, not null | |

Constraint: **`unique(user_id, tab_key)`** (upsert target).

---

## 3. Relationships (ER summary)

```
app_users 1───∞ user_sessions
app_users 1───∞ login_logs
app_users 1───∞ saved_quotes
app_users 1───∞ user_settings         (unique user_id+setting_key)
app_users 1───∞ user_tab_permissions  (unique user_id+tab_key)
app_users 1───∞ app_users             (parent_user_id self-FK = tenancy)
session_events / activity_events       (loose: user_id, no hard FK today)
```

---

## 4. Retention jobs (replace SQL triggers)

The current schema prunes `activity_events` and `session_events` older than 30 days
via `AFTER INSERT` triggers firing ~1% of the time. In Laravel, replace with a
**scheduled command** (`app:prune-events`, daily) deleting rows `occurred_at < now()-30d`.
Keep the 30-day window.

---

## 5. Storage (not a DB table)

`montage-files` bucket → a Laravel **disk** (`montage` disk; local dev, S3 prod).
Object key convention preserved: `"{user_id}/{timestamp}-{sanitized_filename}"`.
Access only via **temporary signed URLs**; no public listing.

---

## 6. Data migration mapping (Phase 7)

Straight copy, preserving `id`s and all columns:

| Supabase table | → Laravel table | Transform |
|---|---|---|
| all 8 tables | same names | none (identity copy) |
| `user_sessions.session_token` | same | existing opaque tokens become invalid at cutover; users re-login → new JWT `jti` written. Optionally truncate live sessions at go-live |
| storage `montage-files/*` | `montage` disk | copy objects, keep keys; re-sign URLs in `saved_quotes.quote_data` if host changes |

Verification: row counts equal per table; spot-check 3–5 users across roles can log
in and see identical settings + quotes.
