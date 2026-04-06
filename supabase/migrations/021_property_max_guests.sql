-- Add max_guests capacity to properties
ALTER TABLE property ADD COLUMN max_guests integer NOT NULL DEFAULT 16;
