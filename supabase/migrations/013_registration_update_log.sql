-- Registration update log for tracking guest changes after initial registration
CREATE TABLE registration_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registration(id) ON DELETE CASCADE,
  changed_by text NOT NULL,
  change_type text NOT NULL,
  summary text,
  previous_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reg_update_log_reg ON registration_update_log(registration_id);

-- RLS policies
ALTER TABLE registration_update_log ENABLE ROW LEVEL SECURITY;

-- Guests can read logs for their own registrations
CREATE POLICY "Guests can view own registration logs"
  ON registration_update_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM registration r
      JOIN guest g ON g.id = r.guest_id
      WHERE r.id = registration_update_log.registration_id
        AND g.auth_user_id = auth.uid()
    )
  );

-- Hosts can read logs for registrations on their properties
CREATE POLICY "Hosts can view property registration logs"
  ON registration_update_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM registration r
      JOIN property p ON p.id = r.property_id
      JOIN host h ON h.id = p.host_id
      WHERE r.id = registration_update_log.registration_id
        AND h.auth_user_id = auth.uid()
    )
  );
