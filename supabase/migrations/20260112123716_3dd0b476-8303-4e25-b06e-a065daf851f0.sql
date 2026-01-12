-- Drop the global unique constraint on class name
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_name_key;

-- Add a composite unique constraint on (name, school_id) to allow same names across schools
ALTER TABLE public.classes ADD CONSTRAINT classes_name_school_unique UNIQUE (name, school_id);