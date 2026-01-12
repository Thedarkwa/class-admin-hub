-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teacher profiles table
CREATE TABLE public.teacher_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SBA files table (managed by system owner)
CREATE TABLE public.sba_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE UNIQUE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  spreadsheet_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sba_files ENABLE ROW LEVEL SECURITY;

-- Classes are viewable by authenticated users
CREATE POLICY "Classes are viewable by authenticated users"
ON public.classes FOR SELECT
TO authenticated
USING (true);

-- Teachers can view their own profile
CREATE POLICY "Teachers can view their own profile"
ON public.teacher_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Teachers can update their own profile
CREATE POLICY "Teachers can update their own profile"
ON public.teacher_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Teachers can only view SBA files for their assigned class
CREATE POLICY "Teachers can view their class SBA file"
ON public.sba_files FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles
    WHERE teacher_profiles.user_id = auth.uid()
    AND teacher_profiles.class_id = sba_files.class_id
  )
);

-- Teachers can update SBA data for their assigned class only
CREATE POLICY "Teachers can update their class SBA file"
ON public.sba_files FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles
    WHERE teacher_profiles.user_id = auth.uid()
    AND teacher_profiles.class_id = sba_files.class_id
  )
);

-- Insert the 9 classes
INSERT INTO public.classes (name, display_order) VALUES
('Basic 1', 1),
('Basic 2', 2),
('Basic 3', 3),
('Basic 4', 4),
('Basic 5', 5),
('Basic 6', 6),
('Basic 7', 7),
('Basic 8', 8),
('Basic 9', 9);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_teacher_profiles_updated_at
BEFORE UPDATE ON public.teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sba_files_updated_at
BEFORE UPDATE ON public.sba_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();