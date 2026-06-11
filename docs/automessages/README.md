# Airbnb / Lodgify Automessages

Recreated 2026-06 from the actual send history (the canonical, highest-volume variant of each message, newest generation). Typos fixed ("Renove" → "Remove", "keave" → "leave", "recieved" → "received", "notifice" → "notice", "arive" → "arrive"), policies normalized to the current era ($25/hr early/late up to 3 hrs, guest portal, $50 unannounced-late fee).

## Send schedule

| # | Message | When | File |
|---|---|---|---|
| 1 | Booking confirmation + guest-count ask | Immediately on booking | [01-booking-confirmation.md](01-booking-confirmation.md) |
| 2 | Registration / rental agreement request | 10 days before check-in (or immediately if closer) | [02-registration-request.md](02-registration-request.md) |
| 3 | 3-day reminder | 3 days before check-in | [03-three-day-reminder.md](03-three-day-reminder.md) |
| 4 | Check-in instructions (per home) | Morning of check-in (~8am) | [04-check-in-instructions.md](04-check-in-instructions.md) |
| 5 | Mid-stay welcome + local guide | Evening of arrival / next morning | [05-mid-stay-welcome.md](05-mid-stay-welcome.md) |
| 6 | Checkout reminder | Day before checkout (evening) | [06-checkout-reminder.md](06-checkout-reminder.md) |
| 7 | Review request | Morning after checkout | [07-review-request.md](07-review-request.md) |
| 8 | Quick replies (canned Q&A answers) | On demand | [08-quick-replies.md](08-quick-replies.md) |

Raw source: [raw-host-templates.txt](raw-host-templates.txt) (all 215 deduplicated templates with send counts). Regenerate the underlying conversation export anytime with `node scripts/export-lodgify-messages.mjs` (writes /tmp/lodgify-conversations.json).

## Placeholders

`{{guest_first_name}}`, `{{check_in_date}}`, `{{check_out_date}}`, `{{check_in_time}}`, `{{check_out_time}}`, `{{next_check_in_date}}`, `{{listing_name}}`, `{{door_code}}`, `{{wifi_name}}`, `{{wifi_password}}`

All registration links now point to the general guest portal: **https://guest.summitlakeside.com** (the old per-home summitlakeside.com rental-agreement URLs are deprecated).

Map to the platform's merge tags when installing: Airbnb scheduled messages use shortcodes like `%{guest_first_name}%` / `%{check_in_date}%`; Lodgify auto-messages use its own `[[...]]` variables.

## Per-home values

| Home | Listing(s) | Door | Wifi |
|---|---|---|---|
| Lakehouse (484 Lakeside Dr) | Poconos Lakefront… / Lakefront Home… | Yale keypad **8550** | Lakeside / relax484 |
| Chalet (475 Lakeside Dr) | Lakeview Chalet… / Luxury Lakefront Chalet… | Lockbox **8550** (physical key, $50 if lost) | The Chalet / relax475 |
| Manor (424 Lakeside Dr) | Lake Adjacent Home… | Keypad **8550** | Lakeside Manor - 5G / relax424 |
| Cottage (449 Lakeside Dr) | Cozy Lakefront Home… | Keypad **4867** | Lakehouse Wifi / relax449 |
| Mansion/Chateau (279 East Shore Dr) | Lakefront Mansion… | Keypad **9259** in history, later 8550 — **verify current code before installing** | Summit Lakefront Manor / relax279 |

Signature on long messages: `Thank you!` / `Feliks` / `Summit Lakeside Rentals` / `732-213-8571` / `alt. 732-979-3855`.
