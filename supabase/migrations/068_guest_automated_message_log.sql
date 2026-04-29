CREATE TABLE guest_automated_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registration(id) ON DELETE CASCADE,
  message_type text NOT NULL, -- 'booking_confirmation' | 'pre_arrival' | 'day_of_checkin' | 'post_checkout'
  channel text NOT NULL,      -- 'lodgify' | 'email'
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX guest_automated_message_log_dedup
  ON guest_automated_message_log (registration_id, message_type);
