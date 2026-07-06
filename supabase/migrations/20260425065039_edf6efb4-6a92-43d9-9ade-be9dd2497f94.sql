ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS device_id text;

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_device_unique
  ON public.user_sessions(user_id, device_id)
  WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_sessions_last_active_idx
  ON public.user_sessions(last_active_at);