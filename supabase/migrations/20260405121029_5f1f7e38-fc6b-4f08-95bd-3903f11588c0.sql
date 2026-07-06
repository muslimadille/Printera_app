
CREATE TABLE public.login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE NOT NULL,
  username text NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read login_logs" ON public.login_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role can insert login_logs" ON public.login_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
