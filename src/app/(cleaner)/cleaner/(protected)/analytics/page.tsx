import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { AnalyticsDashboard } from "@/components/cleaner/analytics-dashboard";
import type { InvoiceLineItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
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
    .select("id, name, nickname, cleaning_fee_cents, pet_fee_cents")
    .in("id", propertyIds);

  const propMap = new Map(
    (properties || []).map((p) => [
      p.id,
      {
        name: p.nickname || p.name,
        cleaningFee: p.cleaning_fee_cents ?? 0,
        petFee: p.pet_fee_cents ?? 0,
      },
    ])
  );

  // --- Upcoming cleanings (check-out today or future, not yet cleaned) ---
  const today = new Date().toISOString().split("T")[0];

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

  // --- All cleaned registrations (for revenue data) ---
  const { data: cleanedStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, cleaned_at")
    .eq("is_cleaned", true)
    .eq("cleaner_id", cleaner.id);

  const cleanedRegIds = (cleanedStatuses || []).map((s) => s.registration_id);
  const cleanedAtMap = new Map(
    (cleanedStatuses || []).map((s) => [s.registration_id, s.cleaned_at])
  );

  // Fetch all cleaned registrations for revenue calculations
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

  // --- Build monthly revenue data (last 6 months) ---
  type MonthData = {
    month: string;
    cleaningRevenue: number;
    petFeeRevenue: number;
  };

  const monthlyMap = new Map<string, { cleaning: number; pet: number }>();
  // Per-property stats
  const propertyStats = new Map<
    string,
    { cleanings: number; cleaning: number; pet: number }
  >();

  for (const reg of cleanedRegs) {
    const prop = propMap.get(reg.property_id);
    if (!prop) continue;

    const hasPets = (reg.pets || []).some((p) => p.name?.trim());
    const cleaningFee = prop.cleaningFee;
    const petFee = hasPets ? prop.petFee : 0;

    // Use cleaned_at date for monthly bucketing, fallback to check_out_date
    const dateStr = cleanedAtMap.get(reg.id) || reg.check_out_date;
    const monthKey = dateStr.slice(0, 7); // YYYY-MM

    const existing = monthlyMap.get(monthKey) || { cleaning: 0, pet: 0 };
    existing.cleaning += cleaningFee;
    existing.pet += petFee;
    monthlyMap.set(monthKey, existing);

    // Per-property
    const propName = prop.name;
    const pStat = propertyStats.get(propName) || {
      cleanings: 0,
      cleaning: 0,
      pet: 0,
    };
    pStat.cleanings += 1;
    pStat.cleaning += cleaningFee;
    pStat.pet += petFee;
    propertyStats.set(propName, pStat);
  }

  // Build sorted monthly array (last 6 months)
  const months: MonthData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const data = monthlyMap.get(key) || { cleaning: 0, pet: 0 };
    months.push({
      month: key,
      cleaningRevenue: data.cleaning,
      petFeeRevenue: data.pet,
    });
  }

  // Per-property array sorted by total revenue desc
  const byProperty = Array.from(propertyStats.entries())
    .map(([name, stats]) => ({
      name,
      cleanings: stats.cleanings,
      cleaningRevenue: stats.cleaning,
      petFeeRevenue: stats.pet,
      totalRevenue: stats.cleaning + stats.pet,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // --- Open balance (unbilled cleanings) ---
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
    const prop = propMap.get(reg.property_id);
    if (!prop) continue;
    const hasPets = (reg.pets || []).some((p) => p.name?.trim());
    openBalance += prop.cleaningFee + (hasPets ? prop.petFee : 0);
  }

  return (
    <AnalyticsDashboard
      upcomingCleanings={upcomingCleanings}
      openBalance={openBalance}
      monthlyRevenue={months}
      byProperty={byProperty}
    />
  );
}
