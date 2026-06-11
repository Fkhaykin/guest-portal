import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the calling user to a host. Returns { hostId } on success,
 * or a NextResponse with the appropriate error to return directly.
 */
export async function requireHost(): Promise<
  { hostId: string } | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { hostId: host.id };
}
