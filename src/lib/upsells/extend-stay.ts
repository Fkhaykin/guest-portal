import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBookingQuote,
  PA_STATE_TAX_RATE,
  MONROE_COUNTY_TAX_RATE,
  type NightlyRate,
} from "@/lib/pricing/booking-quote";
import { isPropertyAvailable, getAvailability, createBooking } from "@/lib/lodgify/client";
import { stripe } from "@/lib/stripe/client";
import { notifyHostOfBookingChange } from "@/lib/push/notify-host";

// Guest-initiated stay extension: pick a later checkout, pay for the extra nights,
// and have the booking updated + the added nights blocked on the Lodgify calendar.
//
// Two shared entry points, mirroring the upsell flow:
//   quoteExtension  — availability + delta pricing (used by the quote route AND
//                     re-run server-side at checkout so the client can't tamper).
//   applyExtension  — idempotent fulfillment (called by BOTH the return-from-Stripe
//                     confirm route and the Stripe webhook, so a closed tab still
//                     fulfills). Guards on the specific upsell entry's status.

export const MAX_EXTENSION_NIGHTS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000
  );
}

/** Shift a YYYY-MM-DD string by whole days (UTC, TZ-safe). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** State + PA county lodging tax on a room subtotal, rounded per component to
 *  match buildBookingQuote exactly (so a calendar option and its later re-quote
 *  charge the same cents). */
function lodgingTaxCents(roomRateCents: number): number {
  return (
    Math.round(roomRateCents * PA_STATE_TAX_RATE) +
    Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE)
  );
}

export type ExtendQuote = {
  currentCheckOutDate: string;
  newCheckOutDate: string;
  extraNights: number;
  nightlyRates: NightlyRate[];
  roomRateCents: number;
  taxTotalCents: number;
  totalCents: number;
};

type QuoteResult =
  | { ok: true; quote: ExtendQuote }
  | { ok: false; status: number; error: string };

type ExtendUpsell = {
  type: string;
  label: string;
  price_cents: number;
  stripe_session_id?: string;
  status: string;
  meta?: Record<string, unknown> | null;
};

/**
 * Price the extension window and confirm the added nights are free. Reused by the
 * checkout route so the charged amount is always server-authoritative.
 */
export async function quoteExtension(
  admin: SupabaseClient,
  params: { registrationId: string; newCheckOutDate: string }
): Promise<QuoteResult> {
  const { registrationId, newCheckOutDate } = params;
  if (!DATE_RE.test(newCheckOutDate)) {
    return { ok: false, status: 400, error: "Invalid date" };
  }

  const { data: reg } = await admin
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, num_guests, payment_plan, balance_paid_at, status, property:property_id(lodgify_property_id)"
    )
    .eq("id", registrationId)
    .single();

  if (!reg) return { ok: false, status: 404, error: "Reservation not found" };
  if (reg.status === "cancelled") {
    return { ok: false, status: 400, error: "This booking has been cancelled" };
  }

  const current = reg.check_out_date as string;
  if (current < todayIso()) {
    return { ok: false, status: 400, error: "This stay has already ended" };
  }
  if (newCheckOutDate <= current) {
    return { ok: false, status: 400, error: "Choose a date after your current checkout" };
  }

  const extraNights = nightsBetween(current, newCheckOutDate);
  if (extraNights < 1) {
    return { ok: false, status: 400, error: "Choose a later checkout date" };
  }
  if (extraNights > MAX_EXTENSION_NIGHTS) {
    return { ok: false, status: 400, error: `Extensions are limited to ${MAX_EXTENSION_NIGHTS} nights — please message us for a longer stay` };
  }

  // A split-pay booking with an unpaid balance is auto-charged off its full total;
  // extending now would let the balance invoice re-bill the extension nights.
  if (reg.payment_plan === "split" && !reg.balance_paid_at) {
    return {
      ok: false,
      status: 409,
      error: "Please complete your remaining balance payment before extending your stay.",
    };
  }

  const prop = reg.property as unknown as { lodgify_property_id: number | null } | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;
  if (!lodgifyPropertyId) {
    return { ok: false, status: 400, error: "This property can't be extended online — please message us" };
  }

  // Availability for the extension nights only: [current_checkout, new_checkout).
  let available = false;
  try {
    available = await isPropertyAvailable(lodgifyPropertyId, current, newCheckOutDate);
  } catch {
    return { ok: false, status: 502, error: "Couldn't check availability — please try again" };
  }
  if (!available) {
    return { ok: false, status: 409, error: "Those nights are already booked — try a different date" };
  }

  // Price only the extension window (no cleaning/pet re-charge — those are per-stay).
  let breakdown;
  try {
    breakdown = await buildBookingQuote({
      lodgifyPropertyId,
      checkIn: current,
      checkOut: newCheckOutDate,
      guests: (reg.num_guests as number) || 2,
      pets: 0,
      cleaningFeeCents: 0,
      petFeeCents: 0,
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Couldn't price those dates",
    };
  }

  return {
    ok: true,
    quote: {
      currentCheckOutDate: current,
      newCheckOutDate,
      extraNights,
      nightlyRates: breakdown.nightlyRates,
      roomRateCents: breakdown.roomRateCents,
      taxTotalCents: breakdown.taxTotalCents,
      totalCents: breakdown.totalCents,
    },
  };
}

export type ExtendOption = {
  date: string; // candidate new checkout date
  extraNights: number;
  roomRateCents: number;
  taxTotalCents: number;
  totalCents: number; // cumulative cost to extend UNTIL this checkout date
};

export type ExtendOptionsResult =
  | {
      ok: true;
      checkInDate: string;
      currentCheckOutDate: string;
      maxCheckOutDate: string;
      options: ExtendOption[];
    }
  | { ok: false; status: number; error: string };

/**
 * Build every checkout date the guest can extend to, with the running price for
 * each — the data behind the calendar picker. Availability is fetched once for the
 * whole window and pricing once for the bookable run, so the client renders the
 * full month(s) without a request per date.
 *
 * The bookable run is contiguous: a guest can only add nights up to the first one
 * that's already booked (you can't hop over a gap), so options span
 * [current+1 … first-blocked-night], capped at MAX_EXTENSION_NIGHTS.
 */
export async function extensionOptions(
  admin: SupabaseClient,
  params: { registrationId: string }
): Promise<ExtendOptionsResult> {
  const { registrationId } = params;

  const { data: reg } = await admin
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, num_guests, payment_plan, balance_paid_at, status, property:property_id(lodgify_property_id)"
    )
    .eq("id", registrationId)
    .single();

  if (!reg) return { ok: false, status: 404, error: "Reservation not found" };
  if (reg.status === "cancelled") {
    return { ok: false, status: 400, error: "This booking has been cancelled" };
  }

  const current = reg.check_out_date as string;
  const checkIn = reg.check_in_date as string;
  if (current < todayIso()) {
    return { ok: false, status: 400, error: "This stay has already ended" };
  }

  if (reg.payment_plan === "split" && !reg.balance_paid_at) {
    return {
      ok: false,
      status: 409,
      error: "Please complete your remaining balance payment before extending your stay.",
    };
  }

  const prop = reg.property as unknown as { lodgify_property_id: number | null } | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;
  if (!lodgifyPropertyId) {
    return { ok: false, status: 400, error: "This property can't be extended online — please message us" };
  }

  // Availability across the whole potential window: nights [current, current+MAX).
  const windowLastNight = addDaysIso(current, MAX_EXTENSION_NIGHTS - 1);
  let periods: { start: string; end: string; available: number }[];
  try {
    periods = await getAvailability(lodgifyPropertyId, current, windowLastNight);
  } catch {
    return { ok: false, status: 502, error: "Couldn't check availability — please try again" };
  }

  // Earliest already-booked night in the window caps how far they can extend.
  const blockedNights = periods
    .filter((p) => p.available === 0)
    .map((p) => p.start.slice(0, 10))
    .filter((s) => s >= current);
  const firstBlocked = blockedNights.length
    ? blockedNights.reduce((a, b) => (a < b ? a : b))
    : null;
  const maxCheckOut = firstBlocked ?? addDaysIso(current, MAX_EXTENSION_NIGHTS);

  // The very next night is already booked → nothing to offer.
  if (maxCheckOut <= current) {
    return {
      ok: true,
      checkInDate: checkIn,
      currentCheckOutDate: current,
      maxCheckOutDate: current,
      options: [],
    };
  }

  // Price the bookable run once. buildBookingQuote returns one rate per night in
  // [current, maxCheckOut); we accumulate to get each candidate checkout's total.
  let breakdown;
  try {
    breakdown = await buildBookingQuote({
      lodgifyPropertyId,
      checkIn: current,
      checkOut: maxCheckOut,
      guests: (reg.num_guests as number) || 2,
      pets: 0,
      cleaningFeeCents: 0,
      petFeeCents: 0,
    });
  } catch {
    return { ok: false, status: 502, error: "Couldn't load pricing for those dates — please try again" };
  }

  const rates = [...breakdown.nightlyRates].sort((a, b) => a.date.localeCompare(b.date));
  const options: ExtendOption[] = [];
  let cumRoom = 0;
  for (let k = 1; k <= rates.length; k++) {
    cumRoom += rates[k - 1].price_cents;
    const taxTotalCents = lodgingTaxCents(cumRoom);
    options.push({
      date: addDaysIso(current, k),
      extraNights: k,
      roomRateCents: cumRoom,
      taxTotalCents,
      totalCents: cumRoom + taxTotalCents,
    });
  }

  return {
    ok: true,
    checkInDate: checkIn,
    currentCheckOutDate: current,
    maxCheckOutDate: options.length ? options[options.length - 1].date : current,
    options,
  };
}

type ApplyResult =
  | { ok: true; newCheckOutDate: string; alreadyApplied?: boolean }
  | { ok: false; status: number; error: string; conflict?: boolean };

/**
 * Idempotently apply a paid extension: block the added nights on Lodgify, extend
 * the checkout date, roll the extension's room+tax into the booking totals, and
 * log it. Safe to call more than once (webhook + confirm) — only the call that
 * finds the upsell entry still "pending" performs side effects.
 *
 * `expectedRegistrationId`, when provided, must match the session's — a defence so
 * a guest token for booking A can't fulfil a session belonging to booking B.
 */
export async function applyExtension(
  admin: SupabaseClient,
  sessionId: string,
  expectedRegistrationId?: string
): Promise<ApplyResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return { ok: false, status: 400, error: "Payment not completed" };
  }
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) return { ok: false, status: 400, error: "Missing registration on session" };
  if (expectedRegistrationId && expectedRegistrationId !== registrationId) {
    return { ok: false, status: 403, error: "Session does not match this booking" };
  }

  const { data: reg } = await admin
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, num_guests, total_amount_cents, tax_amount_cents, nightly_rates_snapshot, upsells, guest:guest_id(full_name, email, phone), property:property_id(lodgify_property_id)"
    )
    .eq("id", registrationId)
    .single();
  if (!reg) return { ok: false, status: 404, error: "Reservation not found" };

  const upsells = (reg.upsells as ExtendUpsell[] | null) ?? [];
  const target = upsells.find(
    (u) => u.stripe_session_id === sessionId && u.type === "extend_stay"
  );
  if (!target) return { ok: false, status: 404, error: "Extension not found for this session" };

  // Idempotency: only act while still pending.
  if (target.status === "paid") {
    return { ok: true, newCheckOutDate: reg.check_out_date as string, alreadyApplied: true };
  }
  if (target.status === "failed") {
    return { ok: false, status: 409, error: "This extension could not be completed and was refunded." };
  }

  const meta = (target.meta ?? {}) as {
    new_check_out_date?: string;
    nightly_rates?: NightlyRate[];
    tax_total_cents?: number;
  };
  const newCheckOutDate = meta.new_check_out_date;
  if (!newCheckOutDate) return { ok: false, status: 400, error: "Extension is missing its target date" };

  const baseline = reg.check_out_date as string;
  // A prior apply already moved us to/past the target — treat as done.
  if (baseline >= newCheckOutDate) {
    return { ok: true, newCheckOutDate: baseline, alreadyApplied: true };
  }

  const guest = reg.guest as unknown as { full_name: string; email: string | null; phone: string | null } | null;
  const prop = reg.property as unknown as { lodgify_property_id: number | null } | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;

  const refundAndFail = async (reason: string): Promise<void> => {
    try {
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      if (pi) await stripe.refunds.create({ payment_intent: pi });
    } catch (e) {
      console.error("[extend-stay] refund failed:", e);
    }
    const failed = upsells.map((u) =>
      u.stripe_session_id === sessionId && u.type === "extend_stay" ? { ...u, status: "failed" } : u
    );
    await admin.from("registration").update({ upsells: failed }).eq("id", reg.id);
    console.error(`[extend-stay] ${reason} (registration ${reg.id})`);
  };

  if (!lodgifyPropertyId) {
    await refundAndFail("no lodgify property id");
    return { ok: false, status: 409, error: "Extension unavailable — you have been refunded." };
  }

  // Last-moment availability guard: createBooking does NOT validate overlaps, so
  // this is the authoritative check before we block the nights.
  let available = false;
  try {
    available = await isPropertyAvailable(lodgifyPropertyId, baseline, newCheckOutDate);
  } catch {
    available = false;
  }
  if (!available) {
    // A concurrent caller may have already applied it — re-read before refunding.
    const { data: fresh } = await admin
      .from("registration")
      .select("check_out_date, upsells")
      .eq("id", reg.id)
      .single();
    const freshTarget = ((fresh?.upsells as ExtendUpsell[] | null) ?? []).find(
      (u) => u.stripe_session_id === sessionId
    );
    if (freshTarget?.status === "paid" || ((fresh?.check_out_date as string) ?? "") >= newCheckOutDate) {
      return { ok: true, newCheckOutDate: (fresh?.check_out_date as string) ?? newCheckOutDate, alreadyApplied: true };
    }
    await refundAndFail("extension nights became unavailable");
    return { ok: false, status: 409, conflict: true, error: "Those nights were just booked — you have not been charged." };
  }

  // Block the extension nights: the Lodgify API has no update-dates endpoint and
  // won't mutate the original reservation, so we create an adjacent Direct booking.
  let blockingBookingId: number | null = null;
  try {
    blockingBookingId = await createBooking({
      propertyId: lodgifyPropertyId,
      arrival: baseline,
      departure: newCheckOutDate,
      guestName: `Extension — ${guest?.full_name ?? "Guest"}`,
      guestEmail: guest?.email || "",
      guestPhone: guest?.phone || "",
      guests: (reg.num_guests as number) || 1,
      totalAmount: (target.price_cents || 0) / 100,
      source: "Direct",
    });
  } catch (err) {
    await refundAndFail(`Lodgify block failed: ${err instanceof Error ? err.message : "unknown"}`);
    return { ok: false, status: 502, error: "We couldn't confirm those nights — you have not been charged." };
  }

  // Apply to the booking: extend checkout, add the extension's room+tax to the
  // totals, and append its nights to the snapshot (existing nights untouched so we
  // never re-price what was already booked). Cleaning/pet fees are per-stay — kept.
  const extNightly = (meta.nightly_rates ?? []) as NightlyRate[];
  const extTax = meta.tax_total_cents ?? 0;
  const existingSnapshot = (reg.nightly_rates_snapshot as NightlyRate[] | null) ?? [];
  const newSnapshot = [...existingSnapshot, ...extNightly];
  const newTotal = ((reg.total_amount_cents as number) ?? 0) + (target.price_cents || 0);
  const newTax = ((reg.tax_amount_cents as number) ?? 0) + extTax;
  const extraNights = nightsBetween(baseline, newCheckOutDate);

  // Mark everything bought in this session paid — the extension itself plus any
  // bundled add-on (a late checkout on the new final day rides the same session).
  const bundledLate = upsells.find(
    (u) => u.stripe_session_id === sessionId && u.type === "late_checkout"
  );
  const paidUpsells = upsells.map((u) => {
    if (u.stripe_session_id !== sessionId) return u;
    return u.type === "extend_stay"
      ? { ...u, status: "paid", meta: { ...(u.meta ?? {}), extension_lodgify_booking_id: blockingBookingId } }
      : { ...u, status: "paid" };
  });

  await admin
    .from("registration")
    .update({
      check_out_date: newCheckOutDate,
      total_amount_cents: newTotal,
      tax_amount_cents: newTax,
      nightly_rates_snapshot: newSnapshot,
      upsells: paidUpsells,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reg.id);

  await admin.from("registration_update_log").insert({
    registration_id: reg.id,
    changed_by: "guest",
    change_type: "extended_stay",
    summary: `Checkout extended ${baseline} → ${newCheckOutDate} (+${extraNights} night${extraNights !== 1 ? "s" : ""}, +$${((target.price_cents || 0) / 100).toFixed(2)})`,
    previous_data: {
      check_out_date: baseline,
      total_amount_cents: reg.total_amount_cents,
      tax_amount_cents: reg.tax_amount_cents,
    },
    new_data: {
      check_out_date: newCheckOutDate,
      total_amount_cents: newTotal,
      tax_amount_cents: newTax,
    },
  });

  // Notify the host (awaited — serverless freezes after the response). Cleaner
  // turnover auto-tracks the new checkout via the day-of-checkout cron.
  await notifyHostOfBookingChange({
    propertyId: reg.property_id as string,
    registrationId: reg.id as string,
    guestName: guest?.full_name ?? "Guest",
    summary: `Extended checkout to ${newCheckOutDate} (+${extraNights} night${extraNights !== 1 ? "s" : ""}, $${((target.price_cents || 0) / 100).toFixed(2)})${bundledLate ? ` + ${bundledLate.label ?? "late checkout"}` : ""}`,
  }).catch(() => {});

  return { ok: true, newCheckOutDate };
}
