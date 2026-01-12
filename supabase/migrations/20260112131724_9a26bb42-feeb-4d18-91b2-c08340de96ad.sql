-- Add UPDATE policy for teachers to upload updated SBA files
CREATE POLICY "Teachers can update their class SBA storage files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'sba-files' 
  AND EXISTS (
    SELECT 1
    FROM teacher_profiles tp
    JOIN sba_files sf ON sf.class_id = tp.class_id
    WHERE tp.user_id = auth.uid()
    AND sf.file_path = objects.name
  )
);

-- Add INSERT policy for teachers in case they need to re-upload
CREATE POLICY "Teachers can upload to their class SBA storage files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'sba-files'
  AND EXISTS (
    SELECT 1
    FROM teacher_profiles tp
    JOIN sba_files sf ON sf.class_id = tp.class_id
    WHERE tp.user_id = auth.uid()
    AND sf.file_path = name
  )
);