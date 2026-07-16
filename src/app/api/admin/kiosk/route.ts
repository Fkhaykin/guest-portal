import { NextResponse } from "next/server";
import { randomInt, randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUrlQRCodePNG, generateUrlQRCodeSVG } from "@/lib/qr/generate";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function requireHost() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return host;
}

/** Fetch (creating if missing) the kiosk token for a property. The kiosk
 *  table has no RLS policies — host access goes through this route. */
export async function GET(request: Request) {
  const host = await requireHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const propertyId = url.searchParams.get("property_id");
  if (!propertyId) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let { data: kiosk } = await admin
    .from("kiosk")
    .select("token, pin, rotated_at, wifi_ssid, wifi_password")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!kiosk) {
    const { data: created, error } = await admin
      .from("kiosk")
      .insert({ property_id: propertyId })
      .select("token, pin, rotated_at, wifi_ssid, wifi_password")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }
    kiosk = created;
  }

  const kioskUrl = `${APP_URL}/kiosk/${kiosk.token}`;
  // The configured start URL carries the PIN so browsers that clear storage
  // between sessions (Edge kiosk mode) re-authorize on every boot; the page
  // scrubs it from the address bar immediately.
  const startUrl = `${kioskUrl}?pin=${kiosk.pin}`;

  if (url.searchParams.get("format") === "png") {
    const png = await generateUrlQRCodePNG(startUrl);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="kiosk-qr.png"`,
      },
    });
  }

  return NextResponse.json({
    token: kiosk.token,
    url: kioskUrl,
    start_url: startUrl,
    pin: kiosk.pin,
    rotated_at: kiosk.rotated_at,
    wifi_ssid: kiosk.wifi_ssid ?? "",
    wifi_password: kiosk.wifi_password ?? "",
    svg: await generateUrlQRCodeSVG(startUrl),
  });
}

/** Rotate credentials. target "token" (default) swaps the URL — every device
 *  using the old one stops working. target "pin" swaps only the setup PIN;
 *  devices already authorized keep working (their device_key is unchanged). */
export async function POST(request: Request) {
  const host = await requireHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    property_id?: string;
    target?: "token" | "pin" | "wifi";
    wifi_ssid?: string;
    wifi_password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.property_id) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Save the per-house guest Wi-Fi shown on the kiosk welcome screen. Blank
  // clears it (the card hides when there's no SSID).
  const patch =
    body.target === "wifi"
      ? {
          wifi_ssid: (body.wifi_ssid ?? "").trim() || null,
          wifi_password: (body.wifi_password ?? "").trim() || null,
        }
      : body.target === "pin"
      ? { pin: randomInt(0, 1_000_000).toString().padStart(6, "0") }
      : { token: randomUUID(), rotated_at: new Date().toISOString() };

  const { data: kiosk, error } = await admin
    .from("kiosk")
    .update(patch)
    .eq("property_id", body.property_id)
    .select("token, pin, rotated_at, wifi_ssid, wifi_password")
    .single();
  if (error || !kiosk) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  const kioskUrl = `${APP_URL}/kiosk/${kiosk.token}`;
  const startUrl = `${kioskUrl}?pin=${kiosk.pin}`;
  return NextResponse.json({
    token: kiosk.token,
    url: kioskUrl,
    start_url: startUrl,
    pin: kiosk.pin,
    rotated_at: kiosk.rotated_at,
    wifi_ssid: kiosk.wifi_ssid ?? "",
    wifi_password: kiosk.wifi_password ?? "",
    svg: await generateUrlQRCodeSVG(startUrl),
  });
}
