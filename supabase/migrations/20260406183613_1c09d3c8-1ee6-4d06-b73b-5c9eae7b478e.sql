
CREATE POLICY "Allow public read access on montage-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'montage-files');

CREATE POLICY "Allow public upload to montage-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'montage-files');

CREATE POLICY "Allow public update on montage-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'montage-files');

CREATE POLICY "Allow public delete on montage-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'montage-files');
