# Kiosk Photo Booth

Guests take photos at the house kiosk. Each photo runs through two approval
gates before it can appear publicly.

## Lifecycle

```
capture (in browser)
   ├─ Retake/Delete ....... discarded, never uploaded
   ├─ Keep ................ upload → status "guest_approved"
   └─ To my phone ......... upload → "guest_approved" + QR/email delivery

guest_approved   → shows in the guest's "My Photos" album + admin review queue
   │  (guest can delete their own photo any time)
   ▼  admin approves
published        → House Album: kiosk tile + website property pages
   │  admin can delete a published photo at any time
   ▼  admin rejects
rejected         → hidden from the house album (stays out of everything public)
```

Table: `guest_photo` (migration `114_guest_photo_booth.sql`). Private storage
bucket: `guest-photos`. All reads sign URLs server-side via the service-role
client, so the bucket has no public policy.

## Surfaces

| Surface | Where |
| --- | --- |
| Photo Booth / My Photos tiles | Kiosk home (`main-screen.tsx`), shown only while a stay is checked in |
| House Album tile | Kiosk home, shown only when ≥1 photo is published |
| Admin approval | `/admin/guest-photos` (Approve / Reject / Delete / Unpublish) |
| Website album | Guest portal `/p/[slug]` and public booking page `/book/[slug]` |

Photos attach to the current reservation via the kiosk's `guest_token`. Houses
that span two property rows (shared `nickname`) are unioned in every album read.

## "Send to my phone"

Two options on the review screen:

- **QR code** — scans to a 7-day signed URL of the image; the guest opens it and
  saves it. No typing, no SMS dependency.
- **Email** — the photo is attached (not linked) via Resend, so it is unaffected
  by the Textbelt SMS URL-whitelist state.

SMS is intentionally not used here: links are stripped from texts until the
Textbelt key is whitelisted (`SMS_URLS_ALLOWED`).

## One-time device setup (required)

The photo booth uses the browser camera (`getUserMedia`), which needs:

1. **HTTPS** — satisfied in production (`guest.summitlakeside.com`).
2. **A granted camera permission for the kiosk browser.** On the Android 15
   kiosk this is a one-time step:
   - **Fully Kiosk Browser:** Settings → Web Content Settings → enable
     *Enable Camera Access*, and add the kiosk origin to the permission
     allowlist so the prompt never reappears.
   - **Chrome / other WebView kiosk:** open the kiosk URL once outside kiosk
     lock, tap *Allow* on the camera prompt, then re-enable kiosk lock. Chrome
     remembers the grant per-origin.

Without the grant the booth shows a "camera isn't available — allow access" card
with a retry button; everything else on the kiosk keeps working.

## Deploy

1. Push the migration first: `npx supabase db push` (creates the table + bucket).
2. Deploy the app (`git push origin main`).
3. Grant camera permission on each physical kiosk (above).
