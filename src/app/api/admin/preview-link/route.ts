import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signGuestToken } from "@/lib/guest-token";

/**
 * GET /api/admin/preview-link?reg=REGISTRATION_ID
 * Returns a signed guest-portal preview URL.
 * Requires admin (host) auth session.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const regId = searchParams.get("reg");
  if (!regId) {
    return NextResponse.json({ error: "reg is required" }, { status: 400 });
  }

  const token = signGuestToken(regId);

  return NextResponse.json({ token });
}
