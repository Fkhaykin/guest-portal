-- Direct-booking message threads. Bookings created outside Lodgify (admin
-- manual bookings, own-site checkout) have no Lodgify thread — we store their
-- conversation in the same guest_message tables under a synthetic thread_uid
-- of "direct:<registration_id>". Outbound goes to the guest's email/phone;
-- inbound arrives via the Resend (email) and Textbelt (SMS) reply webhooks.

-- Direct messages have no Lodgify message id.
alter table guest_message alter column lodgify_message_id drop not null;

-- Link direct messages/threads to the registration they belong to.
alter table guest_message add column if not exists registration_id uuid references registration(id) on delete cascade;
alter table guest_message_thread add column if not exists registration_id uuid references registration(id) on delete cascade;

-- Delivery channel for direct messages: 'email' | 'sms'. Null for Lodgify rows.
alter table guest_message add column if not exists channel text;

create index if not exists idx_guest_message_registration on guest_message(registration_id);
create index if not exists idx_guest_message_thread_registration on guest_message_thread(registration_id);
