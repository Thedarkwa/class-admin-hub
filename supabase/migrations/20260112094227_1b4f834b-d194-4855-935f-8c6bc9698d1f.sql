-- Allow anyone (including unauthenticated users) to view classes for signup
CREATE POLICY "Public can view classes for signup" 
ON public.classes 
FOR SELECT 
USING (true);