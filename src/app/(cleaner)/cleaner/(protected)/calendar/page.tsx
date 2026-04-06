import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { CalendarView } from "@/components/cleaner/calendar-view";
import type { UpsellEntry, GuestListEntry, PetEntry } from "@/types/database";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  status: string;
  upsells: UpsellEntry[] | null;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
};

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

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname, cover_image_url")
    .in("id", propertyIds);

  const propertyMap = new Map(
    (properties || []).map((p) => [p.id, { name: p.name, nickname: p.nickname, coverImage: p.cover_image_url }])
  );

  const propertyColorMap = new Map(
    (properties || []).map((p, i) => [p.id, PROPERTY_COLORS[i % PROPERTY_COLORS.length]])
  );

  // Wide range: 60 days back, 90 days forward
  const calendarStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: calendarRegs } = await supabase
    .from("registration")
    .select("id, property_id, check_in_date, check_out_date, num_guests, status, upsells, guest_list, pets")
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .gte("check_out_date", calendarStart)
    .order("check_in_date", { ascending: true });

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
    const paid = ((r.upsells as UpsellEntry[] | null) || []).filter((u) => u.status === "paid");
    const prop = propertyMap.get(r.property_id);
    return {
      id: r.id,
      propertyName: prop?.name || "Unknown",
      propertyCoverImage: prop?.coverImage || null,
      propertyColor: propertyColorMap.get(r.property_id) || "bg-gray-500",
      checkIn: r.check_in_date,
      checkOut: r.check_out_date,
      numGuests: r.num_guests,
      guestList: (r as unknown as RegistrationRow).guest_list,
      pets: (r as unknown as RegistrationRow).pets,
      isCleaned: calendarStatusMap.get(r.id) ?? false,
      upsellCount: paid.length,
      upsellLabels: paid.map((u) => UPSELL_LABELS[u.type] || u.label || u.type),
    };
  });

  return <CalendarView reservations={calendarData} />;
}
