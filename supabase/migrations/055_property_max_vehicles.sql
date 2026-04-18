-- Add max_vehicles capacity to properties
ALTER TABLE property ADD COLUMN max_vehicles integer NOT NULL DEFAULT 6;
