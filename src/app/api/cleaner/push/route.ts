import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import type { WebPushSubscriptionJson } from "@/types/database";

async function requireCleaner() {
  const token = await getSessionToken();
  if (!token) return null;
  return validateCleanerSession(token);
}

export async function POST(request: Request) {
  const cleaner = await requireCleaner();
  if (!cleaner) {
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

  const supabase = createAdminClient();
  const { error } = await supabase.from("push_subscription").upsert(
    {
      cleaner_id: cleaner.id,
      endpoint: subscription.endpoint,
      subscription,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] Failed to save subscription:", error.message);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const cleaner = await requireCleaner();
  if (!cleaner) {
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

  const supabase = createAdminClient();
  await supabase
    .from("push_subscription")
    .delete()
    .eq("cleaner_id", cleaner.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
