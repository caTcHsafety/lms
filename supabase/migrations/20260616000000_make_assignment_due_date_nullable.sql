-- Make due_date nullable in assignments table to support saved templates
-- Saved templates don't need a due date until they're assigned to cohorts

ALTER TABLE assignments 
ALTER COLUMN due_date DROP NOT NULL;

-- Also make status column support 'Saved' if it doesn't already
-- First check if we need to alter the status type
DO $$ 
BEGIN
    -- If status is an enum, we might need to add 'Saved' to it
    -- If it's just text, this does nothing
    IF EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'assignment_status'
    ) THEN
        -- Add 'Saved' to enum if it doesn't exist
        ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'Saved';
    END IF;
END $$;

COMMENT ON COLUMN assignments.due_date IS 'Due date for the assignment. NULL for saved templates until assigned to cohorts.';
