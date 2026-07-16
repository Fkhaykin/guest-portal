// Shared reservation-detail loader + a small in-memory prefetch cache.
//
// The reservation detail page (`/admin/reservations/[id]`) is fully
// client-rendered and used to fetch its data as a long SEQUENTIAL waterfall
// that only began after the user clicked through. This module does two things:
//
//   1. Parallelizes the load — one core query, then everything else at once.
//   2. Lets callers WARM the cache ahead of a click (e.g. the messages thread
//      header already knows the registration_id), so opening the detail page
//      reads a resolved promise and paints instantly.
//
// The cache is keyed by registration id with a short TTL — long enough to
// bridge "open thread / hover link" → "click", short enough that stale edits
// don't linger. Post-edit refreshes pass { force: true } to bypass it.

import { createClient } from "@/lib/supabase/client";
import { createPrefetcher } from "@/lib/prefetch-cache";
import type {
  GuestListEntry,
  PetEntry,
  UpsellEntry,
  CleaningPhoto,
  CleaningChecklistItem,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/database";
import type { LodgifyPriceBreakdown } from "@/lib/lodgify/client";

export type FullRegistration = {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: "active" | "completed" | "cancelled" | "pending_payment";
  booking_source: string | null;
  signature_url: string | null;
  total_amount_cents: number;
  cleaning_fee_cents: number;
  tax_amount_cents: number;
  pet_fee_total_cents: number;
  discount_cents: number;
  discount_label: string | null;
  nightly_rates_snapshot: Array<{ date: string; cents: number }> | null;
  lodgify_price_breakdown: LodgifyPriceBreakdown | null;
  payment_plan: "full" | "split" | "automatic";
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  balance_charge_attempts: number;
  balance_last_attempt_at: string | null;
  balance_last_failure_reason: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_deposit_invoice_id: string | null;
  stripe_balance_invoice_id: string | null;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  upsells: UpsellEntry[] | null;
  lodgify_booking_id: number | null;
  lodgify_sync_status: string;
  tips: Record<string, unknown> | null;
  lodgify_adults: number;
  lodgify_children: number;
  lodgify_infants: number;
  lodgify_num_pets: number;
  hoa_email_disabled: boolean;
  review_request_disabled: boolean;
  review_request_forced: boolean;
  review_request_skipped_at: string | null;
  review_request_skip_reason: string | null;
  early_checkin_override: "allow" | "block" | null;
  early_checkin_override_hours: number | null;
  late_checkout_override: "allow" | "block" | null;
  late_checkout_override_hours: number | null;
  id_verification_status: string;
  id_verified_name: string | null;
  id_name_match: boolean | null;
  booked_at: string | null;
  created_at: string;
  updated_at: string;
  guest: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    mailing_address: string | null;
    lodgify_guest_id: number | null;
  } | null;
  property: {
    id: string;
    name: string;
    nickname: string | null;
    address: string | null;
    slug: string;
    max_guests: number;
    cleaning_fee_cents: number;
    pet_fee_cents: number;
    hoa_type: string;
    hoa_registration_fee_cents: number | null;
    hoa_last_minute_fee_cents: number | null;
    hoa_last_minute_days: number | null;
    lodgify_property_id: number | null;
    listing_urls: Record<string, string>;
    owner_name: string | null;
    owner_phone: string | null;
    owner_email: string | null;
    hoa_submission_email: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  } | null;
};

export type Vehicle = {
  id: string;
  year: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string;
  state_or_region: string | null;
  driver_name: string | null;
};

export type CleaningStatus = {
  id: string;
  is_cleaned: boolean;
  cleaned_at: string | null;
  photos: CleaningPhoto[];
  checklist: CleaningChecklistItem[];
  notes: string | null;
  cleaner_id: string | null;
};

export type IncurredCharge = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  cleanerName: string;
  description: string;
  amount: number; // cents
  expenseDate: string;
  notes: string | null;
};

export type PhotoMap = Record<string, CleaningPhoto & { url: string }>;

// The heavier, non-blocking half of the page — everything that isn't needed to
// paint the header/guest/property/pricing panels. Streamed in after the core.
export type ReservationExtras = {
  vehicles: Vehicle[];
  cleaning: CleaningStatus | null;
  currentPhotoData: PhotoMap | undefined;
  prevCleaning: CleaningStatus | null;
  photoData: PhotoMap;
  charges: IncurredCharge[];
  reviewMsgLog: { sent_at: string; error: string | null } | null;
  hasModifications: boolean;
  payEmails: { email_type: string; sent_to: string[]; created_at: string }[];
};

export type ReservationData = { reg: FullRegistration } & ReservationExtras;

const REGISTRATION_SELECT = `
  id, property_id, guest_id, check_in_date, check_out_date, num_guests, notes,
  status, booking_source, signature_url, total_amount_cents, cleaning_fee_cents,
  tax_amount_cents, pet_fee_total_cents, discount_cents, discount_label,
  nightly_rates_snapshot, lodgify_price_breakdown, payment_plan, deposit_paid_at, balance_paid_at,
  balance_charge_attempts, balance_last_attempt_at, balance_last_failure_reason,
  stripe_customer_id, stripe_payment_method_id, stripe_deposit_invoice_id,
  stripe_balance_invoice_id, guest_list, pets,
  upsells, tips, lodgify_booking_id, lodgify_sync_status, lodgify_adults, lodgify_children, lodgify_infants,
  lodgify_num_pets, hoa_email_disabled, review_request_disabled, review_request_forced, review_request_skipped_at, review_request_skip_reason,
  early_checkin_override, early_checkin_override_hours, late_checkout_override, late_checkout_override_hours,
  id_verification_status, id_verified_name, id_name_match, booked_at, created_at, updated_at,
  guest:guest_id(id, full_name, email, phone, mailing_address, lodgify_guest_id),
  property:property_id(id, name, nickname, address, slug, max_guests, cleaning_fee_cents, pet_fee_cents, hoa_type, hoa_registration_fee_cents, hoa_last_minute_fee_cents, hoa_last_minute_days, lodgify_property_id, listing_urls, owner_name, owner_phone, owner_email, hoa_submission_email, emergency_contact_name, emergency_contact_phone)
`;

const CLEANING_SELECT =
  "id, is_cleaned, cleaned_at, photos, checklist, notes, cleaner_id";

type Supabase = ReturnType<typeof createClient>;

// Resolve signed URLs for a cleaning row's photos via the admin API. Best-effort:
// a hiccup just yields no thumbnails rather than failing the whole page load.
async function loadPhotoMap(
  registrationId: string,
  cleaning: CleaningStatus | null
): Promise<PhotoMap> {
  if (!cleaning?.photos?.length) return {};
  try {
    const res = await fetch(
      `/api/admin/cleaning-photos?registration_id=${registrationId}`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map: PhotoMap = {};
    for (const photo of data.cleaning?.photos ?? []) {
      if (photo.url) map[photo.path] = photo;
    }
    return map;
  } catch {
    return {};
  }
}

// Cleaning status for this reservation + its photo thumbnails.
async function loadCurrentCleaning(supabase: Supabase, id: string) {
  const { data: cleaning } = await supabase
    .from("cleaning_status")
    .select(CLEANING_SELECT)
    .eq("registration_id", id)
    .maybeSingle();
  const photoData = await loadPhotoMap(id, cleaning as CleaningStatus | null);
  return { cleaning: (cleaning as CleaningStatus | null) ?? null, photoData };
}

// The turnover clean before this guest checked in: find the property's prior
// reservation, then its cleaning row + photos.
async function loadPrevCleaning(supabase: Supabase, reg: FullRegistration) {
  const { data: prevRegs } = await supabase
    .from("registration")
    .select("id")
    .eq("property_id", reg.property_id)
    .lt("check_out_date", reg.check_in_date)
    .order("check_out_date", { ascending: false })
    .limit(1);

  if (!prevRegs || prevRegs.length === 0) {
    return { cleaning: null as CleaningStatus | null, photoData: {} as PhotoMap };
  }

  const prevId = prevRegs[0].id;
  const { data: cleaning } = await supabase
    .from("cleaning_status")
    .select(CLEANING_SELECT)
    .eq("registration_id", prevId)
    .maybeSingle();
  const photoData = await loadPhotoMap(prevId, cleaning as CleaningStatus | null);
  return { cleaning: (cleaning as CleaningStatus | null) ?? null, photoData };
}

// Reimbursement line items across cleaner invoices that point at this reservation.
async function loadCharges(supabase: Supabase, id: string): Promise<IncurredCharge[]> {
  const { data: invoices } = await supabase
    .from("cleaner_invoice")
    .select(
      "id, invoice_number, status, period_start, line_items, notes, cleaner:cleaner_id(name)"
    );

  const charges: IncurredCharge[] = [];
  for (const inv of invoices || []) {
    const items = (inv.line_items || []) as InvoiceLineItem[];
    for (const item of items) {
      if (item.registration_id === id && item.type === "reimbursement") {
        const cleaner = inv.cleaner as unknown as { name: string } | null;
        charges.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceStatus: inv.status as InvoiceStatus,
          cleanerName: cleaner?.name || "Unknown",
          description: item.description,
          amount: item.amount,
          expenseDate: inv.period_start,
          notes: inv.notes,
        });
      }
    }
  }
  return charges;
}

// The core reservation row — all the header, guest/property panels, pricing and
// status need. This is the ONLY query the page blocks on for its first paint.
async function fetchReservationCore(id: string): Promise<FullRegistration | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("registration")
    .select(REGISTRATION_SELECT)
    .eq("id", id)
    .single();
  return data ? (data as unknown as FullRegistration) : null;
}

const EMPTY_EXTRAS: ReservationExtras = {
  vehicles: [],
  cleaning: null,
  currentPhotoData: undefined,
  prevCleaning: null,
  photoData: {},
  charges: [],
  reviewMsgLog: null,
  hasModifications: false,
  payEmails: [],
};

// Everything else the page shows: vehicles, cleaning + turnover photos, cleaner
// charges, review-message log, modification flag, payment emails — one parallel
// batch that streams in AFTER the core paints. Reads the core from its cache
// (warmed alongside) for the few fields it needs, rather than re-querying.
async function fetchReservationExtras(id: string): Promise<ReservationExtras> {
  const reg = await reservationCore.get([id]);
  if (!reg) return EMPTY_EXTRAS;
  const supabase = createClient();

  const [vehiclesRes, current, prev, charges, reviewRes, modRes, payEmails] =
    await Promise.all([
      supabase
        .from("vehicle")
        .select("id, year, make, model, color, license_plate, state_or_region, driver_name")
        .eq("registration_id", id),
      loadCurrentCleaning(supabase, id),
      loadPrevCleaning(supabase, reg),
      loadCharges(supabase, id),
      supabase
        .from("guest_automated_message_log")
        .select("sent_at, error")
        .eq("registration_id", id)
        .eq("message_type", "post_checkout")
        .maybeSingle(),
      supabase
        .from("registration_update_log")
        .select("id", { count: "exact", head: true })
        .eq("registration_id", id)
        .neq("change_type", "initial_registration"),
      // Payment emails only exist for direct (admin-created) bookings.
      reg.booking_source === "admin"
        ? supabase
            .from("email_send_log")
            .select("email_type, sent_to, created_at")
            .eq("registration_id", id)
            .in("email_type", [
              "booking_invoice_deposit",
              "booking_invoice_full",
              "booking_plan_picker",
            ])
            .order("created_at", { ascending: true })
            .then((r) => r.data ?? [])
        : Promise.resolve([]),
    ]);

  return {
    vehicles: (vehiclesRes.data as Vehicle[] | null) ?? [],
    cleaning: current.cleaning,
    currentPhotoData: current.cleaning?.photos?.length ? current.photoData : undefined,
    prevCleaning: prev.cleaning,
    photoData: prev.photoData,
    charges,
    reviewMsgLog: reviewRes.data,
    hasModifications: (modRes.count ?? 0) > 0,
    payEmails: payEmails as {
      email_type: string;
      sent_to: string[];
      created_at: string;
    }[],
  };
}

const reservationCore = createPrefetcher((id: string) => id, fetchReservationCore);
const reservationExtras = createPrefetcher((id: string) => id, fetchReservationExtras);

// Warm BOTH halves for a reservation the user is likely to open, so the detail
// page paints its core from cache instantly and the extras are already in flight.
export function prefetchReservation(id: string | null | undefined): void {
  if (!id) return;
  reservationCore.prefetch(id);
  reservationExtras.prefetch(id);
}

// Core row (gates first paint) — serves a warm entry instantly. Pass
// { force: true } after an edit/cancel to bypass and refresh the cache.
export function getReservationCore(id: string, opts?: { force?: boolean }) {
  return reservationCore.get([id], opts);
}

// The heavier extras (loaded after paint). Same cache/force semantics.
export function getReservationExtras(id: string, opts?: { force?: boolean }) {
  return reservationExtras.get([id], opts);
}
