-- Remove dangerous public write/delete policies
DROP POLICY IF EXISTS "Allow public upload to montage-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on montage-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete on montage-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access on montage-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view montage files" ON storage.objects;

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'montage-files';