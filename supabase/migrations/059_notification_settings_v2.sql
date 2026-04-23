-- Add pet, early check-in, and late checkout notification events.
-- Also enrich the new_booking template to include pets, notes, and portal link.

-- Add new events to existing hosts (jsonb || merges without overwriting existing keys)
UPDATE host
SET notification_settings = notification_settings
  -- Update new_booking template to include full details + link
  || jsonb_build_object(
      'cleaner_new_booking', jsonb_build_object(
        'enabled', (notification_settings->'cleaner_new_booking'->>'enabled')::boolean,
        'message', 'New booking at {{property}}: {{guest}}, {{check_in}}–{{check_out}}, {{num_guests}} guest(s){{pets_text}}{{notes_text}}' || chr(10) || 'View: {{link}}'
      )
  )
  || '{
    "cleaner_pet_added": {
      "enabled": true,
      "message": "Pet(s) registered at {{property}}: {{guest}}, check-in {{check_in}}. {{num_pets}} pet(s) total. View: {{link}}"
    },
    "cleaner_early_checkin": {
      "enabled": true,
      "message": "Early check-in purchased at {{property}}: {{guest}}, arriving {{check_in}} at 1pm. View: {{link}}"
    },
    "cleaner_late_checkout": {
      "enabled": true,
      "message": "Late check-out purchased at {{property}}: {{guest}}, departing {{check_out}} at 2pm. View: {{link}}"
    }
  }'::jsonb;

-- Update column default for new hosts
ALTER TABLE host ALTER COLUMN notification_settings SET DEFAULT '{
  "cleaner_new_booking": {
    "enabled": true,
    "message": "New booking at {{property}}: {{guest}}, {{check_in}}–{{check_out}}, {{num_guests}} guest(s){{pets_text}}{{notes_text}}\nView: {{link}}"
  },
  "cleaner_cancellation": {
    "enabled": true,
    "message": "Booking cancelled at {{property}}: {{guest}}, {{check_in}}–{{check_out}}."
  },
  "cleaner_checkout": {
    "enabled": false,
    "message": "Guest checked out at {{property}}: {{guest}}. Ready for cleaning."
  },
  "cleaner_pet_added": {
    "enabled": true,
    "message": "Pet(s) registered at {{property}}: {{guest}}, check-in {{check_in}}. {{num_pets}} pet(s) total. View: {{link}}"
  },
  "cleaner_early_checkin": {
    "enabled": true,
    "message": "Early check-in purchased at {{property}}: {{guest}}, arriving {{check_in}} at 1pm. View: {{link}}"
  },
  "cleaner_late_checkout": {
    "enabled": true,
    "message": "Late check-out purchased at {{property}}: {{guest}}, departing {{check_out}} at 2pm. View: {{link}}"
  }
}'::jsonb;
