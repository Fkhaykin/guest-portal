-- Move owner signature to property level (different owners per property)
ALTER TABLE property ADD COLUMN owner_signature_url text;
