import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { stayIncludesHoliday } from "@/lib/holidays";
import {
  timingHourlyCents,
  timingDurationOptions,
  STANDARD_MAX_TIMING_HOURS,
} from "@/lib/upsells/timing";
import {
  earlyCheckinAvailability,
  lateCheckoutAvailability,
  hostPropertyIds,
  type TimingOverride,
} from "@/lib/upsells/availability";

const INGREDIENT_COSTS_PER_GUEST: Record<string, number> = {
  Hibachi: 3500,   // $35 per guest
  Sushi: 4500,     // $45 per guest
  BBQ: 2500,       // $25 per guest
  Pizza: 2000,     // $20 per guest
};

const PICNIC_COST_PER_GUEST = 4500; // $45 per guest
const BREAKFAST_COST_PER_GUEST = 1500; // $15 per guest per day

const UPSELL_IMAGES: Record<string, string> = {
  early_checkin: "/upsells/early-checkin.jpg",
  late_checkout: "/upsells/late-checkout.jpg",
  new_sheets: "/upsells/new-sheets.jpg",
  firewood: "/upsells/firewood.jpg",
  private_chef: "/upsells/private-chef.jpg",
  baby_high_chair: "/upsells/baby-high-chair.jpg",
  luxury_picnic: "/upsells/luxury-picnic.jpg",
  breakfast_delivery: "/upsells/breakfast-delivery.jpg",
};

export async function POST(request: Request) {
  let body: { registration_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id } = body;
  if (!registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {

  const supabase = createAdminClient();

  // Get the registration with property info
  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("id, check_in_date, check_out_date, num_guests, property_id, upsells, early_checkin_override, early_checkin_override_hours, late_checkout_override, late_checkout_override_hours")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    console.error("Upsells: registration lookup failed", regError);
    return NextResponse.json({ error: regError?.message || "Registration not found" }, { status: 404 });
  }

  // Cross-property turnaround availability for the timing upsells — logic
  // shared with the automated late-checkout offer (see lib/upsells/availability).

  // Get the host_id for cross-property queries
  const { data: property } = await supabase
    .from("property")
    .select("host_id, name, nickname")
    .eq("id", reg.property_id)
    .single();

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const allPropertyIds = await hostPropertyIds(supabase, property.host_id);
  const availabilityParams = {
    propertyIds: allPropertyIds,
    excludeRegistrationId: reg.id,
  };
  const [earlyAvail, lateAvail] = await Promise.all([
    earlyCheckinAvailability(
      supabase,
      { ...availabilityParams, override: reg.early_checkin_override as TimingOverride },
      reg.check_in_date
    ),
    lateCheckoutAvailability(
      supabase,
      { ...availabilityParams, override: reg.late_checkout_override as TimingOverride },
      reg.check_out_date
    ),
  ]);

  // An 'allow' override can also widen (or narrow) the purchasable hour tiers.
  const earlyMaxHours =
    reg.early_checkin_override === "allow" && reg.early_checkin_override_hours
      ? reg.early_checkin_override_hours
      : STANDARD_MAX_TIMING_HOURS;
  const lateMaxHours =
    reg.late_checkout_override === "allow" && reg.late_checkout_override_hours
      ? reg.late_checkout_override_hours
      : STANDARD_MAX_TIMING_HOURS;

  // Build booking dates array for private chef date picker
  const dates: string[] = [];
  const d = new Date(reg.check_in_date + "T00:00:00");
  const end = new Date(reg.check_out_date + "T00:00:00");
  while (d < end) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }

  // Already purchased upsells
  const purchased = (reg.upsells as Array<{ type: string; status: string }>) || [];

  // Timing upsells (early check-in / late check-out) are billed per extra hour:
  // $25/hr normally, $50/hr if any night of the stay overlaps a US federal holiday.
  const holidayStay = stayIncludesHoliday(reg.check_in_date, reg.check_out_date);
  const hourlyCents = timingHourlyCents(reg.check_in_date, reg.check_out_date);
  const holidayNote = holidayStay ? " Holiday rate applies." : "";

  const earlyOptions = timingDurationOptions("early_checkin", hourlyCents, earlyMaxHours);
  const lateOptions = timingDurationOptions("late_checkout", hourlyCents, lateMaxHours);
  const lastEarly = earlyOptions[earlyOptions.length - 1];
  const lastLate = lateOptions[lateOptions.length - 1];
  const earlyDescription =
    earlyOptions.length === 1
      ? `Standard check-in is 4:00 PM. Arrive 1 hour early (${lastEarly.time_label}).${holidayNote}`
      : earlyOptions.length === 2
      ? `Standard check-in is 4:00 PM. Arrive 1 hour (3:00 PM) or 2 hours (2:00 PM) early.${holidayNote}`
      : `Standard check-in is 4:00 PM. Arrive up to ${lastEarly.hours} hours early (as early as ${lastEarly.time_label}).${holidayNote}`;
  const lateDescription =
    lateOptions.length === 1
      ? `Standard check-out is 11:00 AM. Add 1 hour (until ${lastLate.time_label}).${holidayNote}`
      : lateOptions.length === 2
      ? `Standard check-out is 11:00 AM. Add 1 hour (until 12:00 PM) or 2 hours (until 1:00 PM).${holidayNote}`
      : `Standard check-out is 11:00 AM. Stay up to ${lastLate.hours} extra hours (until ${lastLate.time_label}).${holidayNote}`;

  // Build available upsells
  const upsells = [
    {
      type: "early_checkin",
      group: "timing",
      label: "Early Check-In",
      description: earlyDescription,
      price_cents: hourlyCents,
      image: UPSELL_IMAGES.early_checkin,
      available: earlyAvail.available && !purchased.some((u) => u.type === "early_checkin" && u.status === "paid"),
      unavailable_reason: earlyAvail.reason,
      request_only: earlyAvail.requestOnly,
      meta: {
        holiday_rate: holidayStay,
        duration_options: earlyOptions,
      },
    },
    {
      type: "late_checkout",
      group: "timing",
      label: "Late Check-Out",
      description: lateDescription,
      price_cents: hourlyCents,
      image: UPSELL_IMAGES.late_checkout,
      available: lateAvail.available && !purchased.some((u) => u.type === "late_checkout" && u.status === "paid"),
      unavailable_reason: lateAvail.reason,
      request_only: lateAvail.requestOnly,
      meta: {
        holiday_rate: holidayStay,
        duration_options: lateOptions,
      },
    },
    {
      type: "new_sheets",
      group: "convenience",
      label: "Brand New Sheets & Pillowcases",
      description: "Never-used, fresh-out-of-package sheets and pillowcases for all beds.",
      price_cents: 25000,
      image: UPSELL_IMAGES.new_sheets,
      available: !purchased.some((u) => u.type === "new_sheets" && u.status === "paid"),
    },
    {
      type: "firewood",
      group: "convenience",
      label: "Firewood Delivery",
      description: "A bundle of seasoned firewood delivered to the property.",
      price_cents: 3500,
      image: UPSELL_IMAGES.firewood,
      available: !purchased.some((u) => u.type === "firewood" && u.status === "paid"),
    },
    {
      type: "baby_high_chair",
      group: "convenience",
      label: "Baby High Chair Rental",
      description: "A clean, sanitized high chair available for the duration of your stay.",
      price_cents: 2500,
      image: UPSELL_IMAGES.baby_high_chair,
      available: !purchased.some((u) => u.type === "baby_high_chair" && u.status === "paid"),
    },
    {
      type: "breakfast_delivery",
      group: "convenience",
      label: "Breakfast Delivery by Archie's Corner",
      description: "Bacon, egg & cheese on a fresh croissant, crispy hashbrowns, and hot coffee delivered to your door. $15/guest/day. Choose how many servings and delivery time.",
      price_cents: BREAKFAST_COST_PER_GUEST,
      image: UPSELL_IMAGES.breakfast_delivery,
      available: !purchased.some((u) => u.type === "breakfast_delivery" && u.status === "paid"),
      meta: {
        dates,
        num_guests: reg.num_guests,
        per_guest_per_day_cost: BREAKFAST_COST_PER_GUEST,
        vendor_url: "https://archiescorner.com",
      },
    },
    {
      type: "private_chef",
      group: "experience",
      label: "Private Chef Experience",
      description: "$500 chef fee + ingredient cost based on guest count and menu.",
      price_cents: 50000,
      image: UPSELL_IMAGES.private_chef,
      available: !purchased.some((u) => u.type === "private_chef" && u.status === "paid"),
      meta: {
        dates,
        num_guests: reg.num_guests,
        menu_options: Object.entries(INGREDIENT_COSTS_PER_GUEST).map(([menu, perGuest]) => ({
          menu,
          ingredient_cost_per_guest: perGuest,
          total_ingredient_cost: perGuest * reg.num_guests,
          total_price: 50000 + perGuest * reg.num_guests,
        })),
      },
    },
    {
      type: "luxury_picnic",
      group: "experience",
      label: "Luxury Outdoor Picnic",
      description: reg.num_guests < 6
        ? `A beautifully styled lakeside picnic with charcuterie, fresh fruit, wine, blankets, and cushions. Priced for 6-guest minimum ($${(PICNIC_COST_PER_GUEST * 6 / 100).toFixed(0)}).`
        : "A beautifully styled lakeside picnic with charcuterie, fresh fruit, wine, blankets, and cushions. Price based on number of guests.",
      price_cents: PICNIC_COST_PER_GUEST * Math.max(reg.num_guests, 6),
      image: UPSELL_IMAGES.luxury_picnic,
      available: !purchased.some((u) => u.type === "luxury_picnic" && u.status === "paid"),
      unavailable_reason: null,
      meta: {
        dates,
        num_guests: reg.num_guests,
        per_guest_cost: PICNIC_COST_PER_GUEST,
      },
    },
  ];

  // Pet fees are now collected inline during registration (step 4) and update flow,
  // so they are no longer part of the add-ons/upsells listing.

  // Mark already-purchased upsells as unavailable
  const purchasedTypes = new Set(purchased.map((u) => u.type));
  const withPurchased = upsells.map((u) => {
    if (purchasedTypes.has(u.type)) {
      return { ...u, available: false, purchased: true };
    }
    return { ...u, purchased: false };
  });

  const paid = purchased.filter((u) => u.status === "paid");
  return NextResponse.json({ upsells: withPurchased, purchased: paid });

  } catch (err) {
    console.error("Upsells API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
