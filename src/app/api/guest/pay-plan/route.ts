import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAndFinalizeBookingInvoice,
  getOrCreateStripeCustomer,
} from "@/lib/stripe/booking-invoices";

const SPLIT_MIN_LEAD_DAYS = 60;
const INVOICE_DUE_DAYS = 7;

// Guest-side endpoint used by the /pay/[id] picker page.
// Locks in the chosen plan ("full" | "split") on a registration that was
// created with payment_plan = "automatic" and returns the Stripe hosted
// invoice URL so the picker can redirect to it.
export async function POST(request: NextRequest) {
  let body: { registration_id?: string; plan?: "full" | "split" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.registration_id || (body.plan !== "full" && body.plan !== "split")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: registration } = await admin
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, total_amount_cents, discount_cents, discount_label, payment_plan, status, deposit_paid_at, stripe_deposit_invoice_id, property:property_id(name, nickname), guest:guest_id(full_name, email, phone)"
    )
    .eq("id", body.registration_id)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (registration.payment_plan !== "automatic" || registration.stripe_deposit_invoice_id) {
    return NextResponse.json(
      { error: "This booking already has a payment plan set." },
      { status: 409 }
    );
  }

  if (registration.deposit_paid_at) {
    return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const checkInTs = new Date(registration.check_in_date + "T00:00:00Z").getTime();
  const daysUntilCheckin = Math.round((checkInTs - today.getTime()) / 86_400_000);

  if (body.plan === "split" && daysUntilCheckin < SPLIT_MIN_LEAD_DAYS) {
    return NextResponse.json(
      { error: `Split payment requires check-in to be at least ${SPLIT_MIN_LEAD_DAYS} days out` },
      { status: 400 }
    );
  }

  const guest = Array.isArray(registration.guest) ? registration.guest[0] : registration.guest;
  const property = Array.isArray(registration.property) ? registration.property[0] : registration.property;
  if (!guest?.email) {
    return NextResponse.json({ error: "Guest email missing" }, { status: 400 });
  }

  const propertyLabel = property?.nickname || property?.name || "Booking";
  const totalCents = registration.total_amount_cents;
  const isSplit = body.plan === "split";
  const dueNowCents = isSplit ? Math.round(totalCents / 2) : totalCents;
  const discountCents = registration.discount_cents ?? 0;
  const discountSuffix =
    discountCents > 0 && registration.discount_label
      ? ` (${registration.discount_label} applied)`
      : "";
  const description = isSplit
    ? `Deposit (50%) — ${propertyLabel}, ${registration.check_in_date} to ${registration.check_out_date}${discountSuffix}`
    : `Booking — ${propertyLabel}, ${registration.check_in_date} to ${registration.check_out_date}${discountSuffix}`;

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer({
      existingCustomerId: null,
      email: guest.email,
      name: guest.full_name,
      phone: guest.phone ?? null,
      guestId: registration.id,
    });
  } catch (err) {
    console.error("[guest/pay-plan] Stripe customer error:", err);
    return NextResponse.json({ error: "Failed to set up Stripe customer" }, { status: 500 });
  }

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
    console.error("[guest/pay-plan] Stripe invoice error:", err);
    return NextResponse.json({ error: "Failed to create Stripe invoice" }, { status: 500 });
  }

  await admin
    .from("registration")
    .update({
      payment_plan: body.plan,
      stripe_customer_id: customerId,
      stripe_deposit_invoice_id: invoice.id,
    })
    .eq("id", registration.id);

  return NextResponse.json({
    ok: true,
    hosted_invoice_url: invoice.hosted_invoice_url,
  });
}
