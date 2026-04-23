import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMessagesForBooking, fetchThreadMessages } from "@/lib/lodgify/messages";

// Pulls thread history from Lodgify for registrations and persists into our
// guest_message / guest_message_thread tables. Batched to stay under serverless
// function time limits — call repeatedly with the returned next_offset until
// { done: true }. Set onlyMissing=true to skip threads that already have
// messages stored (fastest first-run pass; leave off for a full refresh).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10") || 10, 25);
  const onlyMissing = url.searchParams.get("onlyMissing") !== "false";

  const admin = createAdminClient();

  const { data: regs, error, count } = await admin
    .from("registration")
    .select(
      "id, lodgify_booking_id, lodgify_thread_uid",
      { count: "exact" }
    )
    .not("lodgify_booking_id", "is", null)
    .order("check_in_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  let threadsUpdated = 0;
  let messagesWritten = 0;
  const errors: Array<{ booking_id: number; error: string }> = [];

  for (const reg of regs ?? []) {
    const bookingId = reg.lodgify_booking_id as number | null;
    if (!bookingId) continue;
    processed++;

    try {
      // Skip threads we already have if the caller asked for incremental.
      if (onlyMissing && reg.lodgify_thread_uid) {
        const { count: existing } = await admin
          .from("guest_message")
          .select("*", { count: "exact", head: true })
          .eq("thread_uid", reg.lodgify_thread_uid);
        if ((existing ?? 0) > 0) continue;
      }

      // fetchMessagesForBooking resolves thread_uid internally via the v2
      // booking detail, then fetches the thread. We re-resolve the thread_uid
      // here so we can persist it on the registration.
      let threadUid = reg.lodgify_thread_uid ?? null;
      let messages = await fetchMessagesForBooking(bookingId);
      if (!threadUid) {
        try {
          const res = await fetch(
            `https://api.lodgify.com/v2/reservations/bookings/${bookingId}`,
            {
              headers: {
                "X-ApiKey": process.env.LODGIFY_API_KEY ?? "",
                Accept: "application/json",
              },
              cache: "no-store",
            }
          );
          if (res.ok) {
            const detail = (await res.json()) as { thread_uid?: string };
            threadUid = detail.thread_uid ?? null;
          }
        } catch {
          // ignore; we'll just skip upsert below
        }
        if (threadUid) {
          await admin
            .from("registration")
            .update({ lodgify_thread_uid: threadUid })
            .eq("id", reg.id);
        }
      }

      if (!threadUid) continue;

      // If fetchMessagesForBooking returned nothing (e.g. Lodgify paged
      // something oddly), do one more direct thread fetch.
      if (!messages.length) {
        messages = await fetchThreadMessages(threadUid);
      }

      const rows = messages
        .filter((m) => m.id && /^\d+$/.test(m.id))
        .map((m) => ({
          lodgify_message_id: Number(m.id),
          thread_uid: threadUid!,
          lodgify_booking_id: bookingId,
          message_type: m.type || "Comment",
          subject: m.subject ?? null,
          message: m.message ?? "",
          creation_time: m.created_at || null,
          guest_name: m.type === "Owner" ? null : m.sender_name,
        }));

      if (rows.length) {
        const { error: msgErr } = await admin
          .from("guest_message")
          .upsert(rows, { onConflict: "lodgify_message_id", ignoreDuplicates: false });
        if (msgErr) throw new Error(msgErr.message);
        messagesWritten += rows.length;

        const latest = [...messages].sort((a, b) =>
          (b.created_at || "").localeCompare(a.created_at || "")
        )[0];
        await admin
          .from("guest_message_thread")
          .upsert(
            {
              thread_uid: threadUid,
              lodgify_booking_id: bookingId,
              last_message_at: latest?.created_at || null,
              last_message_preview: (latest?.message ?? "").slice(0, 200),
              guest_name: latest && latest.type !== "Owner" ? latest.sender_name : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "thread_uid" }
          );
        threadsUpdated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push({ booking_id: bookingId, error: message });
    }
  }

  const total = count ?? 0;
  const nextOffset = offset + (regs?.length ?? 0);
  const done = nextOffset >= total || (regs?.length ?? 0) < limit;

  return NextResponse.json({
    processed,
    threadsUpdated,
    messagesWritten,
    errors,
    total,
    next_offset: done ? null : nextOffset,
    done,
  });
}
