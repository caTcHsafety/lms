-- Add iSpring support columns to module_versions
ALTER TABLE module_versions 
ADD COLUMN is_ispring BOOLEAN DEFAULT false,
ADD COLUMN ispring_r2_url TEXT,
ADD COLUMN ispring_zip_r2_key TEXT;
