import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

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

  // Verify the Stripe session is paid
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: reg } = await supabase
    .from("registration")
    .select("id, upsells")
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

  await supabase
    .from("registration")
    .update({ upsells: updated })
    .eq("id", reg.id);

  return NextResponse.json({ ok: true, upsells: updated.filter((u) => u.status === "paid") });
}
