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
- **JSON:** `jsonb` (Postgres) / `json` (MySQL). Keys/shapes are owned by the
  frontend — store opaque, don't reshape. **No DB-level default** — see §7.
- **FKs:** `ON DELETE CASCADE` where the current schema uses it (all child tables).
- **No client access.** There is no RLS equivalent needed: the client never reaches
  the DB in Laravel; all access is server-side. (The old deny-all RLS policies do
  not need porting.)
- **Strings:** every column that takes part in a UNIQUE or an INDEX is `VARCHAR`, never
  `TEXT` — see §7. Free text that is never indexed (`device_info`) stays `TEXT`.

> ⚠ **The schema is NOT "identical either way" across engines.** MySQL is the production
> target and it rejects several things PostgreSQL and SQLite accept. §7 lists every
> divergence and how it is resolved. Read it before editing a migration.

---

## 2. Tables

### 2.1 `app_users` — identities & tenancy
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `username` | varchar(191), **unique**, not null | login id. **Case-SENSITIVE** on every engine (§7) |
| `password_hash` | varchar(255), not null | bcrypt; legacy 64-char SHA-256 hex auto-migrates on login |
| `is_active` | bool, not null, default `true` | |
| `is_admin` | bool, not null, default `false` | |
| `expires_at` | **datetime**, nullable | subscription end. NOT timestamptz — MySQL TIMESTAMP ends 2038 (§7) |
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
| `session_token` | varchar(191), **unique**, not null | today: opaque token. Rebuild: store the JWT **`jti`** here (still unique) |
| `device_id` | varchar(191), nullable | stable per-browser id (client-generated) |
| `device_info` | text, nullable | UA/string |
| `ip_address` | text, nullable | |
| `last_active_at` | timestamptz, not null, default now | heartbeat |
| `created_at` | timestamptz, not null, default now | |

Indexes: `unique(session_token)`, `unique(user_id, device_id)` — a PLAIN unique, portable
to every engine; NULLs are distinct in SQL so many null-device rows per user are still
allowed (§7) — and `index(last_active_at)`.

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
| `event_type` | varchar(32), not null, **CHECK in (`login`,`logout`,`heartbeat`,`auto_logout`)** | enforced on PostgreSQL and MySQL 8.0.16+ |
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
| `tab_key` | varchar(191), nullable (≤64 chars enforced in app) | |
| `action` | varchar(64), not null | allow-list (§ below) |
| `details` | json, **nullable, no DB default** | opaque; default `{}` supplied by `ActivityEvent::$attributes` (§7) |
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
| `quote_data` | json, **nullable, no DB default** | opaque; frontend owns shape (may include `attachmentUrl`); default `{}` from `SavedQuote::$attributes` (§7) |
| `created_at` / `updated_at` | timestamptz, not null | |

Indexes: `index(user_id)`, `index(created_at DESC)`.

### 2.7 `user_settings` — cloud settings
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `setting_key` | varchar(191), not null | case-SENSITIVE (§7). e.g. `paperTypes`, `priceSettings`, `finishingItems`, `profitMargins` |
| `setting_value` | json, **nullable, no DB default** | opaque; default `{}` from `UserSetting::$attributes` (§7) |
| `created_at` / `updated_at` | timestamptz, not null | |

Constraint: **`unique(user_id, setting_key)`** (upsert target).

### 2.8 `user_tab_permissions` — per-user feature flags
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid, not null, FK→`app_users` CASCADE | |
| `tab_key` | varchar(191), not null | opaque; case-SENSITIVE (§7); incl. special `default_tab:<key>` |
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

---

## 7. Engine differences — MySQL is the production target (BE-060)

The schema was originally written against PostgreSQL and verified on SQLite (tests) and
Postgres (BE-019). **Production runs MySQL 8**, and `php artisan migrate` failed outright
there. The first error was:

```
SQLSTATE[42000]: 1170 BLOB/TEXT column 'username' used in key specification
without a key length
```

Everything below is now portable across SQLite, PostgreSQL and MySQL 8.0.16+. The
behavioural contracts are asserted on all three by `tests/Feature/SchemaSemanticsTest.php`;
the per-engine spellings by `PostgresSchemaTest` and `MysqlSchemaTest`.

### 7.1 Indexed strings are VARCHAR, never TEXT

MySQL cannot index a `TEXT`/`BLOB` column without a prefix length. Every column in a
`UNIQUE` or `INDEX` is therefore `VARCHAR`:

| Column | Type | |
|---|---|---|
| `app_users.username` | `varchar(191)` | unique |
| `app_users.password_hash` | `varchar(255)` | not indexed, but bounded |
| `user_sessions.session_token` | `varchar(191)` | unique |
| `user_sessions.device_id` | `varchar(191)` | composite unique |
| `user_settings.setting_key` | `varchar(191)` | composite unique |
| `user_tab_permissions.tab_key` | `varchar(191)` | composite unique |
| `activity_events.tab_key` / `.session_token` | `varchar(191)` | indexed |
| `activity_events.action` | `varchar(64)` | 12 allowed values, longest 18 chars |
| `session_events.session_token` / `.device_id` | `varchar(191)` | indexed |
| `session_events.event_type` | `varchar(32)` | CHECK-constrained |
| `username` on `login_logs` / `session_events` / `activity_events` | `varchar(191)` | denormalised |
| `saved_quotes.title` / `.customer_name` / `.quote_number` / `.source_type` | `varchar(255)` | short user-visible fields |
| `ip_address` (all tables) | `varchar(45)` | IPv6 + `::ffff:` prefix |
| `device_info` (all tables) | `text` | free text, never indexed — stays TEXT |

Composite-unique width: `char(36)` + `varchar(191)` under utf8mb4 = **908 bytes**, inside
InnoDB's 3072-byte limit on MySQL 8 (DYNAMIC row format).

> ⚠ **Behaviour change:** `tab_key` and `setting_key` are now capped at 191 characters
> where they were previously unbounded text. Real keys are far shorter (the longest is
> `default_tab:carryinghandlebox`, 29 chars). MySQL runs in strict mode, so an over-long
> key is **rejected, never truncated** — a truncated opaque key would be a *different* key
> and would grant the wrong tab.

### 7.2 JSON columns have no DB-level default

MySQL rejects a literal default on a JSON column outright:
*"BLOB, TEXT, GEOMETRY or JSON column can't have a default value"*.

`quote_data`, `setting_value` and `details` are therefore **nullable with no DB default**.
The `{}` default moved to the models (`$attributes`), and `App\Casts\JsonObject` reads a
NULL back as `[]` so a row written by the query builder — which bypasses `$attributes` —
is indistinguishable from an empty one to every reader.

### 7.3 One plain unique instead of a partial index

`user_sessions` used a PostgreSQL/SQLite partial index
(`unique(user_id, device_id) WHERE device_id IS NOT NULL`) that MySQL cannot express,
leaving the production engine with **no constraint at all**.

It is now a plain `unique(user_id, device_id)`. The `WHERE` clause was never load-bearing:
SQL treats NULLs as distinct in a unique index, so a plain unique already permits many
null-device rows per user while rejecting a duplicate non-null pair. All three engines
agree, and the driver branch in the migration is gone.

### 7.4 `event_type` CHECK

Added on **PostgreSQL and MySQL 8.0.16+** — the first MySQL release that *enforces* CHECK
rather than parsing and ignoring it. SQLite is skipped only because Laravel cannot ALTER a
table to add one; the application writes those four values and nothing else.

### 7.5 Charset & collation

All tables are `utf8mb4` (Arabic titles, customer names, tab labels).

Collation is deliberately **split** — see `App\Support\SchemaCollation`:

- **Identity columns** — `username`, `session_token`, `device_id`, `setting_key`,
  `tab_key` — use `utf8mb4_0900_as_cs` (case- and accent-**sensitive**).
  MySQL's default `utf8mb4_unicode_ci` is case-INsensitive, which would make `Admin` and
  `admin` the same account, and would collapse `('user','itemcost')` and
  `('user','ItemCost')` in the composite uniques while PostgreSQL kept them apart.
  Case-sensitive usernames are a **locked product decision** matching Supabase.
- **Free text** — titles, customer names — keeps the default case-insensitive collation,
  which is what a human searching quotes expects.

To make usernames case-insensitive later, change the one constant in `SchemaCollation` —
but note it also governs the opaque keys, so split the two uses first.

### 7.6 Timestamps and 2038

`expires_at` is **`datetime`**, not `timestamptz`. On MySQL `TIMESTAMP` tops out at
**2038-01-19**, and this column holds subscription end dates — a long subscription sold
today lands past it. `DATETIME` has no such ceiling. Stored UTC like everything else.

The remaining timestamp columns (`created_at`, `updated_at`, `last_active_at`,
`occurred_at`, `logged_in_at`) hold "now"-ish values and stay `timestamptz`; revisit before
2038. None carries `ON UPDATE CURRENT_TIMESTAMP` — MySQL's legacy behaviour can attach that
to the first TIMESTAMP column in a table, which would quietly rewrite the append-only audit
rows analytics reads. `MysqlSchemaTest` asserts its absence on every one.

### 7.7 `UPDATE` returns matched rows, not changed rows

MySQL counts only rows whose values actually differ, so an UPDATE setting a column to the
value it already holds returns `0`; PostgreSQL and SQLite report matched rows either way.
That was observable in the API — `POST /quotes/transfer` returns
`transferred: <affected rows>`, so transferring a quote to its current owner answered `1`
on Postgres and `0` on MySQL for the same request.

`config/database.php` sets `PDO::MYSQL_ATTR_FOUND_ROWS => true` on the mysql connection so
every `->update()` return value is engine-independent.

### 7.8 Test lanes

| Lane | Config | Purpose |
|---|---|---|
| SQLite | `phpunit.xml` (default) | fast; `php artisan test` |
| PostgreSQL | `phpunit.pgsql.xml` | jsonb typing, key reordering, CHECK introspection |
| **MySQL** | `phpunit.mysql.xml` | **the production engine** — VARCHAR widths, collations, no-ON-UPDATE, JSON defaults |

Run all three before touching a migration. The MySQL lane is what caught §7.1, §7.2 and
§7.7; none of them was visible on the other two.
