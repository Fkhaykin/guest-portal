import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared-admin-PIN gate for the kiosk house selector (kiosk.summitlakeside.com).
//
// One PIN (KIOSK_ADMIN_PIN) unlocks the picker on a fresh tablet. Picking a
// house exchanges the same PIN for that house's device_key — the per-house key
// the kiosk payload is gated on — so the operator never needs each house's
// individual setup PIN. Selecting is a two-step call on the same endpoint:
//   { pin }          -> validate + return the house list (no keys)
//   { pin, token }   -> validate + return that house's device_key
//
// Matches /api/kiosk/[token]/device: slow wrong guesses, generic errors.

const WRONG_PIN_DELAY_MS = 1500;

function pinMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first, still constant-ish
  // for equal-length wrong PINs (the realistic 6-digit case).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const adminPin = process.env.KIOSK_ADMIN_PIN;
  if (!adminPin) {
    return NextResponse.json(
      { error: "Kiosk admin PIN is not configured" },
      { status: 500 },
    );
  }

  let body: { pin?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pin = (body.pin ?? "").trim();
  if (!pin) {
    return NextResponse.json({ error: "pin is required" }, { status: 400 });
  }

  if (!pinMatches(pin, adminPin)) {
    await new Promise((r) => setTimeout(r, WRONG_PIN_DELAY_MS));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Step 2: exchange for a specific house's device key.
  const token = body.token?.trim();
  if (token) {
    const { data: kiosk } = await admin
      .from("kiosk")
      .select("device_key")
      .eq("token", token)
      .maybeSingle();
    if (!kiosk) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ device_key: kiosk.device_key });
  }

  // Step 1: list the houses to choose from. Group by nickname so the two
  // duplicate property rows (Lakehouse, Chalet) don't show as two kiosks —
  // one kiosk row per house already, but dedupe defensively on name.
  const { data: kiosks } = await admin
    .from("kiosk")
    .select("token, property:property_id(name, nickname, slug)");

  const seen = new Set<string>();
  const houses = (kiosks ?? [])
    .map((k) => {
      const p = Array.isArray(k.property) ? k.property[0] : k.property;
      const rawName = p?.nickname || p?.name || "House";
      return {
        token: k.token as string,
        name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
        slug: (p?.slug as string) ?? null,
      };
    })
    .filter((h) => {
      const key = h.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ houses });
}
