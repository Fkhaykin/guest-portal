import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { ReservationCard } from "@/components/cleaner/reservation-card";
import { CollapsibleSection } from "@/components/cleaner/collapsible-section";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Home,
} from "lucide-react";
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

type CleaningStatusRow = {
  registration_id: string;
  is_cleaned: boolean;
  fulfilled_upsells: string[];
};

export default async function CleanerDashboard() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  // Get assigned property ids
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  if (propertyIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <Home className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">
          No properties assigned yet.
          <br />
          Ask your host to assign properties to your account.
        </p>
      </div>
    );
  }

  // Get property names and cover images
  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname, cover_image_url, cleaning_photo_areas")
    .in("id", propertyIds);

  const propertyMap = new Map(
    (properties || []).map((p) => [p.id, { name: p.name, nickname: p.nickname, coverImage: p.cover_image_url, photoAreas: p.cleaning_photo_areas as string[] | null }])
  );

  // Get registrations: current, upcoming, and recently departed
  const today = new Date().toISOString().split("T")[0];
  const { data: registrations } = await supabase
    .from("registration")
    .select("id, property_id, check_in_date, check_out_date, num_guests, status, upsells, guest_list, pets, updated_at")
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .gte("check_out_date", "2026-03-15")
    .order("check_in_date", { ascending: true });

  // Deduplicate: for same property with overlapping date ranges, keep the most recently updated
  const allRegs = (registrations || []) as (RegistrationRow & { updated_at: string })[];
  // Sort by updated_at descending so we keep the newest version first
  allRegs.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const regs: RegistrationRow[] = [];
  for (const reg of allRegs) {
    const isDuplicate = regs.some(
      (existing) =>
        existing.property_id === reg.property_id &&
        existing.check_in_date < reg.check_out_date &&
        existing.check_out_date > reg.check_in_date
    );
    if (!isDuplicate) regs.push(reg);
  }
  // Re-sort by check-in ascending for display
  regs.sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));

  // Get cleaning statuses
  const regIds = regs.map((r) => r.id);
  const { data: statuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, is_cleaned, fulfilled_upsells")
    .in("registration_id", regIds.length > 0 ? regIds : ["_none_"]);

  const statusMap = new Map(
    ((statuses as CleaningStatusRow[]) || []).map((s) => [s.registration_id, s])
  );

  // Categorize
  const current: typeof regs = [];
  const upcoming: typeof regs = [];
  const departed: typeof regs = [];

  for (const reg of regs) {
    if (reg.check_in_date <= today && reg.check_out_date > today) {
      current.push(reg);
    } else if (reg.check_in_date > today) {
      upcoming.push(reg);
    } else {
      departed.push(reg);
    }
  }

  // Stats
  const needsCleaning = departed.filter(
    (r) => !statusMap.get(r.id)?.is_cleaned
  ).length;
  const totalTasks = regs.length;
  const completedTasks = regs.filter(
    (r) => statusMap.get(r.id)?.is_cleaned
  ).length;

  function renderCards(items: typeof regs, category: "current" | "upcoming" | "departed") {
    return items.map((reg) => {
      const paidUpsells = (reg.upsells || []).filter(
        (u) => u.status === "paid"
      );
      const status = statusMap.get(reg.id);
      const prop = propertyMap.get(reg.property_id);
      return (
        <ReservationCard
          key={reg.id}
          registrationId={reg.id}
          propertyName={prop?.name || "Unknown"}
          propertyNickname={prop?.nickname || null}
          propertyCoverImage={prop?.coverImage || null}
          checkIn={reg.check_in_date}
          checkOut={reg.check_out_date}
          numGuests={reg.num_guests}
          guestList={reg.guest_list}
          pets={reg.pets}
          upsells={paidUpsells}
          isCleaned={status?.is_cleaned ?? false}
          fulfilledUpsells={status?.fulfilled_upsells ?? []}
          photoAreas={prop?.photoAreas || null}
          category={category}
        />
      );
    });
  }

  const uncleanedDeparted = departed.filter((r) => !statusMap.get(r.id)?.is_cleaned);
  const cleanedDeparted = departed.filter((r) => statusMap.get(r.id)?.is_cleaned);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{current.length}</p>
            <p className="text-xs text-muted-foreground">In-House</p>
          </CardContent>
        </Card>
        <Card className={needsCleaning > 0 ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : ""}>
          <CardContent className="pt-4 pb-3 text-center">
            <p className={`text-2xl font-bold ${needsCleaning > 0 ? "text-red-600" : ""}`}>
              {needsCleaning}
            </p>
            <p className="text-xs text-muted-foreground">Need Cleaning</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
      </div>

      {/* Needs cleaning alert */}
      {needsCleaning > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {needsCleaning} departed reservation{needsCleaning > 1 ? "s" : ""} still need
            {needsCleaning === 1 ? "s" : ""} cleaning
          </p>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-6">
        {uncleanedDeparted.length > 0 && (
          <CollapsibleSection
            title="Needs Cleaning"
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            count={uncleanedDeparted.length}
            defaultOpen
          >
            <div className="space-y-3">
              {renderCards(uncleanedDeparted, "departed")}
            </div>
          </CollapsibleSection>
        )}

        {current.length > 0 && (
          <CollapsibleSection
            title="Currently In-House"
            icon={<CalendarCheck className="h-4 w-4 text-blue-500" />}
            count={current.length}
            defaultOpen
          >
            <div className="space-y-3">
              {renderCards(current, "current")}
            </div>
          </CollapsibleSection>
        )}

        {upcoming.length > 0 && (
          <CollapsibleSection
            title="Upcoming Arrivals"
            icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
            count={upcoming.length}
            defaultOpen
          >
            <div className="space-y-3">
              {renderCards(upcoming, "upcoming")}
            </div>
          </CollapsibleSection>
        )}

        {cleanedDeparted.length > 0 && (
          <CollapsibleSection
            title="Completed"
            icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            count={cleanedDeparted.length}
            defaultOpen={false}
          >
            <div className="space-y-3">
              {renderCards(cleanedDeparted, "departed")}
            </div>
          </CollapsibleSection>
        )}

        {regs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No reservations to show right now.
          </div>
        )}
      </div>
    </div>
  );
}
