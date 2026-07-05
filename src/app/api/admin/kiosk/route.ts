import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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
    .select("token, rotated_at")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!kiosk) {
    const { data: created, error } = await admin
      .from("kiosk")
      .insert({ property_id: propertyId })
      .select("token, rotated_at")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }
    kiosk = created;
  }

  const kioskUrl = `${APP_URL}/kiosk/${kiosk.token}`;

  if (url.searchParams.get("format") === "png") {
    const png = await generateUrlQRCodePNG(kioskUrl);
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
    rotated_at: kiosk.rotated_at,
    svg: await generateUrlQRCodeSVG(kioskUrl),
  });
}

/** Rotate the token — every device using the old URL stops working. */
export async function POST(request: Request) {
  const host = await requireHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { property_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.property_id) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: kiosk, error } = await admin
    .from("kiosk")
    .update({ token: randomUUID(), rotated_at: new Date().toISOString() })
    .eq("property_id", body.property_id)
    .select("token, rotated_at")
    .single();
  if (error || !kiosk) {
    return NextResponse.json({ error: error?.message ?? "Rotate failed" }, { status: 500 });
  }

  const kioskUrl = `${APP_URL}/kiosk/${kiosk.token}`;
  return NextResponse.json({
    token: kiosk.token,
    url: kioskUrl,
    rotated_at: kiosk.rotated_at,
    svg: await generateUrlQRCodeSVG(kioskUrl),
  });
}
