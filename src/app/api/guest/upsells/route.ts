import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  try {

  const supabase = createAdminClient();

  // Get the registration with property info
  const { data: reg, error: regError } = await supabase
    .from("registration")
    .select("id, check_in_date, check_out_date, num_guests, property_id, upsells")
    .eq("id", registration_id)
    .single();

  if (regError || !reg) {
    console.error("Upsells: registration lookup failed", regError);
    return NextResponse.json({ error: regError?.message || "Registration not found" }, { status: 404 });
  }

  // Check if early check-in (1pm) is available on check-in date
  // Not available if another booking on the same property checks out late (2pm) that day
  const { data: lateCheckoutConflicts } = await supabase
    .from("registration")
    .select("id, upsells")
    .eq("property_id", reg.property_id)
    .eq("check_in_date", reg.check_in_date)
    .neq("id", reg.id)
    .in("status", ["active", "completed"]);

  const hasLateCheckoutConflict = (lateCheckoutConflicts || []).some((r) => {
    const upsells = (r.upsells as Array<{ type: string; status: string }>) || [];
    return upsells.some((u) => u.type === "late_checkout" && u.status === "paid");
  });

  // Check if late checkout (2pm) is available on checkout date
  // Not available if another booking on the same property checks in early (1pm) that day
  const { data: earlyCheckinConflicts } = await supabase
    .from("registration")
    .select("id, upsells")
    .eq("property_id", reg.property_id)
    .eq("check_in_date", reg.check_out_date)
    .neq("id", reg.id)
    .in("status", ["active", "completed"]);

  const hasEarlyCheckinConflict = (earlyCheckinConflicts || []).some((r) => {
    const upsells = (r.upsells as Array<{ type: string; status: string }>) || [];
    return upsells.some((u) => u.type === "early_checkin" && u.status === "paid");
  });

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

  // Build available upsells
  const upsells = [
    {
      type: "early_checkin",
      group: "timing",
      label: "Early Check-In (1:00 PM)",
      description: "Standard check-in is 4:00 PM. Arrive 3 hours early.",
      price_cents: 10000,
      image: UPSELL_IMAGES.early_checkin,
      available: !hasLateCheckoutConflict && !purchased.some((u) => u.type === "early_checkin" && u.status === "paid"),
      unavailable_reason: hasLateCheckoutConflict ? "Not available — another guest has a late checkout that day" : null,
    },
    {
      type: "late_checkout",
      group: "timing",
      label: "Late Check-Out (2:00 PM)",
      description: "Standard check-out is 11:00 AM. Stay 3 extra hours.",
      price_cents: 10000,
      image: UPSELL_IMAGES.late_checkout,
      available: !hasEarlyCheckinConflict && !purchased.some((u) => u.type === "late_checkout" && u.status === "paid"),
      unavailable_reason: hasEarlyCheckinConflict ? "Not available — another guest has an early check-in that day" : null,
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
        ? "A beautifully styled lakeside picnic experience. Minimum 6 guests required."
        : "A beautifully styled lakeside picnic with charcuterie, fresh fruit, wine, blankets, and cushions. Price based on number of guests.",
      price_cents: PICNIC_COST_PER_GUEST * Math.max(reg.num_guests, 6),
      image: UPSELL_IMAGES.luxury_picnic,
      available: reg.num_guests >= 6 && !purchased.some((u) => u.type === "luxury_picnic" && u.status === "paid"),
      unavailable_reason: reg.num_guests < 6 ? "Minimum 6 guests required for this experience" : null,
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
