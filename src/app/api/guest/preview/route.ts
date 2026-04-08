import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingById } from "@/lib/lodgify/client";

/**
 * GET /api/guest/preview?reg=REGISTRATION_ID
 * Returns session-compatible reservation data so the admin can preview
 * the guest portal as if logged in as that guest.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regId = searchParams.get("reg");

  if (!regId) {
    return NextResponse.json({ error: "reg is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: reg, error } = await supabase
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
      guest:guest_id ( id, full_name ),
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
    .eq("id", regId)
    .single();

  if (error || !reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const guest = reg.guest as unknown as { id: string; full_name: string } | null;
  const prop = reg.property as unknown as Record<string, unknown> | null;

  // Enrich with Lodgify details
  let lodgifyDetails = null;
  if (reg.lodgify_booking_id) {
    try {
      const booking = await getBookingById(reg.lodgify_booking_id);
      const raw = booking as unknown as Record<string, unknown>;
      const rooms = raw.rooms as Array<{
        guest_breakdown?: { adults: number; children: number; infants: number; pets: number };
      }> | undefined;

      lodgifyDetails = {
        check_in_time: (raw.check_in as { time?: string })?.time || null,
        check_out_time: (raw.check_out as { time?: string })?.time || null,
        total_amount: raw.total_amount as number | null,
        currency_code: raw.currency_code as string | null,
        source: raw.source as string | null,
        guest_breakdown: rooms?.[0]?.guest_breakdown || null,
      };
    } catch {
      // Non-critical
    }
  }

  // Fetch Lodgify property image if needed
  let propertyImageUrl = prop?.cover_image_url as string | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;
  if (!propertyImageUrl && lodgifyPropertyId) {
    try {
      const propRes = await fetch(
        `https://api.lodgify.com/v2/properties/${lodgifyPropertyId}`,
        {
          headers: {
            "X-ApiKey": process.env.LODGIFY_API_KEY!,
            Accept: "application/json",
          },
        }
      );
      if (propRes.ok) {
        const propData = await propRes.json();
        const rawUrl = propData.image_url as string | null;
        propertyImageUrl = rawUrl?.startsWith("//") ? `https:${rawUrl}` : rawUrl;
      }
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({
    guest_name: guest?.full_name ?? "Guest",
    reservation: {
      id: reg.id,
      check_in_date: reg.check_in_date,
      check_out_date: reg.check_out_date,
      num_guests: reg.num_guests,
      notes: reg.notes,
      status: reg.status,
      signature_url: reg.signature_url,
      property: {
        ...(prop ?? {}),
        cover_image_url: propertyImageUrl,
      },
      lodgify: lodgifyDetails,
    },
  });
}
