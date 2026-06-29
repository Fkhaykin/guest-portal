import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWebThreadUid, loadWebThread } from "@/lib/guest-messages/web";

// Public, unauthenticated: the web-chat widget polls for new messages. Gated by
// the per-thread token. Returns messages in chronological order; pass ?after=
// (ISO timestamp) to fetch only newer messages.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadUid = searchParams.get("threadUid")?.trim();
  const token = searchParams.get("token")?.trim();
  const after = searchParams.get("after")?.trim();

  if (!threadUid || !isWebThreadUid(threadUid) || !token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const thread = await loadWebThread(threadUid);
  if (!thread || !thread.web_token || thread.web_token !== token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("guest_message")
    .select("id, message_type, message, creation_time")
    .eq("thread_uid", threadUid)
    .order("creation_time", { ascending: true });
  if (after) query = query.gt("creation_time", after);

  const { data: rows } = await query;
  const messages = (rows ?? []).map((r) => ({
    id: String(r.id),
    // The widget renders from the visitor's perspective: their own messages are
    // "Renter", the host's replies are "Owner".
    from: r.message_type === "Owner" ? "host" : "you",
    message: r.message ?? "",
    created_at: r.creation_time ?? "",
  }));

  return NextResponse.json({ messages });
}
