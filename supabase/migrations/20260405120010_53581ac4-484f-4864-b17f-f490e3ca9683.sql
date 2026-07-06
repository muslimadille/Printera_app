
-- Drop permissive write policies
DROP POLICY IF EXISTS "Anyone can insert app_users" ON public.app_users;
DROP POLICY IF EXISTS "Anyone can update app_users" ON public.app_users;
DROP POLICY IF EXISTS "Anyone can delete app_users" ON public.app_users;
