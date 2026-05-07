-- Add cleaner_invoice_paid SMS notification event to all existing hosts
UPDATE host
SET notification_settings = notification_settings || jsonb_build_object(
  'cleaner_invoice_paid', jsonb_build_object(
    'enabled', true,
    'message', 'Invoice {{invoice_number}} ({{period_start}}–{{period_end}}) marked paid — {{amount}}. Thanks!'
  )
)
WHERE NOT (notification_settings ? 'cleaner_invoice_paid');

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
  },
  "cleaner_invoice_paid": {
    "enabled": true,
    "message": "Invoice {{invoice_number}} ({{period_start}}–{{period_end}}) marked paid — {{amount}}. Thanks!"
  }
}'::jsonb;
