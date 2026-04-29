-- registration_id is no longer required for admin-initiated deliveries
ALTER TABLE delivery_rideshare
  ALTER COLUMN registration_id DROP NOT NULL;
