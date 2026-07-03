import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Accepts a bare Airbnb id or any airbnb.com/rooms/<id> URL. */
function parseAirbnbId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/airbnb\.[a-z.]+\/rooms\/(?:plus\/)?(\d+)/i);
  return m ? m[1] : null;
}

// POST /api/admin/pricing-lab/comps — add a comp listing to a house's set.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nickname: string; airbnb: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.nickname || !body.airbnb) {
    return NextResponse.json({ error: "nickname and airbnb (id or URL) required" }, { status: 400 });
  }
  const airbnbId = parseAirbnbId(body.airbnb);
  if (!airbnbId) {
    return NextResponse.json({ error: "Could not parse an Airbnb listing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: comp, error } = await admin
    .from("comp_listing")
    .insert({
      nickname: body.nickname,
      airbnb_id: airbnbId,
      label: body.label?.trim() || null,
      url: `https://www.airbnb.com/rooms/${airbnbId}`,
    })
    .select("id, airbnb_id, label, url, is_self, is_active, last_scraped_at, last_error")
    .single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ comp });
}

// DELETE /api/admin/pricing-lab/comps?id=<uuid> — remove a comp (and its snapshots, via cascade).
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("comp_listing").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
