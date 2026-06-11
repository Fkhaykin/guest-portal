import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { validateTimingUpsellPrices } from "@/lib/upsells/timing";

export async function POST(request: Request) {
  let body: {
    registration_id: string;
    items: Array<{
      type: string;
      label: string;
      price_cents: number;
      meta?: Record<string, unknown>;
    }>;
    return_path?: string;
    return_query?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, items, return_path, return_query } = body;

  if (!registration_id || !items || items.length === 0) {
    return NextResponse.json({ error: "registration_id and items are required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Verify registration exists
  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id, upsells, check_in_date, check_out_date")
    .eq("id", registration_id)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Enforce authoritative server-side pricing for timing upsells (holiday surcharge).
  const priceError = validateTimingUpsellPrices(items, reg.check_in_date, reg.check_out_date);
  if (priceError) {
    return NextResponse.json({ error: priceError }, { status: 400 });
  }

  // Get property slug for redirect
  const { data: property } = await supabase
    .from("property")
    .select("slug")
    .eq("id", reg.property_id)
    .single();

  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const appUrl = `${proto}://${host}`;
  const slug = property?.slug || "";
  const returnPage = return_path || "register";

  // Build Stripe line items
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.label,
      },
      unit_amount: item.price_cents,
    },
    quantity: 1,
  }));

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${appUrl}/p/${slug}/${returnPage}?upsell_success=true&session_id={CHECKOUT_SESSION_ID}${return_query ? `&${return_query}` : ""}`,
    cancel_url: `${appUrl}/p/${slug}/${returnPage}?upsell_cancelled=true${return_query ? `&${return_query}` : ""}`,
    metadata: {
      registration_id,
      upsell_types: items.map((i) => i.type).join(","),
    },
  });

  // Store pending upsells on registration
  const existingUpsells = (reg.upsells as Array<Record<string, unknown>>) || [];
  const newUpsells = items.map((item) => ({
    type: item.type,
    label: item.label,
    price_cents: item.price_cents,
    stripe_session_id: session.id,
    status: "pending",
    meta: item.meta || null,
  }));

  await supabase
    .from("registration")
    .update({
      upsells: [...existingUpsells, ...newUpsells],
    })
    .eq("id", reg.id);

  return NextResponse.json({ url: session.url });
}
