import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingQuote } from "@/lib/pricing/booking-quote";
import {
  createAndFinalizeBookingInvoice,
  getOrCreateStripeCustomer,
} from "@/lib/stripe/booking-invoices";
import { sendBookingInvoiceEmail } from "@/lib/email/send-booking-invoice";

const SPLIT_MIN_LEAD_DAYS = 60;
const INVOICE_DUE_DAYS = 7;

export async function POST(request: NextRequest) {
  // Admin auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    property_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone?: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    num_pets?: number;
    payment_plan: "full" | "split";
    discount_cents?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validation
  if (!body.property_id || !body.guest_name?.trim() || !body.guest_email?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!body.check_in_date || !body.check_out_date) {
    return NextResponse.json({ error: "Check-in and check-out dates required" }, { status: 400 });
  }
  if (body.check_out_date <= body.check_in_date) {
    return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
  }
  if (body.payment_plan !== "full" && body.payment_plan !== "split") {
    return NextResponse.json({ error: "Invalid payment plan" }, { status: 400 });
  }

  // Days until check-in
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const checkInTs = new Date(body.check_in_date + "T00:00:00Z").getTime();
  const daysUntilCheckin = Math.round((checkInTs - today.getTime()) / 86_400_000);

  if (body.payment_plan === "split" && daysUntilCheckin < SPLIT_MIN_LEAD_DAYS) {
    return NextResponse.json(
      { error: `Split payment requires check-in to be at least ${SPLIT_MIN_LEAD_DAYS} days out` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Load property
  const { data: property } = await admin
    .from("property")
    .select("id, name, nickname, lodgify_property_id, guest_cleaning_fee_cents, guest_pet_fee_cents")
    .eq("id", body.property_id)
    .single();
  if (!property || !property.lodgify_property_id) {
    return NextResponse.json({ error: "Property not found or missing Lodgify mapping" }, { status: 404 });
  }

  // Re-quote on the server so the admin can't tamper with totals from the client.
  let quote;
  try {
    quote = await buildBookingQuote({
      lodgifyPropertyId: property.lodgify_property_id,
      checkIn: body.check_in_date,
      checkOut: body.check_out_date,
      guests: body.num_guests || 2,
      pets: body.num_pets ?? 0,
      cleaningFeeCents: property.guest_cleaning_fee_cents || 0,
      petFeeCents: property.guest_pet_fee_cents || 0,
      discountCents: body.discount_cents ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build quote";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (quote.totalCents <= 0) {
    return NextResponse.json({ error: "Total must be positive" }, { status: 400 });
  }

  // Find or create guest
  const email = body.guest_email.trim().toLowerCase();
  const phone = body.guest_phone?.trim() || null;
  const fullName = body.guest_name.trim();

  let guestId: string;
  const { data: existingGuest } = await admin
    .from("guest")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingGuest) {
    guestId = existingGuest.id;
    await admin.from("guest").update({ full_name: fullName, phone }).eq("id", guestId);
  } else {
    const { data: newGuest, error: guestErr } = await admin
      .from("guest")
      .insert({ full_name: fullName, email, phone })
      .select("id")
      .single();
    if (guestErr || !newGuest) {
      return NextResponse.json({ error: "Failed to create guest" }, { status: 500 });
    }
    guestId = newGuest.id;
  }

  // Create registration in pending_payment with the full breakdown.
  const { data: registration, error: regErr } = await admin
    .from("registration")
    .insert({
      property_id: body.property_id,
      guest_id: guestId,
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      num_guests: body.num_guests || 1,
      lodgify_num_pets: body.num_pets ?? 0,
      status: "pending_payment",
      booking_source: "admin",
      total_amount_cents: quote.totalCents,
      cleaning_fee_cents: quote.cleaningFeeCents,
      tax_amount_cents: quote.taxTotalCents,
      pet_fee_total_cents: quote.petFeeTotalCents,
      discount_cents: quote.discountCents,
      nightly_rates_snapshot: quote.nightlyRates,
      payment_plan: body.payment_plan,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (regErr || !registration) {
    console.error("[admin/bookings/create] Registration insert failed:", regErr);
    return NextResponse.json(
      { error: "Failed to create booking", details: regErr?.message },
      { status: 500 }
    );
  }

  // Stripe customer
  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer({
      existingCustomerId: null,
      email,
      name: fullName,
      phone,
      guestId,
    });
  } catch (err) {
    console.error("[admin/bookings/create] Stripe customer error:", err);
    return NextResponse.json({ error: "Failed to set up Stripe customer" }, { status: 500 });
  }

  const isSplit = body.payment_plan === "split";
  const dueNowCents = isSplit ? Math.round(quote.totalCents / 2) : quote.totalCents;
  const propertyLabel = property.nickname || property.name;
  const description = isSplit
    ? `Deposit (50%) — ${propertyLabel}, ${body.check_in_date} to ${body.check_out_date}`
    : `Booking — ${propertyLabel}, ${body.check_in_date} to ${body.check_out_date}`;

  // Create + finalize the deposit/full invoice
  let invoice;
  try {
    invoice = await createAndFinalizeBookingInvoice({
      customerId,
      registrationId: registration.id,
      amountCents: dueNowCents,
      phase: isSplit ? "deposit" : "full",
      description,
      daysUntilDue: INVOICE_DUE_DAYS,
    });
  } catch (err) {
    console.error("[admin/bookings/create] Stripe invoice error:", err);
    await admin.from("registration").delete().eq("id", registration.id);
    return NextResponse.json({ error: "Failed to create Stripe invoice" }, { status: 500 });
  }

  await admin
    .from("registration")
    .update({
      stripe_customer_id: customerId,
      stripe_deposit_invoice_id: invoice.id,
    })
    .eq("id", registration.id);

  const balanceDueDate = isSplit
    ? new Date(checkInTs - 30 * 86_400_000).toISOString().slice(0, 10)
    : undefined;

  if (invoice.hosted_invoice_url) {
    try {
      await sendBookingInvoiceEmail({
        to: email,
        guestName: fullName,
        propertyName: propertyLabel,
        checkInDate: body.check_in_date,
        checkOutDate: body.check_out_date,
        amountCents: dueNowCents,
        totalCents: quote.totalCents,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        isDeposit: isSplit,
        balanceDueDate,
      });
    } catch (err) {
      console.error("[admin/bookings/create] Invoice email failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    registration_id: registration.id,
    hosted_invoice_url: invoice.hosted_invoice_url,
    amount_due_now_cents: dueNowCents,
    total_cents: quote.totalCents,
    balance_due_date: balanceDueDate ?? null,
  });
}
