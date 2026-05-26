import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

// Returns the hosted_invoice_url for an already-created Stripe invoice on
// the given registration (full or split plan). Used by /pay/[id] to redirect
// the guest into Stripe checkout.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("registration_id");
  if (!id) {
    return NextResponse.json({ error: "Missing registration_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: registration } = await admin
    .from("registration")
    .select("id, stripe_deposit_invoice_id, deposit_paid_at, balance_paid_at")
    .eq("id", id)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (registration.deposit_paid_at || registration.balance_paid_at) {
    return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
  }
  if (!registration.stripe_deposit_invoice_id) {
    return NextResponse.json({ error: "No invoice yet — please pick a payment plan first." }, { status: 409 });
  }

  try {
    const invoice = await stripe.invoices.retrieve(registration.stripe_deposit_invoice_id);
    if (!invoice.hosted_invoice_url) {
      return NextResponse.json({ error: "Stripe invoice has no hosted URL" }, { status: 502 });
    }
    return NextResponse.json({ hosted_invoice_url: invoice.hosted_invoice_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load invoice";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
