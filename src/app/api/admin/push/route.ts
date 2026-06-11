import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebPushSubscriptionJson } from "@/types/database";

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

export async function POST(request: Request) {
  const host = await requireHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subscription?: WebPushSubscriptionJson };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json(
      { error: "A valid push subscription is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscription").upsert(
    {
      host_id: host.id,
      cleaner_id: null,
      endpoint: subscription.endpoint,
      subscription,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] Failed to save host subscription:", error.message);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const host = await requireHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("push_subscription")
    .delete()
    .eq("host_id", host.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
