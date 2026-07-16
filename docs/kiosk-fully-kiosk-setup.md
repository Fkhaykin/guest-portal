# Kiosk tablet setup

How to turn an Android tablet into a locked, fullscreen guest kiosk for one house.

There are two ways to point a tablet at a house. **Use the selector (A)** — one URL
for every tablet, pick the house on-screen. The per-house direct URLs (B) are a
fallback for guest phones or one-off use.

---

## A. The house selector — `kiosk.summitlakeside.com` (recommended)

Every tablet gets the **same URL**. On first boot you enter the **admin PIN** and
tap the house it lives in; the tablet remembers it and boots straight into that
house from then on. Installs cleanly as a PWA (or load it in Fully Kiosk).

**Admin PIN: `198590`** — unlocks the picker on a new tablet. Change it anytime with
`vercel env add KIOSK_ADMIN_PIN production` (then redeploy).

### Per-tablet steps

1. Open **`https://kiosk.summitlakeside.com`** in Chrome (or set it as the Start URL in Fully Kiosk — see section C).
2. Enter the admin PIN `198590`.
3. Tap **this house** in the list (Bianca's / Chalet / Lakehouse / Manor / Mansion).
4. It loads that house's kiosk fullscreen and **remembers the choice** — reboots go straight in.
5. To install as a home-screen app: Chrome **⋮ menu → Add to Home screen** → it installs fullscreen, still pinned to the selector (which auto-jumps into the remembered house).

### Re-assigning a tablet to a different house

Open **`https://kiosk.summitlakeside.com/?pick=1`** — the `?pick=1` forces the picker
back instead of auto-entering the remembered house. Enter the PIN, choose the new house.

---

## B. Per-house direct URLs (fallback / guest phones)

Each URL opens exactly one house. The `?pin=` is the house's device PIN and is
scrubbed from the address bar on load. All houses currently share PIN **198590**.

| House | Direct URL |
|-------|-----------|
| **Chalet** | `https://guest.summitlakeside.com/kiosk/3bedb67d-92c8-4163-aafb-e4c7a9c229a3?pin=198590` |
| **Lakehouse** | `https://guest.summitlakeside.com/kiosk/8d971d5a-6b4a-4da2-8d45-183ddd0f68e5?pin=198590` |
| **Manor** | `https://guest.summitlakeside.com/kiosk/f2514f6a-f126-41e9-9cad-de6a47498e0b?pin=198590` |
| **Mansion (BML)** | `https://guest.summitlakeside.com/kiosk/0ec057d4-ac84-490e-a88a-f86e3631b246?pin=198590` |
| **Bianca's** | `https://guest.summitlakeside.com/kiosk/c99ca7f7-19ad-4f1b-85ec-13fde18e8e18?pin=198590` |

These now install as a **fullscreen PWA pinned to the house** via Chrome → Add to
Home screen (previously they stripped the path and dumped you on the marketing home
page — fixed with a per-kiosk manifest).

---

## C. Fully Kiosk Browser (recommended for unattended tablets)

A PWA works, but it can be swiped away and won't auto-relaunch after a reboot. For a
tablet left unattended in a rental, **Fully Kiosk Browser** is more robust: true
fullscreen, auto-relaunch, and it blocks guests from leaving the page.

1. Install **Fully Kiosk Browser & App Lockdown** from the Play Store.
2. Settings (gear) → **Web Content → Start URL** → `https://kiosk.summitlakeside.com` (section A) *or* a per-house URL (section B).
3. **Device Management → Kiosk Mode (PLUS, ~$12 one-time)** → Enable, set a **Kiosk Exit PIN** you'll remember (this is Fully Kiosk's own exit PIN, not the admin PIN). Hides the Android bars and blocks swiping out.
4. **Power** → "Keep Screen On" (or use **Screensaver** with **Motion Detection** to wake on approach).
5. **Advanced Web Settings** → "Fullscreen Mode" ON. Leave "Ignore SSL Errors" OFF (our cert is valid).
6. Reboot the tablet once to confirm it relaunches into the kiosk.

**Extra hardening (free):** Android **Settings → Security → App pinning** → pin Fully
Kiosk so home/back/recents can't leave it without your unlock.

---

## Troubleshooting

- **Shows the address bar / tabs** → you're in plain Chrome. Use Fully Kiosk, or Add to Home screen to install the PWA.
- **`kiosk.summitlakeside.com` doesn't load** → the subdomain needs its DNS record + Vercel domain (see go-live note below). Until then, use the section B URLs.
- **Landed on the marketing home page** → tablet set up before the manifest fix; delete the old home-screen icon and re-add it.
- **"Kiosk not found" / blank** → a token was rotated. Grab the current URL from **Admin → Settings → Property → Kiosk**.
- **Selector says "Wrong PIN"** → that's the admin PIN (`KIOSK_ADMIN_PIN`), not a house PIN.
- **Selector shows "not configured" (500)** → `KIOSK_ADMIN_PIN` isn't set in that environment.
- **Asks for a PIN every launch on a per-house URL** → normal on storage-clearing browsers; the `?pin=` re-authorizes automatically. Don't remove it.

---

## Go-live prerequisites for the selector (one-time)

The `kiosk.summitlakeside.com` selector requires two things beyond deploying the code:

1. **DNS** (Google Cloud DNS — the domain's nameservers are `ns-cloud-*.googledomains.com`):
   add a record for `kiosk` mirroring the existing `manager`/`admin` records —
   CNAME `kiosk.summitlakeside.com` → `4d04328fd8494040.vercel-dns-017.com.`
2. **Vercel**: add the domain to the project — `vercel domains add kiosk.summitlakeside.com`.

Until both are done, the section B per-house URLs work everywhere (they run on the
existing `guest.` subdomain).
