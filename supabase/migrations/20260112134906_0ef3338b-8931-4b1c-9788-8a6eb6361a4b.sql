-- Fix teacher uploads to allow creating a new object under the /{class_id}/updated/ folder.
-- Existing policy required objects.name to equal sba_files.file_path, which blocks first-time teacher uploads.

DROP POLICY IF EXISTS "Teachers can upload to their class SBA storage files" ON storage.objects;

CREATE POLICY "Teachers can upload to their class SBA storage files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'sba-files'
  AND EXISTS (
    SELECT 1
    FROM public.teacher_profiles tp
    WHERE tp.user_id = auth.uid()
      AND tp.class_id IS NOT NULL
      AND objects.name LIKE ('%/' || tp.class_id::text || '/updated/%')
  )
);
