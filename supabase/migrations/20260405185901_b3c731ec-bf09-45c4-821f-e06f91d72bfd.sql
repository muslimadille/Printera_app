
-- 1. Drop permissive SELECT policy on app_users (edge function uses service role key, bypasses RLS)
DROP POLICY IF EXISTS "Anyone can read app_users for login" ON public.app_users;

-- 2. Drop permissive SELECT policy on login_logs
DROP POLICY IF EXISTS "Anyone can read login_logs" ON public.login_logs;

-- 3. Fix storage policies for montage-files bucket
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can upload montage files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view montage files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete montage files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create restricted policies: only authenticated users
CREATE POLICY "Authenticated users can upload montage files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'montage-files');

CREATE POLICY "Authenticated users can view montage files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'montage-files');

CREATE POLICY "Authenticated users can delete own montage files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'montage-files');

-- Also allow anon to view (public bucket for sharing)
CREATE POLICY "Anyone can view montage files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'montage-files');

-- 4. Enable pgcrypto extension for bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;
