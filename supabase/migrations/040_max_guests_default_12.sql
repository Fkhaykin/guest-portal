-- Change max_guests default from 16 to 12
ALTER TABLE property ALTER COLUMN max_guests SET DEFAULT 12;

-- Set Bianca house occupancy limit to 8
UPDATE property SET max_guests = 8 WHERE name ILIKE '%bianca%';
