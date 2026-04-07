import { NextResponse } from "next/server";
import { getBookings } from "@/lib/lodgify/client";

export async function POST() {
  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" });

  const PAGE_SIZE = 50;
  let offset = 0;
  const updates: { id: number; amount: number }[] = [];

  while (true) {
    const response = await getBookings({ offset, limit: PAGE_SIZE });

    for (const booking of response.items) {
      try {
        const v2res = await fetch(
          `https://api.lodgify.com/v2/reservations/bookings/${booking.id}`,
          { headers: { "X-ApiKey": apiKey, Accept: "application/json" } }
        );
        const v2 = await v2res.json();
        const stay = v2.subtotals?.stay;
        const total = v2.total_amount;

        // Use stay (rental amount excl. taxes/fees) when available, else total
        const dollars = (stay && stay > 0) ? stay : (total && total > 0) ? total : null;
        if (dollars && dollars > 0) {
          updates.push({ id: booking.id, amount: Math.round(dollars * 100) });
        }
      } catch { /* skip */ }
    }

    offset += response.items.length;
    if (offset >= response.total || response.items.length < PAGE_SIZE) break;
  }

  // Write SQL
  const values = updates.map((u) => `(${u.id}::bigint, ${u.amount}::integer)`).join(",\n  ");
  const sql = `UPDATE registration r SET total_amount_cents = data.amount FROM (VALUES\n  ${values}\n) AS data(booking_id, amount) WHERE r.lodgify_booking_id = data.booking_id;`;

  const totalDollars = updates.reduce((s, u) => s + u.amount, 0) / 100;

  return NextResponse.json({
    count: updates.length,
    totalDollars: Math.round(totalDollars * 100) / 100,
    sql,
  });
}

export async function GET() {
  return NextResponse.json({ message: "POST to run backfill" });
}
