import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { CalendarView } from "@/components/cleaner/calendar-view";
import type { UpsellEntry, GuestListEntry, PetEntry } from "@/types/database";

export const dynamic = "force-dynamic";

const PROPERTY_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
];

const UPSELL_LABELS: Record<string, string> = {
  early_checkin: "Early Check-In",
  late_checkout: "Late Check-Out",
  new_sheets: "New Sheets",
  firewood: "Firewood",
  private_chef: "Private Chef",
  baby_high_chair: "High Chair",
  luxury_picnic: "Luxury Picnic",
  breakfast_delivery: "Breakfast",
};

export default async function CalendarPage() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  if (propertyIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No properties assigned yet.
      </div>
    );
  }

  // Wide range: 60 days back, 90 days forward
  const calendarStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Fetch registrations with property + guest data joined inline
  const { data: calendarRegs } = await supabase
    .from("registration")
    .select("id, property_id, check_in_date, check_out_date, num_guests, status, upsells, guest_list, pets, created_at, guest:guest_id(full_name), property:property_id(name, nickname, cover_image_url)")
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .gte("check_out_date", calendarStart)
    .order("check_in_date", { ascending: true });

  // Build color map from unique properties in results
  const seenProperties = new Map<string, number>();
  for (const r of calendarRegs || []) {
    if (!seenProperties.has(r.property_id)) {
      seenProperties.set(r.property_id, seenProperties.size);
    }
  }

  const calendarRegIds = (calendarRegs || []).map((r) => r.id);
  const { data: calendarStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, is_cleaned")
    .in("registration_id", calendarRegIds.length > 0 ? calendarRegIds : ["_none_"]);

  const calendarStatusMap = new Map(
    ((calendarStatuses as { registration_id: string; is_cleaned: boolean }[]) || []).map(
      (s) => [s.registration_id, s.is_cleaned]
    )
  );

  const calendarData = (calendarRegs || []).map((r) => {
    const paid = ((r.upsells as unknown as UpsellEntry[] | null) || []).filter((u) => u.status === "paid");
    const guest = r.guest as unknown as { full_name: string } | null;
    const property = r.property as unknown as { name: string; nickname: string | null; cover_image_url: string | null } | null;
    const colorIdx = seenProperties.get(r.property_id) ?? 0;
    const ciDate = new Date(r.check_in_date + "T00:00:00");
    const coDate = new Date(r.check_out_date + "T00:00:00");
    const nights = Math.round((coDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: r.id,
      propertyName: property?.name || "Unknown",
      propertyCoverImage: property?.cover_image_url || null,
      propertyColor: PROPERTY_COLORS[colorIdx % PROPERTY_COLORS.length],
      checkIn: r.check_in_date,
      checkOut: r.check_out_date,
      numGuests: r.num_guests,
      guestName: guest?.full_name || null,
      guestList: r.guest_list as unknown as GuestListEntry[] | null,
      pets: r.pets as unknown as PetEntry[] | null,
      isCleaned: calendarStatusMap.get(r.id) ?? false,
      upsellCount: paid.length,
      upsellLabels: paid.map((u) => UPSELL_LABELS[u.type] || u.label || u.type),
      bookedAt: (r as unknown as { created_at: string }).created_at || null,
      status: r.status,
      nights,
      hasEarlyCheckin: paid.some((u) => u.type === "early_checkin"),
      hasLateCheckout: paid.some((u) => u.type === "late_checkout"),
    };
  });

  return <CalendarView reservations={calendarData} />;
}
