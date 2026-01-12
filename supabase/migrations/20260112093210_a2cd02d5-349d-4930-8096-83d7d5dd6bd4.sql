-- Allow users to insert their own teacher role during signup
CREATE POLICY "Users can insert their own teacher role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'teacher'::app_role);