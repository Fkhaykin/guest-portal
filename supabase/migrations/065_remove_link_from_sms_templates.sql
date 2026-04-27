-- Remove {{link}} URLs from all SMS templates — Textbelt blocks URLs on unverified accounts
UPDATE host
SET notification_settings = jsonb_build_object(
  'cleaner_new_booking', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_new_booking'->>'enabled')::boolean,
    'message', 'New booking — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}, {{num_guests}} guest(s){{extras_text}}{{notes_text}}'
  ),
  'cleaner_cancellation', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_cancellation'->>'enabled')::boolean,
    'message', 'Booking cancelled — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}.'
  ),
  'cleaner_checkout', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_checkout'->>'enabled')::boolean,
    'message', 'Guest checked out — {{property}}, {{address}}: {{guest}}. Ready for cleaning.'
  ),
  'cleaner_pet_added', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_pet_added'->>'enabled')::boolean,
    'message', 'Pet(s) registered — {{property}}, {{address}}: {{guest}}, check-in {{check_in}}. {{num_pets}} pet(s) total.'
  ),
  'cleaner_early_checkin', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_early_checkin'->>'enabled')::boolean,
    'message', 'Early check-in purchased — {{property}}, {{address}}: {{guest}}, arriving {{check_in}} at 1pm.'
  ),
  'cleaner_late_checkout', jsonb_build_object(
    'enabled', (notification_settings->'cleaner_late_checkout'->>'enabled')::boolean,
    'message', 'Late check-out purchased — {{property}}, {{address}}: {{guest}}, departing {{check_out}} at 2pm.'
  )
);

ALTER TABLE host ALTER COLUMN notification_settings SET DEFAULT '{
  "cleaner_new_booking": {
    "enabled": true,
    "message": "New booking — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}, {{num_guests}} guest(s){{extras_text}}{{notes_text}}"
  },
  "cleaner_cancellation": {
    "enabled": true,
    "message": "Booking cancelled — {{property}}, {{address}}: {{guest}}, {{check_in}}–{{check_out}}."
  },
  "cleaner_checkout": {
    "enabled": false,
    "message": "Guest checked out — {{property}}, {{address}}: {{guest}}. Ready for cleaning."
  },
  "cleaner_pet_added": {
    "enabled": true,
    "message": "Pet(s) registered — {{property}}, {{address}}: {{guest}}, check-in {{check_in}}. {{num_pets}} pet(s) total."
  },
  "cleaner_early_checkin": {
    "enabled": true,
    "message": "Early check-in purchased — {{property}}, {{address}}: {{guest}}, arriving {{check_in}} at 1pm."
  },
  "cleaner_late_checkout": {
    "enabled": true,
    "message": "Late check-out purchased — {{property}}, {{address}}: {{guest}}, departing {{check_out}} at 2pm."
  }
}'::jsonb;
