-- Store sent email metadata on delivery records
ALTER TABLE delivery_rideshare
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS email_recipients text[];
