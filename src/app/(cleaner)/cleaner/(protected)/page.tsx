import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { AnalyticsDashboard } from "@/components/cleaner/analytics-dashboard-lazy";
import type { InvoiceLineItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CleanerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from, to } = await searchParams;
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  // Get assigned properties with fees
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  if (propertyIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        No properties assigned yet.
      </div>
    );
  }

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, nickname, cleaning_fee_cents")
    .in("id", propertyIds);

  const cleanerPetFee = cleaner.pet_fee_cents ?? 0;

  const propMap = new Map(
    (properties || []).map((p) => [
      p.id,
      {
        name: p.nickname || p.name,
        cleaningFee: p.cleaning_fee_cents ?? 0,
        petFee: cleanerPetFee,
      },
    ])
  );

  const today = new Date().toISOString().split("T")[0];

  // Date filter bounds
  const filterFrom = typeof from === "string" && from ? from : undefined;
  const filterTo = typeof to === "string" && to ? to : undefined;

  // --- Upcoming cleanings (check-out today or future, not yet cleaned) ---
  const { data: upcomingRegs } = await supabase
    .from("registration")
    .select("id")
    .in("property_id", propertyIds)
    .in("status", ["active", "completed"])
    .gte("check_out_date", today);

  const upcomingRegIds = (upcomingRegs || []).map((r) => r.id);
  let upcomingCleanings = upcomingRegIds.length;
  if (upcomingRegIds.length > 0) {
    const { data: alreadyCleaned } = await supabase
      .from("cleaning_status")
      .select("registration_id")
      .in("registration_id", upcomingRegIds)
      .eq("is_cleaned", true);
    upcomingCleanings = upcomingRegIds.length - (alreadyCleaned || []).length;
  }

  // --- All cleaned registrations (earned revenue) ---
  const { data: cleanedStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, cleaned_at, registration!inner(property_id)")
    .eq("is_cleaned", true)
    .in("registration.property_id", propertyIds.length > 0 ? propertyIds : ["_none_"]);

  const cleanedRegIds = (cleanedStatuses || []).map((s) => s.registration_id);
  const cleanedAtMap = new Map(
    (cleanedStatuses || []).map((s) => [s.registration_id, s.cleaned_at])
  );

  type RegRow = {
    id: string;
    property_id: string;
    check_out_date: string;
    pets: Array<{ name?: string }> | null;
  };

  let cleanedRegs: RegRow[] = [];
  if (cleanedRegIds.length > 0) {
    const { data } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date, pets")
      .in("id", cleanedRegIds);
    cleanedRegs = (data || []) as RegRow[];
  }

  // --- Future bookings (projected revenue) ---
  const { data: futureRegsRaw } = await supabase
    .from("registration")
    .select("id, property_id, check_out_date, pets")
    .in("property_id", propertyIds)
    .in("status", ["active"])
    .gt("check_out_date", today);

  // Exclude already-cleaned ones
  const cleanedSet = new Set(cleanedRegIds);
  const futureRegs = ((futureRegsRaw || []) as RegRow[]).filter(
    (r) => !cleanedSet.has(r.id)
  );

  // --- Helpers ---
  function hasPets(reg: RegRow) {
    return (reg.pets || []).some((p) => p.name?.trim());
  }

  function regRevenue(reg: RegRow) {
    const prop = propMap.get(reg.property_id);
    if (!prop) return { cleaning: 0, pet: 0 };
    return {
      cleaning: prop.cleaningFee,
      pet: hasPets(reg) ? prop.petFee : 0,
    };
  }

  function inDateRange(dateStr: string) {
    if (filterFrom && dateStr < filterFrom) return false;
    if (filterTo && dateStr > filterTo) return false;
    return true;
  }

  // --- Build monthly data ---
  const monthlyMap = new Map<
    string,
    { cleaning: number; pet: number; futureCleaning: number; futurePet: number }
  >();

  const propertyStats = new Map<
    string,
    {
      cleanings: number;
      cleaning: number;
      pet: number;
      futureCleanings: number;
      futureCleaning: number;
      futurePet: number;
    }
  >();

  // Earned revenue from cleaned registrations
  for (const reg of cleanedRegs) {
    const dateStr = cleanedAtMap.get(reg.id) || reg.check_out_date;
    if (!inDateRange(dateStr)) continue;

    const rev = regRevenue(reg);
    const monthKey = dateStr.slice(0, 7);

    const existing = monthlyMap.get(monthKey) || {
      cleaning: 0,
      pet: 0,
      futureCleaning: 0,
      futurePet: 0,
    };
    existing.cleaning += rev.cleaning;
    existing.pet += rev.pet;
    monthlyMap.set(monthKey, existing);

    const prop = propMap.get(reg.property_id);
    if (!prop) continue;
    const pStat = propertyStats.get(prop.name) || {
      cleanings: 0,
      cleaning: 0,
      pet: 0,
      futureCleanings: 0,
      futureCleaning: 0,
      futurePet: 0,
    };
    pStat.cleanings += 1;
    pStat.cleaning += rev.cleaning;
    pStat.pet += rev.pet;
    propertyStats.set(prop.name, pStat);
  }

  // Projected revenue from future bookings
  for (const reg of futureRegs) {
    if (!inDateRange(reg.check_out_date)) continue;

    const rev = regRevenue(reg);
    const monthKey = reg.check_out_date.slice(0, 7);

    const existing = monthlyMap.get(monthKey) || {
      cleaning: 0,
      pet: 0,
      futureCleaning: 0,
      futurePet: 0,
    };
    existing.futureCleaning += rev.cleaning;
    existing.futurePet += rev.pet;
    monthlyMap.set(monthKey, existing);

    const prop = propMap.get(reg.property_id);
    if (!prop) continue;
    const pStat = propertyStats.get(prop.name) || {
      cleanings: 0,
      cleaning: 0,
      pet: 0,
      futureCleanings: 0,
      futureCleaning: 0,
      futurePet: 0,
    };
    pStat.futureCleanings += 1;
    pStat.futureCleaning += rev.cleaning;
    pStat.futurePet += rev.pet;
    propertyStats.set(prop.name, pStat);
  }

  // Build month array — cover from 6 months ago through 3 months ahead
  const months: Array<{
    month: string;
    cleaningRevenue: number;
    petFeeRevenue: number;
    futureCleaningRevenue: number;
    futurePetFeeRevenue: number;
  }> = [];

  for (let i = -5; i <= 3; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (filterFrom && key < filterFrom.slice(0, 7)) continue;
    if (filterTo && key > filterTo.slice(0, 7)) continue;
    const data = monthlyMap.get(key) || {
      cleaning: 0,
      pet: 0,
      futureCleaning: 0,
      futurePet: 0,
    };
    months.push({
      month: key,
      cleaningRevenue: data.cleaning,
      petFeeRevenue: data.pet,
      futureCleaningRevenue: data.futureCleaning,
      futurePetFeeRevenue: data.futurePet,
    });
  }

  // Per-property sorted by total (earned + projected) desc
  const byProperty = Array.from(propertyStats.entries())
    .map(([name, s]) => ({
      name,
      cleanings: s.cleanings,
      cleaningRevenue: s.cleaning,
      petFeeRevenue: s.pet,
      totalRevenue: s.cleaning + s.pet,
      futureCleanings: s.futureCleanings,
      futureRevenue: s.futureCleaning + s.futurePet,
    }))
    .sort((a, b) => b.totalRevenue + b.futureRevenue - (a.totalRevenue + a.futureRevenue));

  // --- Open balance (unbilled cleanings — always unfiltered) ---
  const { data: existingInvoices } = await supabase
    .from("cleaner_invoice")
    .select("line_items")
    .eq("cleaner_id", cleaner.id)
    .neq("status", "draft");

  const billedRegIds = new Set<string>();
  for (const inv of existingInvoices || []) {
    const items = inv.line_items as InvoiceLineItem[];
    for (const item of items) {
      if (item.registration_id) billedRegIds.add(item.registration_id);
    }
  }

  let openBalance = 0;
  for (const reg of cleanedRegs) {
    if (billedRegIds.has(reg.id)) continue;
    const rev = regRevenue(reg);
    openBalance += rev.cleaning + rev.pet;
  }

  // Future revenue total (within filter range)
  let futureRevenue = 0;
  for (const reg of futureRegs) {
    if (!inDateRange(reg.check_out_date)) continue;
    const rev = regRevenue(reg);
    futureRevenue += rev.cleaning + rev.pet;
  }

  return (
    <AnalyticsDashboard
      upcomingCleanings={upcomingCleanings}
      openBalance={openBalance}
      futureRevenue={futureRevenue}
      monthlyRevenue={months}
      byProperty={byProperty}
      filterFrom={filterFrom}
      filterTo={filterTo}
    />
  );
}
