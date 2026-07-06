
INSERT INTO storage.buckets (id, name, public)
VALUES ('montage-files', 'montage-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload montage files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'montage-files');

CREATE POLICY "Anyone can view montage files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'montage-files');

CREATE POLICY "Anyone can delete montage files"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'montage-files');
