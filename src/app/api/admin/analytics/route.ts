import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const hostResult = await supabase.from("host").select().single();
  if (!hostResult.data) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hostId = hostResult.data.id;

  // Fetch all properties for this host
  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname")
    .eq("host_id", hostId);

  if (!properties || properties.length === 0) {
    return NextResponse.json({ properties: [], charts: {} });
  }

  const propertyIds = properties.map((p) => p.id);
  const propertyNameMap: Record<string, string> = {};
  for (const p of properties) {
    propertyNameMap[p.id] = p.nickname || p.name;
  }

  // Fetch registrations for all properties
  const { data: registrations } = await supabase
    .from("registration")
    .select(
      "id, property_id, check_in_date, check_out_date, num_guests, status, upsells, pets, guest_list, created_at, booking_source"
    )
    .in("property_id", propertyIds);

  // Fetch payments
  const { data: payments } = await supabase
    .from("payment")
    .select("id, registration_id, amount_cents, status, created_at, service_id")
    .eq("status", "completed");

  // Fetch QR scans
  const { data: qrCodes } = await supabase
    .from("qr_code")
    .select("id, property_id, label, scan_count, target_type")
    .in("property_id", propertyIds);

  const regs = registrations ?? [];
  const pays = payments ?? [];
  const qrs = qrCodes ?? [];

  // Build a registration → property map
  const regPropertyMap: Record<string, string> = {};
  for (const r of regs) {
    regPropertyMap[r.id] = r.property_id;
  }

  // --- Chart 1: Revenue over time by property (monthly) ---
  const revenueByMonth: Record<string, Record<string, number>> = {};
  for (const p of pays) {
    const propertyId = p.registration_id
      ? regPropertyMap[p.registration_id]
      : null;
    if (!propertyId) continue;
    const month = p.created_at.slice(0, 7); // YYYY-MM
    if (!revenueByMonth[month]) revenueByMonth[month] = {};
    revenueByMonth[month][propertyId] =
      (revenueByMonth[month][propertyId] ?? 0) + p.amount_cents;
  }

  const revenueMonths = Object.keys(revenueByMonth).sort();
  const revenueOverTime = revenueMonths.map((month) => {
    const entry: Record<string, unknown> = { month };
    let total = 0;
    for (const p of properties) {
      const val = (revenueByMonth[month]?.[p.id] ?? 0) / 100;
      entry[propertyNameMap[p.id]] = val;
      total += val;
    }
    entry["Total"] = total;
    return entry;
  });

  // --- Chart 2: Occupancy % per property (last 12 months) ---
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const totalDays = Math.floor(
    (now.getTime() - twelveMonthsAgo.getTime()) / (1000 * 60 * 60 * 24)
  );

  const occupancyByProperty = properties.map((p) => {
    const propRegs = regs.filter(
      (r) => r.property_id === p.id && r.status !== "cancelled"
    );
    let occupiedDays = 0;
    for (const r of propRegs) {
      const checkIn = new Date(r.check_in_date);
      const checkOut = new Date(r.check_out_date);
      const start = checkIn > twelveMonthsAgo ? checkIn : twelveMonthsAgo;
      const end = checkOut < now ? checkOut : now;
      const days = Math.max(
        0,
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      );
      occupiedDays += days;
    }
    return {
      property: propertyNameMap[p.id],
      occupancy: Math.round((occupiedDays / totalDays) * 100),
    };
  });

  // --- Chart 3: Bookings per month ---
  const bookingsByMonth: Record<string, number> = {};
  for (const r of regs) {
    if (r.status === "cancelled") continue;
    const month = r.check_in_date.slice(0, 7);
    bookingsByMonth[month] = (bookingsByMonth[month] ?? 0) + 1;
  }
  const bookingMonths = Object.keys(bookingsByMonth).sort().slice(-12);
  const bookingsPerMonth = bookingMonths.map((month) => ({
    month,
    bookings: bookingsByMonth[month],
  }));

  // --- Chart 4: Average stay duration by property ---
  const avgStayByProperty = properties.map((p) => {
    const propRegs = regs.filter(
      (r) => r.property_id === p.id && r.status !== "cancelled"
    );
    if (propRegs.length === 0)
      return { property: propertyNameMap[p.id], avgNights: 0 };
    const totalNights = propRegs.reduce((sum, r) => {
      const nights = Math.max(
        1,
        Math.floor(
          (new Date(r.check_out_date).getTime() -
            new Date(r.check_in_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return sum + nights;
    }, 0);
    return {
      property: propertyNameMap[p.id],
      avgNights: Math.round((totalNights / propRegs.length) * 10) / 10,
    };
  });

  // --- Chart 5: Guest count trends (monthly) ---
  const guestsByMonth: Record<string, number> = {};
  for (const r of regs) {
    if (r.status === "cancelled") continue;
    const month = r.check_in_date.slice(0, 7);
    guestsByMonth[month] = (guestsByMonth[month] ?? 0) + r.num_guests;
  }
  const guestMonths = Object.keys(guestsByMonth).sort().slice(-12);
  const guestCountTrend = guestMonths.map((month) => ({
    month,
    guests: guestsByMonth[month],
  }));

  // --- Chart 6: Upsell revenue breakdown ---
  const upsellRevenue: Record<string, number> = {};
  for (const r of regs) {
    if (!r.upsells) continue;
    for (const u of r.upsells as { label: string; price_cents: number; status: string }[]) {
      if (u.status === "paid" || u.status === "completed") {
        upsellRevenue[u.label] =
          (upsellRevenue[u.label] ?? 0) + u.price_cents / 100;
      }
    }
  }
  const upsellBreakdown = Object.entries(upsellRevenue).map(
    ([name, value]) => ({ name, value })
  );

  // --- Chart 7: QR scans by property ---
  const qrScansByProperty: Record<string, number> = {};
  for (const qr of qrs) {
    const name = propertyNameMap[qr.property_id];
    if (!name) continue;
    qrScansByProperty[name] = (qrScansByProperty[name] ?? 0) + qr.scan_count;
  }
  const qrScansData = Object.entries(qrScansByProperty).map(
    ([property, scans]) => ({ property, scans })
  );

  return NextResponse.json({
    properties: properties.map((p) => ({
      id: p.id,
      name: propertyNameMap[p.id],
    })),
    charts: {
      revenueOverTime,
      occupancyByProperty,
      bookingsPerMonth,
      avgStayByProperty,
      guestCountTrend,
      upsellBreakdown,
      qrScansData,
    },
  });
}
