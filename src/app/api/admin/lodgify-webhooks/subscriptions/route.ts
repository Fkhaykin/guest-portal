import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listWebhookSubscriptions,
  subscribeWebhook,
  unsubscribeWebhook,
} from "@/lib/lodgify/client";

async function requireHost() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 };
  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) return { error: "Forbidden" as const, status: 403 };
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireHost();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const subscriptions = await listWebhookSubscriptions();
    return NextResponse.json({ subscriptions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireHost();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { event, target_url } = (await request.json()) as {
    event?: string;
    target_url?: string;
  };
  if (!event || !target_url) {
    return NextResponse.json({ error: "event and target_url are required" }, { status: 400 });
  }

  try {
    const result = await subscribeWebhook({ event, target_url });
    return NextResponse.json({ subscription: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireHost();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  try {
    await unsubscribeWebhook(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
