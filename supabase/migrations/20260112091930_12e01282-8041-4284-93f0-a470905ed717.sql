-- Allow authenticated users to insert their own teacher profile (for signup flow)
CREATE POLICY "Users can create their own profile"
ON public.teacher_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);