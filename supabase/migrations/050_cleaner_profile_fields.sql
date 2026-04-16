-- Add business profile fields to cleaner table
ALTER TABLE cleaner ADD COLUMN tax_id text;
ALTER TABLE cleaner ADD COLUMN address text;
ALTER TABLE cleaner ADD COLUMN payment_method text; -- e.g. "Zelle", "Check", "Venmo", bank details
