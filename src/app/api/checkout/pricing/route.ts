import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNightlyRates } from "@/lib/pricelabs/client";
import { getQuote } from "@/lib/lodgify/client";

const PA_STATE_TAX_RATE = 0.06;
const MONROE_COUNTY_TAX_RATE = 0.03;

async function getLodgifyRoomId(lodgifyPropertyId: number): Promise<number | null> {
  const res = await fetch(`https://api.lodgify.com/v2/properties/${lodgifyPropertyId}/rooms`, {
    headers: {
      "X-ApiKey": process.env.LODGIFY_API_KEY!,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const rooms = (await res.json()) as { id: number }[];
  return rooms[0]?.id ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const checkIn = searchParams.get("check_in");
  const checkOut = searchParams.get("check_out");
  const guests = parseInt(searchParams.get("guests") || "2", 10);
  const pets = parseInt(searchParams.get("pets") || "0", 10);

  if (!propertyId || !checkIn || !checkOut) {
    return NextResponse.json(
      { error: "property_id, check_in, and check_out are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: property } = await supabase
    .from("property")
    .select("id, lodgify_property_id, cleaning_fee_cents, pet_fee_cents")
    .eq("id", propertyId)
    .single();

  if (!property || !property.lodgify_property_id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const roomId = await getLodgifyRoomId(property.lodgify_property_id);

  // Try PriceLabs first for per-night breakdown
  let nightlyRates: { date: string; price_cents: number; min_stay: number }[] | null = null;

  if (roomId) {
    try {
      nightlyRates = await getNightlyRates(
        property.lodgify_property_id,
        roomId,
        checkIn,
        checkOut
      );
    } catch (err) {
      console.warn("[checkout/pricing] PriceLabs failed, falling back to Lodgify:", err);
    }
  }

  let roomRateCents: number;
  let nights: number;

  if (nightlyRates && nightlyRates.length > 0) {
    roomRateCents = nightlyRates.reduce((sum, r) => sum + r.price_cents, 0);
    nights = nightlyRates.length;
  } else {
    // Fallback: Lodgify quote (lump sum)
    nights = Math.round(
      (new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (roomId) {
      const quote = await getQuote(property.lodgify_property_id, checkIn, checkOut, guests);
      roomRateCents = quote ? Math.round(quote.total * 100) : 0;
    } else {
      roomRateCents = 0;
    }
    // For fallback, create a flat nightly rate array
    const avgNightly = Math.round(roomRateCents / nights);
    nightlyRates = [];
    const d = new Date(checkIn + "T00:00:00");
    for (let i = 0; i < nights; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      nightlyRates.push({ date: `${y}-${m}-${day}`, price_cents: avgNightly, min_stay: 1 });
      d.setDate(d.getDate() + 1);
    }
  }

  const cleaningFeeCents = property.cleaning_fee_cents || 0;
  const petFeeCents = property.pet_fee_cents || 0;
  const petFeeTotalCents = pets * petFeeCents;
  const stateTaxCents = Math.round(roomRateCents * PA_STATE_TAX_RATE);
  const countyTaxCents = Math.round(roomRateCents * MONROE_COUNTY_TAX_RATE);
  const taxTotalCents = stateTaxCents + countyTaxCents;
  const totalCents = roomRateCents + cleaningFeeCents + petFeeTotalCents + taxTotalCents;

  return NextResponse.json({
    nightly_rates: nightlyRates,
    nights,
    room_rate_cents: roomRateCents,
    cleaning_fee_cents: cleaningFeeCents,
    pet_fee_cents: petFeeCents,
    pet_count: pets,
    pet_fee_total_cents: petFeeTotalCents,
    state_tax_cents: stateTaxCents,
    county_tax_cents: countyTaxCents,
    tax_total_cents: taxTotalCents,
    total_cents: totalCents,
  });
}
