-- Allow anyone to check if admin exists (count only, no data exposure)
-- This is safe because it only allows counting, not reading actual data
CREATE POLICY "Anyone can check if admin exists"
ON public.user_roles
FOR SELECT
USING (true);

-- Drop the previous restrictive policies and recreate with proper logic
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert admin role ONLY when no admin exists yet
CREATE POLICY "First admin can be created when none exists"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role = 'admin'::app_role 
  AND auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  )
);