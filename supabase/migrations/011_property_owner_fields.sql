-- Add owner/HOA fields to property table for PEPOA registration PDF
ALTER TABLE property ADD COLUMN lot_section text;
ALTER TABLE property ADD COLUMN owner_name text;
ALTER TABLE property ADD COLUMN owner_mailing_address text;
ALTER TABLE property ADD COLUMN owner_phone text;
ALTER TABLE property ADD COLUMN owner_email text;
ALTER TABLE property ADD COLUMN hoa_submission_email text;
