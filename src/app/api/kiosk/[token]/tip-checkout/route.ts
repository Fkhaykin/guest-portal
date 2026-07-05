import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { resolveKioskProperty } from "@/lib/kiosk";
import { nicknamePropertyIds } from "@/lib/pricing/data";

const MIN_TIP_CENTS = 500; // $5
const MAX_TIP_CENTS = 50_000; // $500

// "Tip the Crew" from the kiosk. Mirrors /api/guest/upsells/checkout's
// contract — a pending `tip_cleaning` upsell entry keyed by the Stripe
// session — so the existing /api/guest/upsells/confirm endpoint finalizes it
// (marks paid + notifies the host) when the kiosk regains focus.
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

  let body: { amount_cents?: number; registration_id?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { amount_cents, registration_id } = body;
  if (!registration_id || !amount_cents || !Number.isInteger(amount_cents)) {
    return NextResponse.json(
      { error: "amount_cents and registration_id are required" },
      { status: 400 }
    );
  }
  if (amount_cents < MIN_TIP_CENTS || amount_cents > MAX_TIP_CENTS) {
    return NextResponse.json(
      { error: `Tips must be between $${MIN_TIP_CENTS / 100} and $${MAX_TIP_CENTS / 100}` },
      { status: 400 }
    );
  }

  const guestToken = request.headers.get("x-guest-token") ?? "";
  if (!guestToken || !verifyGuestToken(registration_id, guestToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const houseIds = property.nickname
    ? await nicknamePropertyIds(admin, property.nickname)
    : [property.id];
  const { data: reg } = await admin
    .from("registration")
    .select("id, property_id, upsells")
    .eq("id", registration_id)
    .maybeSingle();
  if (!reg || !houseIds.includes(reg.property_id)) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const label = "Tip — Cleaning Crew";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const appUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL;
  const previewQs = body.preview ? "&preview=1" : "";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: label,
            description: "100% goes to the team that turns the house over",
          },
          unit_amount: amount_cents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/kiosk/${token}?tip_success=1&session_id={CHECKOUT_SESSION_ID}${previewQs}`,
    cancel_url: `${appUrl}/kiosk/${token}?tip_cancelled=1${previewQs}`,
    metadata: {
      registration_id,
      upsell_types: "tip_cleaning",
    },
  });

  const upsells = (reg.upsells as Record<string, unknown>[]) || [];
  await admin
    .from("registration")
    .update({
      upsells: [
        ...upsells,
        {
          type: "tip_cleaning",
          label,
          price_cents: amount_cents,
          stripe_session_id: session.id,
          status: "pending",
        },
      ],
    })
    .eq("id", registration_id);

  return NextResponse.json({ url: session.url });
}
