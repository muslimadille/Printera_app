
-- Deny-all client access on sensitive tables. Edge functions use service_role
-- (bypasses RLS) for all reads/writes. This matches the existing pattern on
-- app_users and user_settings.

CREATE POLICY "Deny all client access to activity_events"
ON public.activity_events AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access to login_logs"
ON public.login_logs AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access to saved_quotes"
ON public.saved_quotes AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access to session_events"
ON public.session_events AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access to user_sessions"
ON public.user_sessions AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access to user_tab_permissions"
ON public.user_tab_permissions AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

-- Storage: deny direct client access to montage-files. Files are served via
-- signed URLs created by edge functions using service_role.
CREATE POLICY "Deny client read on montage-files"
ON storage.objects AS RESTRICTIVE FOR SELECT
TO anon, authenticated USING (bucket_id <> 'montage-files');

CREATE POLICY "Deny client insert on montage-files"
ON storage.objects AS RESTRICTIVE FOR INSERT
TO anon, authenticated WITH CHECK (bucket_id <> 'montage-files');

CREATE POLICY "Deny client update on montage-files"
ON storage.objects AS RESTRICTIVE FOR UPDATE
TO anon, authenticated USING (bucket_id <> 'montage-files') WITH CHECK (bucket_id <> 'montage-files');

CREATE POLICY "Deny client delete on montage-files"
ON storage.objects AS RESTRICTIVE FOR DELETE
TO anon, authenticated USING (bucket_id <> 'montage-files');
