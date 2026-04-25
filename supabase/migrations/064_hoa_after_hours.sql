-- Add after-hours HOA email and schedule to property table
ALTER TABLE property
  ADD COLUMN hoa_after_hours_email text,
  ADD COLUMN hoa_after_hours_schedule jsonb;

-- hoa_after_hours_schedule shape:
-- { "enabled": true, "timezone": "America/New_York", "start": "17:00", "end": "09:00" }
-- start/end are 24h local time; if start > end the window wraps midnight
