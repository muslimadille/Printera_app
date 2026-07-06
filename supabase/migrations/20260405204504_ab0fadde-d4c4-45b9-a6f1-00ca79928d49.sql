
-- User settings table (stores paper types, price settings, finishing items per user)
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no direct client access (managed via service role in edge functions)

-- User tab permissions table
CREATE TABLE public.user_tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tab_key)
);

ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;

-- User sessions table for device tracking
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  device_info text,
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Add max_devices column to app_users
ALTER TABLE public.app_users ADD COLUMN max_devices integer NOT NULL DEFAULT 2;

-- Trigger for updated_at on user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
