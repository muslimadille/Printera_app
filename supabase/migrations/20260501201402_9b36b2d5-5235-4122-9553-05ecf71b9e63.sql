CREATE TABLE public.session_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  username text NOT NULL,
  session_token text,
  device_id text,
  device_info text,
  ip_address text,
  event_type text NOT NULL CHECK (event_type IN ('login','logout','heartbeat','auto_logout')),
  occurred_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_events_user_id ON public.session_events(user_id);
CREATE INDEX idx_session_events_user_time ON public.session_events(user_id, occurred_at DESC);
CREATE INDEX idx_session_events_session_token ON public.session_events(session_token);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (Edge Functions) can read/write, mirroring login_logs/user_sessions design.