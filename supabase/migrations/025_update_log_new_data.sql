-- Add new_data column to track what changed TO (not just what changed FROM)
ALTER TABLE registration_update_log ADD COLUMN new_data jsonb;
