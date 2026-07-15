import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveKioskAccess } from "@/lib/kiosk";
import { normalizePromo, type Promo } from "@/lib/promo/types";

// Browsable portal content for the kiosk's native screens, in one call.
// Service-role client bypasses RLS, so every filter the public pages get for
// free from policies is re-applied here explicitly.

// Mirrors resolve.ts endOfWindow: a plain-date valid_until is inclusive
// through the end of that day.
function endOfWindow(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T23:59:59.999");
  return new Date(value);
}

// property_ids supersedes legacy property_id; null/empty = global. This is
// the engine's scoping (candidates.ts), NOT the promotions page's legacy
// property_id-only .or() filter.
function promoInScope(p: Promo, propertyId: string): boolean {
  const scope =
    p.property_ids && p.property_ids.length
      ? p.property_ids
      : p.property_id
        ? [p.property_id]
        : null;
  return !scope || scope.includes(propertyId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  // FAQs can carry house-sensitive answers (wifi, lockbox…), so this route
  // is PIN-gated like the main payload.
  const access = await resolveKioskAccess(
    admin,
    token,
    request.headers.get("x-kiosk-device")
  );
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!access.authorized) {
    return NextResponse.json({ error: "pin_required" }, { status: 401 });
  }
  const property = access.property;

  const [faqRes, videoRes, serviceRes, promoRes] = await Promise.all([
    admin
      .from("faq")
      .select("id, question, answer, category, sort_order")
      .eq("property_id", property.id)
      .order("sort_order"),
    admin
      .from("video")
      // No storage_path here — playback URLs are minted per-view by the
      // token-gated video endpoint.
      .select("id, title, description, sort_order")
      .eq("property_id", property.id)
      .order("sort_order"),
    admin
      .from("service")
      .select("id, name, description, price_cents, currency, image_url, sort_order")
      .eq("property_id", property.id)
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("promo_code")
      .select("*")
      .eq("is_active", true)
      .eq("show_on_marketing", true)
      .order("featured", { ascending: false })
      .order("sort_order"),
  ]);

  const now = new Date();
  const promos = (promoRes.data ?? [])
    .map((row) => normalizePromo(row))
    .filter(
      (p) =>
        promoInScope(p, property.id) &&
        !(p.valid_until && endOfWindow(p.valid_until) < now)
    );

  return NextResponse.json(
    {
      faqs: faqRes.data ?? [],
      videos: videoRes.data ?? [],
      services: serviceRes.data ?? [],
      promos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
