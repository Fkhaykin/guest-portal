import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

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
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, items, return_path } = body;

  if (!registration_id || !items || items.length === 0) {
    return NextResponse.json({ error: "registration_id and items are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify registration exists
  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id, upsells")
    .eq("id", registration_id)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Get property slug for redirect
  const { data: property } = await supabase
    .from("property")
    .select("slug")
    .eq("id", reg.property_id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
    success_url: `${appUrl}/p/${slug}/${returnPage}?upsell_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/p/${slug}/${returnPage}?upsell_cancelled=true`,
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
