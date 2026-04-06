import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingById } from "@/lib/lodgify/client";

export async function POST(request: Request) {
  let body: { email?: string; phone?: string; full_name?: string; check_in_date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, phone, full_name, check_in_date } = body;

  if (!check_in_date) {
    return NextResponse.json(
      { error: "check_in_date is required" },
      { status: 400 }
    );
  }

  if (!full_name && !email && !phone) {
    return NextResponse.json(
      { error: "At least one of name, email, or phone is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Find guest by any combination of name, email, phone
  let guestQuery = supabase
    .from("guest")
    .select("id, full_name");

  // Build OR conditions — match any provided identifier
  const orConditions: string[] = [];

  if (full_name) {
    // Split into words for flexible matching
    const words = full_name.trim().split(/\s+/);
    for (const word of words) {
      // Match any guest whose name contains this word
      orConditions.push(`full_name.ilike.%${word}%`);
    }
  }

  if (email) {
    orConditions.push(`email.ilike.${email}`);
  }

  if (phone) {
    const phoneDigits = phone.replace(/\D/g, "");
    orConditions.push(`phone.eq.${phoneDigits}`);
  }

  if (orConditions.length > 0) {
    guestQuery = guestQuery.or(orConditions.join(","));
  }

  const { data: guests, error: guestError } = await guestQuery;

  if (guestError || !guests || guests.length === 0) {
    return NextResponse.json(
      { error: "No reservation found. Please check your details and try again." },
      { status: 404 }
    );
  }

  const guestIds = guests.map((g) => g.id);

  // Find registration matching guest + check-in date
  const { data: registrations, error: regError } = await supabase
    .from("registration")
    .select(`
      id,
      check_in_date,
      check_out_date,
      num_guests,
      notes,
      status,
      signature_url,
      lodgify_booking_id,
      property:property_id (
        id,
        name,
        slug,
        address,
        description,
        cover_image_url,
        timezone,
        lodgify_property_id
      )
    `)
    .in("guest_id", guestIds)
    .eq("check_in_date", check_in_date)
    .in("status", ["active", "completed"]);

  if (regError || !registrations || registrations.length === 0) {
    return NextResponse.json(
      { error: "No reservation found. Please check your details and try again." },
      { status: 404 }
    );
  }

  const reg = registrations[0];

  // Enrich with Lodgify booking details (check-in/out times, guest breakdown, etc.)
  let lodgifyDetails = null;
  if (reg.lodgify_booking_id) {
    try {
      const booking = await getBookingById(reg.lodgify_booking_id);
      const rawBooking = booking as unknown as Record<string, unknown>;
      const rooms = rawBooking.rooms as Array<{
        guest_breakdown?: { adults: number; children: number; infants: number; pets: number };
        people?: number;
      }> | undefined;

      lodgifyDetails = {
        check_in_time: (rawBooking.check_in as { time?: string })?.time || null,
        check_out_time: (rawBooking.check_out as { time?: string })?.time || null,
        total_amount: rawBooking.total_amount as number | null,
        currency_code: rawBooking.currency_code as string | null,
        source: rawBooking.source as string | null,
        guest_breakdown: rooms?.[0]?.guest_breakdown || null,
      };
    } catch {
      // Non-critical — just skip enrichment
    }
  }

  // Fetch Lodgify property image
  const prop = reg.property as unknown as Record<string, unknown>;
  let propertyImageUrl = prop?.cover_image_url as string | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;
  if (!propertyImageUrl && lodgifyPropertyId) {
    try {
      const propRes = await fetch(`https://api.lodgify.com/v2/properties/${lodgifyPropertyId}`, {
        headers: {
          "X-ApiKey": process.env.LODGIFY_API_KEY!,
          Accept: "application/json",
        },
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        const rawUrl = propData.image_url as string | null;
        propertyImageUrl = rawUrl?.startsWith("//") ? `https:${rawUrl}` : rawUrl;
      }
    } catch {
      // Non-critical
    }
  }

  // Use the DB guest name (properly cased) for personalization
  const guestName = guests[0].full_name;

  return NextResponse.json({
    guest_name: guestName,
    reservation: {
      ...reg,
      property: {
        ...prop,
        cover_image_url: propertyImageUrl,
      },
      lodgify: lodgifyDetails,
    },
  });
}
