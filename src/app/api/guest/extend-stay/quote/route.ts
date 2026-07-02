import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { quoteExtension } from "@/lib/upsells/extend-stay";

// Price a stay extension to the requested checkout date and confirm the added
// nights are available. Guest-token authenticated, like the other guest routes.
export async function POST(request: Request) {
  let body: { registration_id: string; new_check_out_date: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, new_check_out_date } = body;
  if (!registration_id || !new_check_out_date) {
    return NextResponse.json(
      { error: "registration_id and new_check_out_date are required" },
      { status: 400 }
    );
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await quoteExtension(admin, {
    registrationId: registration_id,
    newCheckOutDate: new_check_out_date,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.quote);
}
