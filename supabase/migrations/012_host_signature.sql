-- Add signature_url to host table for owner signature on PDFs
ALTER TABLE host ADD COLUMN signature_url text;
