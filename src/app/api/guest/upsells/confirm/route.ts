import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";
import { notifyCleanersOfEarlyCheckin, notifyCleanersOfLateCheckout } from "@/lib/sms/notify-cleaners";
import { notifyHostOfUpsellPurchase } from "@/lib/push/notify-host";

export async function POST(request: Request) {
  let body: { session_id: string; registration_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, registration_id } = body;
  if (!session_id || !registration_id) {
    return NextResponse.json({ error: "session_id and registration_id are required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the Stripe session is paid and belongs to this registration
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
  }
  if (session.metadata?.registration_id !== registration_id) {
    return NextResponse.json({ error: "Session does not match registration" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: reg } = await supabase
    .from("registration")
    .select("id, upsells, pets, pending_pets, property_id, check_in_date, check_out_date, guest:guest_id(full_name)")
    .eq("id", registration_id)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Mark matching pending upsells as paid
  const upsells = (reg.upsells as Array<{ stripe_session_id?: string; status: string; [key: string]: unknown }>) || [];
  const updated = upsells.map((u) => {
    if (u.stripe_session_id === session_id && u.status === "pending") {
      return { ...u, status: "paid" };
    }
    return u;
  });

  const registrationUpdate: Record<string, unknown> = { upsells: updated };

  // If a pet fee was just paid, move pending_pets into pets
  const petFeeJustPaid = updated.some(
    (u) => u.stripe_session_id === session_id && u.type === "pet_fee" && u.status === "paid"
  );
  if (petFeeJustPaid && reg.pending_pets) {
    const currentPets = (reg.pets as Array<Record<string, unknown>>) || [];
    const pending = (reg.pending_pets as Array<Record<string, unknown>>) || [];
    registrationUpdate.pets = [...currentPets, ...pending];
    registrationUpdate.pending_pets = null;
  }

  await supabase
    .from("registration")
    .update(registrationUpdate)
    .eq("id", reg.id);

  // Notify cleaners of timing upsells just confirmed
  const justPaid = updated.filter(
    (u) => u.stripe_session_id === session_id && u.status === "paid"
  );
  const guestRow = reg.guest as unknown as { full_name: string } | null;
  const guestName = guestRow?.full_name ?? "Guest";

  // Awaited — Vercel freezes the function once the response is returned,
  // killing fire-and-forget sends mid-flight.
  for (const u of justPaid) {
    if (u.type === "early_checkin" && reg.check_in_date) {
      await notifyCleanersOfEarlyCheckin({
        propertyId: reg.property_id,
        registrationId: reg.id,
        guestName,
        checkIn: reg.check_in_date as string,
      }).catch(() => {});
    }
    if (u.type === "late_checkout" && reg.check_out_date) {
      await notifyCleanersOfLateCheckout({
        propertyId: reg.property_id,
        registrationId: reg.id,
        guestName,
        checkOut: reg.check_out_date as string,
      }).catch(() => {});
    }
  }

  if (justPaid.length > 0) {
    await notifyHostOfUpsellPurchase({
      propertyId: reg.property_id,
      guestName,
      labels: justPaid.map((u) => (u.label as string) || (u.type as string)),
      totalCents: justPaid.reduce((sum, u) => sum + (Number(u.price_cents) || 0), 0),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, upsells: updated.filter((u) => u.status === "paid") });
}
