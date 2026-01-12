-- Add version tracking to sba_files table
ALTER TABLE public.sba_files 
ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT 'original',
ADD COLUMN IF NOT EXISTS original_file_path TEXT,
ADD COLUMN IF NOT EXISTS original_file_name TEXT;

-- Add constraint to ensure version is either 'original' or 'updated'
ALTER TABLE public.sba_files 
ADD CONSTRAINT sba_files_version_check CHECK (version IN ('original', 'updated'));

-- Comment on new columns
COMMENT ON COLUMN public.sba_files.version IS 'Indicates if this is the original admin-uploaded file or teacher-updated version';
COMMENT ON COLUMN public.sba_files.original_file_path IS 'Path to the original file before teacher updates';
COMMENT ON COLUMN public.sba_files.original_file_name IS 'Name of the original file before teacher updates';