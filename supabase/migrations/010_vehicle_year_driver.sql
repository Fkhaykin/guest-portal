-- Add year and driver_name to vehicle table for HOA registration form
ALTER TABLE vehicle ADD COLUMN year text;
ALTER TABLE vehicle ADD COLUMN driver_name text;
