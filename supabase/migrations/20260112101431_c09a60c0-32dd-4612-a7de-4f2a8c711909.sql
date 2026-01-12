-- Allow public to view basic school info for the school finder
CREATE POLICY "Public can view schools for finder"
ON public.schools
FOR SELECT
USING (true);