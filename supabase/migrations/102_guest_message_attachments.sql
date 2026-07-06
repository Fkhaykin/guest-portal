-- Store inbound message attachments (guest-sent photos from Airbnb/Vrbo/
-- Booking.com, relayed through Lodgify). Lodgify only exposes attachment
-- content on the v2 messaging thread endpoint — the webhook event carries just
-- a has_attachments boolean — and each file_url there is a ~5-minute presigned
-- S3 link. We cache the latest known {url,name} pairs here and refresh them
-- every time the thread is re-pulled (which the inbox does on every open), so
-- the URL served to the browser is always freshly minted.
alter table guest_message
  add column if not exists attachments jsonb;

comment on column guest_message.attachments is
  'Array of {url,name} for message attachments from Lodgify. url is a short-lived presigned S3 link, refreshed on each thread pull, so treat as ephemeral (do not deep-link).';
