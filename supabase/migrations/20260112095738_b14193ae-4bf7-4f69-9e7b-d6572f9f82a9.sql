-- Create schools table with branding
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Add school_id to user_roles table FIRST
ALTER TABLE public.user_roles ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to classes table
ALTER TABLE public.classes ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to teacher_profiles table
ALTER TABLE public.teacher_profiles ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to sba_files table
ALTER TABLE public.sba_files ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- NOW create policies that reference school_id

-- Super admins can do everything with schools
CREATE POLICY "Super admins can manage schools"
ON public.schools
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Admins can view their own school
CREATE POLICY "Admins can view their school"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = schools.id
  )
);

-- Teachers can view their school
CREATE POLICY "Teachers can view their school"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.user_id = auth.uid()
    AND tp.school_id = schools.id
  )
);

-- Update RLS policies for classes to be school-scoped
DROP POLICY IF EXISTS "Admins can view classes" ON public.classes;
DROP POLICY IF EXISTS "Classes are viewable by authenticated users" ON public.classes;
DROP POLICY IF EXISTS "Public can view classes for signup" ON public.classes;

CREATE POLICY "Super admins can manage all classes"
ON public.classes
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage their school classes"
ON public.classes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = classes.school_id
  )
);

CREATE POLICY "Teachers can view their school classes"
ON public.classes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.user_id = auth.uid()
    AND tp.school_id = classes.school_id
  )
);

-- Public can view classes by school slug (for signup)
CREATE POLICY "Public can view classes for signup by school"
ON public.classes
FOR SELECT
USING (true);

-- Update teacher_profiles RLS to be school-scoped
DROP POLICY IF EXISTS "Admins can update teacher profiles" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Admins can view teacher profiles" ON public.teacher_profiles;

CREATE POLICY "Super admins can manage all teacher profiles"
ON public.teacher_profiles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view their school teacher profiles"
ON public.teacher_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = teacher_profiles.school_id
  )
);

CREATE POLICY "Admins can update their school teacher profiles"
ON public.teacher_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = teacher_profiles.school_id
  )
);

-- Update sba_files RLS to be school-scoped
DROP POLICY IF EXISTS "Admins can delete SBA file records" ON public.sba_files;
DROP POLICY IF EXISTS "Admins can insert SBA file records" ON public.sba_files;
DROP POLICY IF EXISTS "Admins can update all SBA file records" ON public.sba_files;
DROP POLICY IF EXISTS "Admins can view all SBA file records" ON public.sba_files;

CREATE POLICY "Super admins can manage all SBA files"
ON public.sba_files
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage their school SBA files"
ON public.sba_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = sba_files.school_id
  )
);

-- Update user_roles RLS
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Add trigger for schools updated_at
CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if super admin exists
CREATE OR REPLACE FUNCTION public.super_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'super_admin'
  )
$$;

-- Allow first super admin creation when none exists
CREATE POLICY "First super admin can be created when none exists"
ON public.user_roles
FOR INSERT
WITH CHECK (
  (role = 'super_admin' AND auth.uid() = user_id AND NOT super_admin_exists())
);

-- Admins can insert teacher roles for their school
CREATE POLICY "Admins can insert teacher roles for their school"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role = 'teacher' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.school_id = user_roles.school_id
  )
);