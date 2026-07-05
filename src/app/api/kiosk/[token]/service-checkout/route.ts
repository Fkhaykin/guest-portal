import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { resolveKioskProperty } from "@/lib/kiosk";
import { nicknamePropertyIds } from "@/lib/pricing/data";

// Kiosk-native service purchase. The existing /api/stripe/create-checkout
// requires a Supabase-authenticated user (email OTP) — kiosk guests are
// anonymous, so this mirrors it with kiosk-token + guest-token auth and
// returns Stripe back to the kiosk URL instead of the phone portal.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const property = await resolveKioskProperty(admin, token);
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { service_id?: string; registration_id?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { service_id, registration_id } = body;
  if (!service_id || !registration_id) {
    return NextResponse.json(
      { error: "service_id and registration_id are required" },
      { status: 400 }
    );
  }

  const guestToken = request.headers.get("x-guest-token") ?? "";
  if (!guestToken || !verifyGuestToken(registration_id, guestToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: service } = await admin
    .from("service")
    .select("*")
    .eq("id", service_id)
    .eq("property_id", property.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // The registration must belong to this house (either sibling row).
  const houseIds = property.nickname
    ? await nicknamePropertyIds(admin, property.nickname)
    : [property.id];
  const { data: reg } = await admin
    .from("registration")
    .select("id, guest_id, property_id")
    .eq("id", registration_id)
    .maybeSingle();
  if (!reg || !houseIds.includes(reg.property_id)) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Same convention as /api/guest/upsells/checkout: return to the requesting host.
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const appUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL;

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
    // preview=1 survives the round-trip so an admin previewing on a personal
    // device doesn't get flagged as a kiosk when Stripe redirects back.
    success_url: `${appUrl}/kiosk/${token}?service_success=1${body.preview ? "&preview=1" : ""}`,
    cancel_url: `${appUrl}/kiosk/${token}?service_cancelled=1${body.preview ? "&preview=1" : ""}`,
    metadata: {
      service_id,
      guest_id: reg.guest_id,
      registration_id,
      property_slug: property.slug,
    },
  });

  await admin.from("payment").insert({
    service_id,
    guest_id: reg.guest_id,
    registration_id,
    stripe_checkout_session_id: session.id,
    amount_cents: service.price_cents,
    currency: service.currency,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
