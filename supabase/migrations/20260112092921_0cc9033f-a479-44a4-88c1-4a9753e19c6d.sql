-- Create storage bucket for Excel files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sba-files', 'sba-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sba-files bucket
CREATE POLICY "Admins can upload SBA files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'sba-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update SBA storage files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'sba-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete SBA storage files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'sba-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all SBA storage files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'sba-files' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view their class SBA storage files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'sba-files' 
  AND EXISTS (
    SELECT 1 FROM teacher_profiles tp
    JOIN sba_files sf ON sf.class_id = tp.class_id
    WHERE tp.user_id = auth.uid()
    AND sf.file_path = name
  )
);

-- Allow admins to manage sba_files table records
CREATE POLICY "Admins can insert SBA file records"
ON public.sba_files
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all SBA file records"
ON public.sba_files
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete SBA file records"
ON public.sba_files
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all SBA file records"
ON public.sba_files
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all classes for management
CREATE POLICY "Admins can view classes"
ON public.classes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all teacher profiles for management
CREATE POLICY "Admins can view teacher profiles"
ON public.teacher_profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update teacher profiles (for class assignment)
CREATE POLICY "Admins can update teacher profiles"
ON public.teacher_profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));