-- Surface Lodgify's per-message delivery status in the admin messenger.
--
-- Lodgify's v2 messaging thread reports a `message_status` per message. A relayed
-- owner reply progresses to "Delivered"; a reply that Lodgify accepted but never
-- pushed to the OTA (e.g. an Airbnb inquiry answered seconds after it arrived, before
-- the channel was wired) stays stuck at "Submitted". We were storing the message but
-- not the status, so the composer showed every send as delivered even when it wasn't.
-- Capturing the status lets the UI flag a stuck/undelivered message instead of lying.
alter table guest_message add column if not exists message_status text;
