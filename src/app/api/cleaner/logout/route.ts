import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionToken, clearSessionCookie } from "@/lib/cleaner/session";

export async function POST() {
  const token = await getSessionToken();

  if (token) {
    const supabase = createAdminClient();
    await supabase.from("cleaner_session").delete().eq("token", token);
    await clearSessionCookie();
  }

  return NextResponse.json({ ok: true });
}
