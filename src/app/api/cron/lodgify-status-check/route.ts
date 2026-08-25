import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingById } from "@/lib/lodgify/client";
import { notifyHostOfCalendarHoldLost } from "@/lib/push/notify-host";

export const maxDuration = 60;

// GET /api/cron/lodgify-status-check
// Daily watchdog for locally-created (direct/admin) bookings. A booking we
// pushed to Lodgify only blocks the calendar while its Lodgify status is
// "Booked" — Lodgify has been observed silently flipping a pushed booking to
// "Open" (which frees the dates for sale) with no webhook we act on. This scan
// flags every active upcoming direct/admin registration that is either missing
// from Lodgify or sitting in a non-Booked status, and alerts the host via push
// and email. It alerts again every day until the hold is restored.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: regs, error } = await supabase
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, lodgify_booking_id, lodgify_sync_status, guest:guest_id(full_name), property:property_id(nickname, name, host_id)"
    )
    .in("booking_source", ["direct", "admin"])
    .eq("status", "active")
    .gte("check_out_date", todayIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Flagged = {
    registrationId: string;
    propertyId: string;
    propertyName: string;
    hostId: string | null;
    guestName: string;
    checkIn: string;
    checkOut: string;
    problem: string;
  };
  const flagged: Flagged[] = [];

  for (const reg of regs ?? []) {
    const guest = reg.guest as unknown as { full_name: string } | null;
    const property = reg.property as unknown as {
      nickname: string | null;
      name: string;
      host_id: string | null;
    } | null;

    let problem: string | null = null;
    if (!reg.lodgify_booking_id) {
      problem = `not on Lodgify at all (sync status: ${reg.lodgify_sync_status ?? "unknown"})`;
    } else {
      try {
        const booking = await getBookingById(reg.lodgify_booking_id);
        // "Booked" holds the calendar; "CheckedOut" is fine for a stay that is
        // wrapping up. Anything else (Open, Tentative, Declined, Cancelled)
        // means the dates are back on sale.
        if (booking.status !== "Booked" && booking.status !== "CheckedOut") {
          problem = `Lodgify booking ${reg.lodgify_booking_id} is "${booking.status}" — dates are NOT held`;
        }
      } catch {
        problem = `Lodgify booking ${reg.lodgify_booking_id} could not be fetched (deleted?)`;
      }
    }

    if (problem) {
      flagged.push({
        registrationId: reg.id,
        propertyId: reg.property_id,
        propertyName: property?.nickname || property?.name || "Unknown property",
        hostId: property?.host_id ?? null,
        guestName: guest?.full_name ?? "Unknown guest",
        checkIn: reg.check_in_date,
        checkOut: reg.check_out_date,
        problem,
      });
    }
  }

  // Push per flagged booking, then one summary email per host as a backstop
  // (push subscriptions can be stale; the email always lands).
  for (const f of flagged) {
    await notifyHostOfCalendarHoldLost({
      propertyId: f.propertyId,
      registrationId: f.registrationId,
      guestName: f.guestName,
      checkIn: f.checkIn,
      checkOut: f.checkOut,
      problem: f.problem,
    }).catch((err) =>
      console.error(`[lodgify-status-check] push failed for ${f.registrationId}:`, err)
    );
  }

  if (flagged.length > 0) {
    const byHost = new Map<string, Flagged[]>();
    for (const f of flagged) {
      if (!f.hostId) continue;
      byHost.set(f.hostId, [...(byHost.get(f.hostId) ?? []), f]);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const [hostId, items] of byHost) {
      const { data: host } = await supabase
        .from("host")
        .select("email")
        .eq("id", hostId)
        .single();
      if (!host?.email) continue;

      const lines = items.map(
        (f) =>
          `- ${f.propertyName}: ${f.guestName}, ${f.checkIn} to ${f.checkOut} — ${f.problem}`
      );
      const { error: emailErr } = await resend.emails.send({
        from: "Summit Lakeside <contact@summitlakeside.com>",
        to: host.email,
        subject: `ALERT: ${items.length} paid booking${items.length === 1 ? "" : "s"} not held on the Lodgify calendar`,
        text: `The daily Lodgify status check found confirmed direct/admin bookings whose dates are not blocked on the calendar. Anyone can book these dates on the website or Airbnb until this is fixed.\n\n${lines.join(
          "\n"
        )}\n\nFix: open each booking in Lodgify — if its status is Open it cannot be flipped back to Booked; delete it and re-push (or re-create it as Booked). This alert repeats daily until the hold is restored.`,
      });
      if (emailErr) {
        console.error(`[lodgify-status-check] email failed for host ${hostId}:`, emailErr.message);
      }
    }
  }

  console.log(
    `[lodgify-status-check] checked=${regs?.length ?? 0} flagged=${flagged.length}`
  );
  return NextResponse.json({
    checked: regs?.length ?? 0,
    flagged: flagged.map(({ hostId: _hostId, ...rest }) => rest),
  });
}
