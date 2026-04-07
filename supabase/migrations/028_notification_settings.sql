-- Store notification preferences per host (event toggles + message templates)
alter table public.host add column notification_settings jsonb not null default '{
  "cleaner_new_booking": {
    "enabled": true,
    "message": "New booking at {{property}}: {{guest}}, {{check_in}} – {{check_out}}, {{num_guests}} guest(s)."
  },
  "cleaner_cancellation": {
    "enabled": true,
    "message": "Booking cancelled at {{property}}: {{guest}}, {{check_in}} – {{check_out}}."
  },
  "cleaner_checkout": {
    "enabled": false,
    "message": "Guest checked out at {{property}}: {{guest}}. Ready for cleaning."
  }
}'::jsonb;
