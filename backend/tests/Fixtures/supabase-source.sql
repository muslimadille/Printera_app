-- ---------------------------------------------------------------------------
-- The Supabase schema, as the production source actually stands today.
--
-- Transcribed from supabase/migrations/*.sql with every later ALTER folded in, so
-- the column ORDER, the types and the nullability all match what the migration
-- command will read from. That fidelity is the whole point: the Laravel schema is
-- MySQL-shaped (varchar(191), datetime, json) while this one is Postgres-shaped
-- (text, timestamptz, jsonb), and the copy has to cross that gap. A fixture built
-- from Laravel's own migrations would prove nothing about it.
--
-- Deliberately NOT included: RLS policies, triggers, the storage schema, and the
-- indexes that only serve query performance. None of them affect a read-only copy.
--
-- Loaded by Tests\Concerns\SeedsSupabaseSource. Under SQLite that trait rewrites
-- the Postgres-only spellings; the cross-engine assertions skip themselves there.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS activity_events;
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS saved_quotes;
DROP TABLE IF EXISTS user_tab_permissions;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS app_users;

-- 20260405115947 + the three later ALTERs (max_devices, parent_user_id/max_employees,
-- employees_can_view_quotes). Note the column order: added columns land at the end,
-- so `updated_at` sits in the middle. The copy matches on NAME, never on position.
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_admin boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  max_devices integer NOT NULL DEFAULT 2,
  parent_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE DEFAULT NULL,
  max_employees integer NOT NULL DEFAULT 0,
  employees_can_view_quotes boolean NOT NULL DEFAULT false
);

-- 20260405204504 + 20260425065039 (device_id). NOT migrated — its tokens are opaque
-- Supabase strings, not JWTs. Present here so the "it is skipped" test has something
-- real to skip.
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_info text,
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  device_id text
);

CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, setting_key)
);

CREATE TABLE user_tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tab_key)
);

CREATE TABLE saved_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  quote_number text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'calculator',
  quote_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  username text NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

-- 20260501201402. No foreign key on user_id — history outlives the user it names.
-- The Laravel schema matches, so a deleted user's events copy across fine.
CREATE TABLE session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  session_token text,
  device_id text,
  device_info text,
  ip_address text,
  event_type text NOT NULL CHECK (event_type IN ('login','logout','heartbeat','auto_logout')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- 20260502083814. Also unconstrained on user_id.
CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  session_token text,
  tab_key text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
