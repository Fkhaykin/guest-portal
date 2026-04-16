import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order } = (await request.json()) as {
    order: { id: string; sort_order: number }[];
  };
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json(
      { error: "order array is required" },
      { status: 400 }
    );
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Update each property's sort_order (only if owned by this host)
  const updates = order.map(({ id, sort_order }) =>
    admin
      .from("property")
      .update({ sort_order })
      .eq("id", id)
      .eq("host_id", host.id)
  );

  const results = await Promise.all(updates);
  const failed = results.some((r) => r.error);

  if (failed) {
    return NextResponse.json({ error: "Some updates failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
