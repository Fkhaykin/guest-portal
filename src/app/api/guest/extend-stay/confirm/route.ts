import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { applyExtension } from "@/lib/upsells/extend-stay";
import { timingUpsellTime } from "@/lib/upsells/timing";

// Fast-path fulfillment when the guest returns from Stripe. Idempotent and shared
// with the webhook, so it's safe if both fire (or the guest refreshes).
export async function POST(request: Request) {
  let body: { session_id: string; registration_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, registration_id } = body;
  if (!session_id || !registration_id) {
    return NextResponse.json(
      { error: "session_id and registration_id are required" },
      { status: 400 }
    );
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await applyExtension(admin, session_id, registration_id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, conflict: result.conflict ?? false },
      { status: result.status }
    );
  }
  // Surface a late checkout bundled into the same session so the success
  // screen can confirm both purchases at once.
  const { data: reg } = await admin
    .from("registration")
    .select("upsells")
    .eq("id", registration_id)
    .single();
  const late = ((reg?.upsells as Array<{ type: string; status: string; stripe_session_id?: string; meta?: Record<string, unknown> | null }> | null) ?? []).find(
    (u) => u.stripe_session_id === session_id && u.type === "late_checkout" && u.status === "paid"
  );
  return NextResponse.json({
    ok: true,
    new_check_out_date: result.newCheckOutDate,
    late_checkout_time: late ? timingUpsellTime(late) : null,
  });
}
