import { NextResponse } from "next/server";
import { submitPEPOAEmail } from "@/lib/pepoa/submit-email";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Allow internal server-to-server calls (service role) or authenticated admin sessions
  const authHeader = request.headers.get("authorization");
  const isInternalCall =
    authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isInternalCall) {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { registration_id: string; is_update?: boolean; change_summary?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, is_update, change_summary } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "Missing registration_id" }, { status: 400 });
  }

  try {
    await submitPEPOAEmail({
      registrationId: registration_id,
      isUpdate: is_update,
      changeSummary: change_summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Registration not found") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    console.error("Failed to send registration PDF email:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
