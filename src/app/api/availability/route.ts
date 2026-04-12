import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPropertyAvailable } from "@/lib/lodgify/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("check_in");
  const checkOut = searchParams.get("check_out");
  const guestsParam = searchParams.get("guests");

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { error: "check_in and check_out are required" },
      { status: 400 }
    );
  }

  // Validate dates
  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (checkOutDate <= checkInDate) {
    return NextResponse.json(
      { error: "Check-out must be after check-in" },
      { status: 400 }
    );
  }

  const guests = guestsParam ? parseInt(guestsParam, 10) : null;

  const supabase = createAdminClient();

  // Fetch all active properties with a Lodgify ID
  let query = supabase
    .from("property")
    .select(
      "id, name, slug, address, description, cover_image_url, max_guests, lodgify_property_id"
    )
    .eq("is_active", true)
    .not("lodgify_property_id", "is", null)
    .order("name");

  if (guests) {
    query = query.gte("max_guests", guests);
  }

  const { data: properties, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }

  if (!properties || properties.length === 0) {
    return NextResponse.json({ available: [] });
  }

  // Check availability for each property in parallel via Lodgify API
  const results = await Promise.allSettled(
    properties.map(async (property) => {
      const available = await isPropertyAvailable(
        property.lodgify_property_id!,
        checkIn,
        checkOut
      );
      return { property, available };
    })
  );

  // If all Lodgify calls failed (API down), fall back to showing all properties
  const allFailed = results.every((r) => r.status === "rejected");

  const mapProperty = (p: typeof properties[number]) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    address: p.address,
    description: p.description,
    cover_image_url: p.cover_image_url,
    max_guests: p.max_guests,
  });

  if (allFailed) {
    // Return all matching properties when we can't verify availability
    return NextResponse.json({
      available: properties.map(mapProperty),
      availability_unverified: true,
    });
  }

  const available = results
    .filter(
      (r): r is PromiseFulfilledResult<{ property: typeof properties[number]; available: boolean }> =>
        r.status === "fulfilled" && r.value.available
    )
    .map((r) => mapProperty(r.value.property));

  return NextResponse.json({ available });
}
