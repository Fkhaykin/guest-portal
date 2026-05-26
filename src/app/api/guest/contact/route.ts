import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Guest-side endpoint used by the /pay/[id] page to let the guest update
// their contact details before paying. Anonymous: scoped by registration_id
// (the link in the invoice email is the only way to reach this page).
export async function POST(request: NextRequest) {
  let body: {
    registration_id?: string;
    guest_id?: string;
    full_name?: string;
    email?: string;
    phone?: string | null;
    mailing_address?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.registration_id || !body.guest_id) {
    return NextResponse.json({ error: "Missing identifiers" }, { status: 400 });
  }
  if (!body.full_name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the guest_id is actually the one on this registration before
  // letting an anonymous caller edit it. Otherwise anyone with a registration
  // ID could rewrite any guest record.
  const { data: registration } = await admin
    .from("registration")
    .select("id, guest_id, deposit_paid_at, balance_paid_at")
    .eq("id", body.registration_id)
    .maybeSingle();

  if (!registration || registration.guest_id !== body.guest_id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (registration.deposit_paid_at || registration.balance_paid_at) {
    return NextResponse.json({ error: "This booking is already paid; contact us to change details." }, { status: 409 });
  }

  const { error } = await admin
    .from("guest")
    .update({
      full_name: body.full_name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.toString().trim() || null,
      mailing_address: body.mailing_address?.toString().trim() || null,
    })
    .eq("id", body.guest_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
