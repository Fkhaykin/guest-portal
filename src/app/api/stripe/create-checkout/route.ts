import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { serviceId, registrationId, propertySlug } = await request.json();

  // Get the service details
  const { data: service } = await supabase
    .from("service")
    .select("*")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Get the guest record
  const { data: guest } = await supabase
    .from("guest")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!guest) {
    return NextResponse.json(
      { error: "Guest profile not found" },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: service.currency,
          product_data: {
            name: service.name,
            description: service.description || undefined,
          },
          unit_amount: service.price_cents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/p/${propertySlug}/services?success=true`,
    cancel_url: `${appUrl}/p/${propertySlug}/services?cancelled=true`,
    metadata: {
      service_id: serviceId,
      guest_id: guest.id,
      registration_id: registrationId || "",
      property_slug: propertySlug,
    },
  });

  // Create a pending payment record
  await supabase.from("payment").insert({
    service_id: serviceId,
    guest_id: guest.id,
    registration_id: registrationId || null,
    stripe_checkout_session_id: session.id,
    amount_cents: service.price_cents,
    currency: service.currency,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
