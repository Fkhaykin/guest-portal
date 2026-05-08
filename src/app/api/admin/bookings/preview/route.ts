import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingQuote } from "@/lib/pricing/booking-quote";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    property_id: string;
    check_in: string;
    check_out: string;
    guests?: number;
    pets?: number;
    discount_cents?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.property_id || !body.check_in || !body.check_out) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (body.check_out <= body.check_in) {
    return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: property } = await admin
    .from("property")
    .select("id, lodgify_property_id, guest_cleaning_fee_cents, guest_pet_fee_cents")
    .eq("id", body.property_id)
    .single();

  if (!property || !property.lodgify_property_id) {
    return NextResponse.json({ error: "Property not found or missing Lodgify mapping" }, { status: 404 });
  }

  try {
    const breakdown = await buildBookingQuote({
      lodgifyPropertyId: property.lodgify_property_id,
      checkIn: body.check_in,
      checkOut: body.check_out,
      guests: body.guests ?? 2,
      pets: body.pets ?? 0,
      cleaningFeeCents: property.guest_cleaning_fee_cents || 0,
      petFeeCents: property.guest_pet_fee_cents || 0,
      discountCents: body.discount_cents ?? 0,
    });
    return NextResponse.json(breakdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build quote";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
