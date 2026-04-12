import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { syncLatestBookings } from "@/lib/lodgify/sync";

export const maxDuration = 60;

export async function POST() {
  // Check admin auth (Supabase session)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Check cleaner auth (session cookie)
    const cookieStore = await cookies();
    const token = cookieStore.get("cleaner_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cleaner = await validateCleanerSession(token);
    if (!cleaner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncLatestBookings();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lodgify-refresh] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
