import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Exchange the house's setup PIN for its device key. The key — not the PIN —
// is what an authorized kiosk stores (localStorage) and sends on payload
// fetches, so rotating the PIN never de-authorizes devices in the field.

// Slow down guessing: a 6-digit space behind 1.5s/attempt is far beyond the
// casual "guest retypes the URL at home" threat this gate exists for.
const WRONG_PIN_DELAY_MS = 1500;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const pin = (body.pin ?? "").trim();
  if (!pin) {
    return NextResponse.json({ error: "pin is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: kiosk } = await admin
    .from("kiosk")
    .select("pin, device_key")
    .eq("token", token)
    .maybeSingle();
  // Generic 404 — don't reveal whether the token or the route is wrong.
  if (!kiosk) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pin !== kiosk.pin) {
    await new Promise((r) => setTimeout(r, WRONG_PIN_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  return NextResponse.json({ device_key: kiosk.device_key });
}
