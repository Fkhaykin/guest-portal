import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ confirmed: false });
    }

    const registrationId = session.metadata?.registration_id;
    if (!registrationId) {
      return NextResponse.json({ confirmed: false });
    }

    const supabase = createAdminClient();

    // Ensure registration is marked active (webhook may not have fired yet)
    await supabase
      .from("registration")
      .update({ status: "active" })
      .eq("id", registrationId)
      .eq("status", "pending_payment");

    // Ensure payment is marked completed
    await supabase
      .from("payment")
      .update({
        status: "completed",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
      })
      .eq("stripe_checkout_session_id", sessionId)
      .eq("status", "pending");

    // Fetch registration details
    const { data: reg } = await supabase
      .from("registration")
      .select("id, check_in_date, check_out_date, num_guests, total_amount_cents, guest:guest_id(full_name)")
      .eq("id", registrationId)
      .single();

    if (!reg) {
      return NextResponse.json({ confirmed: false });
    }

    const guest = reg.guest as unknown as { full_name: string } | null;

    return NextResponse.json({
      confirmed: true,
      registration_id: reg.id,
      check_in: reg.check_in_date,
      check_out: reg.check_out_date,
      guests: reg.num_guests,
      amount_cents: reg.total_amount_cents,
      guest_name: guest?.full_name || "Guest",
    });
  } catch {
    return NextResponse.json({ confirmed: false }, { status: 500 });
  }
}
