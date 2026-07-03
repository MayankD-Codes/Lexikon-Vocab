-- Restrict avatars bucket SELECT so authenticated clients cannot list every file.
-- Public read of individual files still works via the public CDN URL (which bypasses RLS
-- for buckets flagged public); this only prevents enumerating other users' object keys.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view their own avatar objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);