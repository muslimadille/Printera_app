-- Activity events: per-user actions inside calculators / tools.
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  session_token TEXT,
  tab_key TEXT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_time
  ON public.activity_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_tab
  ON public.activity_events (tab_key);
CREATE INDEX IF NOT EXISTS idx_activity_events_session
  ON public.activity_events (session_token);
CREATE INDEX IF NOT EXISTS idx_activity_events_time
  ON public.activity_events (occurred_at);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (used by Edge Functions) can access.

-- Lightweight cleanup: occasionally delete rows older than 30 days.
-- Runs ~1% of inserts to keep overhead negligible.
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.activity_events
    WHERE occurred_at < now() - interval '30 days';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_activity_events ON public.activity_events;
CREATE TRIGGER trg_cleanup_activity_events
AFTER INSERT ON public.activity_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_activity_events();

-- Also clean up old session_events on the same schedule.
CREATE OR REPLACE FUNCTION public.cleanup_old_session_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.session_events
    WHERE occurred_at < now() - interval '30 days';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_session_events ON public.session_events;
CREATE TRIGGER trg_cleanup_session_events
AFTER INSERT ON public.session_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_session_events();