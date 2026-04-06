@AGENTS.md

# Guest Portal

PEPOA short-term tenant registration portal — hosts manage properties and content, guests check in via QR codes or booking lookup and complete multi-step registration (guest list, pets, vehicles, upsells, signature).

## Stack

- **Next.js 16.2.2** (App Router) / **React 19** / **TypeScript**
- **Supabase** — Postgres DB, Auth (email OTP), RLS, Storage (signatures, pet docs, videos)
- **Stripe** — Service purchases + upsell cart checkout
- **Lodgify** — Property management system booking sync
- **PDFKit** — PEPOA registration PDF generation (4-page form)
- **Resend** — Email delivery (PEPOA PDF to HOA)
- **shadcn/ui** (base-nova style, lucide icons) / **Tailwind CSS 4**
- Path alias: `@/*` maps to `./src/*`

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Root: booking search → guest dashboard (client)
│   ├── (admin)/admin/
│   │   ├── page.tsx              # Dashboard (property count, stats)
│   │   ├── settings/             # Host profile + signature canvas
│   │   └── properties/
│   │       ├── page.tsx          # Property list
│   │       ├── new/              # Create property
│   │       └── [id]/             # Property hub + sub-pages:
│   │           ├── registrations/  services/  promotions/
│   │           ├── recommendations/  faqs/  videos/
│   │           └── qr-codes/  owner/
│   ├── (guest)/
│   │   ├── p/[slug]/             # Property portal
│   │   │   ├── page.tsx          # Home (quick-link cards)
│   │   │   ├── register/         # Multi-step registration (client, ~500 lines)
│   │   │   ├── services/  promotions/  faq/
│   │   │   ├── recommendations/  videos/  videos/[id]/
│   │   └── q/[code]/             # QR resolver → redirect + scan tracking
│   ├── api/
│   │   ├── guest/
│   │   │   ├── lookup/           # Anonymous booking search (service role)
│   │   │   ├── register/         # Upsert registration + signature upload + trigger PEPOA
│   │   │   ├── update/           # Update existing registration
│   │   │   ├── upload-pet-doc/   # Pet vaccination/rabies doc upload
│   │   │   └── upsells/          # List available upsells (dynamic pricing)
│   │   │       ├── checkout/     # Stripe checkout for upsell cart
│   │   │       └── confirm/      # Confirm upsell payment
│   │   ├── pepoa/
│   │   │   ├── generate/         # Download PEPOA PDF (auth required)
│   │   │   └── submit/           # Generate + email PDF to HOA
│   │   ├── lodgify/sync|webhook/ # Booking sync (full + single)
│   │   ├── stripe/create-checkout|webhook/
│   │   └── qr/generate/         # QR PNG (512x512, 1yr cache)
│   └── auth/login|verify|callback/
├── components/
│   ├── admin/sidebar.tsx         # Sidebar nav + sign-out (client)
│   ├── guest/
│   │   ├── guest-nav.tsx         # Bottom nav bar (client)
│   │   ├── property-provider.tsx # Property context provider (client)
│   │   └── service-card.tsx      # Service purchase card (client)
│   └── ui/                       # shadcn: button, card, input, dialog, accordion, etc.
├── hooks/use-property.ts         # Property context hook (guest routes)
├── lib/
│   ├── supabase/server|client|admin|middleware.ts
│   ├── lodgify/client|sync.ts
│   ├── stripe/client.ts
│   ├── qr/generate.ts
│   ├── pdf/pepoa-registration.ts # 4-page PDF: registration, pets/vehicles, lease terms, signatures
│   ├── email/send-pepoa-pdf.ts   # Resend: attach PDF, send to HOA email
│   └── utils.ts                  # cn() helper
├── types/database.ts             # Full DB types + GuestListEntry, PetEntry, UpsellEntry
└── proxy.ts                      # Middleware (subdomain routing + session refresh + auth protection)

supabase/
├── config.toml                   # Local dev config, storage buckets
└── migrations/                   # 13 migration files
    ├── 001_initial_schema.sql    # 12 core tables + indexes + updated_at triggers
    ├── 002_rls_policies.sql      # RLS + helper functions
    ├── 003_lodgify_sync.sql      # Lodgify mapping columns
    ├── 004-013                   # Guest mailing address, guest list, pets, upsells,
    │                             # signature, storage bucket, vehicle year/driver,
    │                             # property owner fields, host signature, update log, tips
```

## Database

**Core:** host, property, guest, registration, vehicle
**Content:** service, video, faq, promotion, recommendation
**Transaction:** payment, qr_code
**Audit:** registration_update_log

Key fields & relationships:
- `host` 1→N `property` (via host_id). Host has `signature_url`.
- `property` 1→N all content tables. Has `owner_*` fields, `lodgify_property_id`, `stripe_account_id`.
- `guest` has nullable `auth_user_id` (Lodgify imports), `mailing_address`, `lodgify_guest_id`.
- `registration` stores JSONB arrays: `guest_list` (GuestListEntry[]), `pets` (PetEntry[]), `upsells` (UpsellEntry[]), plus `signature_url`, `tips` (jsonb), `lodgify_booking_id`.
- `vehicle` has `year`, `driver_name` in addition to standard fields.
- `qr_code` target types: video, home, services, faq, registration, custom_url.

## Auth & Security

- Email OTP via Supabase Auth (SMS configured but disabled locally)
- Middleware (`src/proxy.ts`) refreshes session on every request, redirects `/admin/*` to `/auth/login`
- RLS on all tables with helpers: `is_host()`, `current_host_id()`, `current_guest_id()`
- Three Supabase clients:
  - **Server** (`lib/supabase/server.ts`) — auth-aware, Server Components
  - **Browser** (`lib/supabase/client.ts`) — anon key, Client Components
  - **Admin** (`lib/supabase/admin.ts`) — service role, bypasses RLS, API routes only

## Subdomain Routing

Handled in `lib/supabase/middleware.ts` via URL rewriting in the proxy (middleware).

| Subdomain | URL | Serves |
|-----------|-----|--------|
| `guest.summitlakeside.com` | `/`, `/p/[slug]/*`, `/q/[code]` | Guest portal (no rewrite needed) |
| `admin.summitlakeside.com` | `/` → `/admin`, `/properties` → `/admin/properties` | Admin panel (prepends `/admin`) |
| `manager.summitlakeside.com` | `/` → `/cleaner`, `/login` → `/cleaner/login` | Cleaner panel (prepends `/cleaner`) |
| bare domain / no subdomain | `/` | Guest booking search (default) |

- `/api/*`, `/auth/*`, `/_next/*` paths are **never rewritten** (shared across all subdomains)
- Existing prefixed links (e.g. `/admin/properties`) still work on the admin subdomain — the middleware skips paths that already have the correct prefix
- Local dev: use `admin.localhost:3000`, `manager.localhost:3000`, `guest.localhost:3000`

## Storage Buckets

- **registrations** — Signatures (guest + host), 2MiB max, PNG/JPEG
- **pet-documents** — Vaccination/rabies docs per registration
- **videos** — Property instructional videos (signed URLs, 1hr expiry)

## Key Flows

**Guest booking lookup** (`/` root page): Search by name + email/phone + check-in date → shows dashboard with booking details, guest breakdown (adults/children/infants/pets), countdown, property cards. State persisted in `sessionStorage`.

**Multi-step registration** (`/p/[slug]/register`): Name/email → phone/address/guest list → pets + doc uploads → vehicles → upsell cart → signature canvas + terms → submit. Calls `/api/guest/register` which upserts everything, uploads signature, and triggers PEPOA PDF generation + email.

**Upsell system**: Dynamic pricing — early check-in ($100), late check-out ($100), sheets ($250), firewood ($35), baby chair ($25), private chef ($35/guest), luxury picnic ($45/guest), breakfast delivery ($15/guest/day). Availability constraints (no conflicting check-in/out). Cart → Stripe checkout → confirm.

**PEPOA PDF**: 4-page PDF (owner info, guest registration, pet/vehicle details, lease terms, signature blocks). Generated via PDFKit, emailed to HOA submission address via Resend.

**Lodgify sync**: Full sync (`POST /api/lodgify/sync`) or single booking webhook. Maps 6 Lodgify statuses → 3 app statuses (active/completed/cancelled). Creates/updates guests and registrations.

**QR codes**: Admin creates codes targeting portal sections. `/q/[code]` resolves + increments `scan_count`. `/api/qr/generate?code=X` returns PNG.

## Component Patterns

- **Server Components**: Layouts, data-fetching pages (property home, FAQ, recommendations, videos, admin dashboard, registrations list)
- **Client Components** ("use client"): All forms, interactive UI (signature canvas, dialogs, multi-step registration, sidebar, nav), anything using Supabase browser client or `useState`/`useEffect`
- **State**: React `useState` + context (`PropertyProvider`), `sessionStorage` for cross-page persistence (booking search → registration)
- **No** Redux/Zustand. React Hook Form and Zod are in deps but forms use manual `useState`.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx supabase start   # Local Supabase (API :54321, DB :54322, Studio :54323)
npx supabase db push # Push migrations to remote
```

## Environment Variables

See `.env.example`:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Lodgify: `LODGIFY_API_KEY`, `LODGIFY_WEBHOOK_SECRET`
- App: `NEXT_PUBLIC_APP_URL`
- Also requires `RESEND_API_KEY` (not in .env.example)
