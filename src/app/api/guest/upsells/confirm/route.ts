import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { verifyGuestToken } from "@/lib/guest-token";

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
    .select("id, upsells, pets, pending_pets")
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

  return NextResponse.json({ ok: true, upsells: updated.filter((u) => u.status === "paid") });
}
