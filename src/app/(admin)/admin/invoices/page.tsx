import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminInvoiceTabs } from "@/components/admin/invoice-tabs";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export type AdminInvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  due_date: string | null;
  total: number;
  created_at: string;
  cleaner_name: string;
  is_bianca: boolean;
  is_monthly: boolean;
};

export type AdminUnpaidCleaning = {
  registrationId: string;
  propertyName: string;
  propertyNickname: string | null;
  propertyCoverImage: string | null;
  cleanerName: string;
  cleanerId: string;
  guestName: string | null;
  checkInDate: string;
  checkOutDate: string;
  cleanedAt: string | null;
  guestCount: number;
  petCount: number;
  hasPets: boolean;
  cleaningFee: number;
  petFee: number;
  totalFee: number;
  skipped: boolean;
};

export default async function AdminInvoicesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) redirect("/auth/login");

  const admin = createAdminClient();

  // --- Get all cleaners for this host ---
  const { data: cleaners } = await admin
    .from("cleaner")
    .select("id, name")
    .eq("host_id", host.id)
    .eq("is_active", true);

  const cleanerIds = (cleaners || []).map((c) => c.id);
  const cleanerNameMap = new Map(
    (cleaners || []).map((c) => [c.id, c.name])
  );

  // --- Tab 1: Unpaid cleanings across all cleaners ---
  let unpaidCleanings: AdminUnpaidCleaning[] = [];

  if (cleanerIds.length > 0) {
    // Get all cleaner-property assignments
    const { data: assignments } = await admin
      .from("cleaner_property")
      .select("cleaner_id, property_id")
      .in("cleaner_id", cleanerIds);

    const allPropertyIds = [
      ...new Set((assignments || []).map((a) => a.property_id)),
    ];

    // Build cleaner→properties map
    const cleanerPropertyMap = new Map<string, string[]>();
    for (const a of assignments || []) {
      const list = cleanerPropertyMap.get(a.cleaner_id) || [];
      list.push(a.property_id);
      cleanerPropertyMap.set(a.cleaner_id, list);
    }

    // Build property→cleaner map (for display)
    const propertyCleanerMap = new Map<string, string>();
    for (const a of assignments || []) {
      propertyCleanerMap.set(a.property_id, a.cleaner_id);
    }

    if (allPropertyIds.length > 0) {
      // Get properties with fees
      const { data: properties } = await admin
        .from("property")
        .select("id, name, nickname, cover_image_url, cleaning_fee_cents")
        .in("id", allPropertyIds);

      // Get cleaner pet fees
      const { data: cleanerRows } = await admin
        .from("cleaner")
        .select("id, pet_fee_cents")
        .in("id", cleanerIds);
      const cleanerPetFeeMap = new Map(
        (cleanerRows || []).map((c) => [c.id, c.pet_fee_cents ?? 0])
      );

      const propMap = new Map(
        (properties || []).map((p) => [p.id, p])
      );

      // Get all registrations with checkouts since 2026-03-15 at assigned properties
      const { data: allRegs } = await admin
        .from("registration")
        .select(
          "id, property_id, check_in_date, check_out_date, num_guests, pets, guest:guest_id(full_name)"
        )
        .in("property_id", allPropertyIds)
        .gte("check_out_date", "2026-03-15");

      const allRegIds = (allRegs || []).map((r) => r.id);

      // Get cleaned statuses for these registrations (incl. skipped)
      const { data: cleanedStatuses } = allRegIds.length > 0
        ? await admin
            .from("cleaning_status")
            .select("registration_id, cleaned_at, is_skipped")
            .eq("is_cleaned", true)
            .in("registration_id", allRegIds)
        : { data: [] };

      const cleanedStatusMap = new Map(
        (cleanedStatuses || []).map((s) => [
          s.registration_id,
          { cleanedAt: s.cleaned_at, skipped: s.is_skipped },
        ])
      );

      // Get registration IDs already on non-draft invoices across all cleaners
      const { data: existingInvoices } = await admin
        .from("cleaner_invoice")
        .select("line_items")
        .in("cleaner_id", cleanerIds)
        .neq("status", "draft");

      const billedRegIds = new Set<string>();
      for (const inv of existingInvoices || []) {
        const items = inv.line_items as InvoiceLineItem[];
        for (const item of items) {
          if (item.registration_id) billedRegIds.add(item.registration_id);
        }
      }

      const unbilledRegs = (allRegs || []).filter(
        (r) => !billedRegIds.has(r.id) && propMap.has(r.property_id) && cleanedStatusMap.has(r.id)
      );

      if (unbilledRegs.length > 0) {
        unpaidCleanings = unbilledRegs
          .map((r) => {
            const prop = propMap.get(r.property_id)!;
            const pets = r.pets as Array<{ name?: string }> | null;
            const hasPets = (pets || []).some((p) => p.name?.trim());
            const cleaningFee = prop.cleaning_fee_cents ?? 0;
            const cleanerId = propertyCleanerMap.get(r.property_id) || "";
            const petFee = hasPets ? (cleanerPetFeeMap.get(cleanerId) ?? 0) : 0;
            const guest = r.guest as unknown as {
              full_name: string;
            } | null;
            const petCount = (pets || []).filter((p) => p.name?.trim()).length;
            const status = cleanedStatusMap.get(r.id);
            return {
              registrationId: r.id,
              propertyName: prop.name,
              propertyNickname: prop.nickname,
              propertyCoverImage: prop.cover_image_url,
              cleanerName: cleanerNameMap.get(cleanerId) || "Unknown",
              cleanerId,
              guestName: guest?.full_name || null,
              checkInDate: r.check_in_date,
              checkOutDate: r.check_out_date,
              cleanedAt: status?.cleanedAt || null,
              guestCount: r.num_guests,
              petCount,
              hasPets,
              cleaningFee,
              petFee,
              totalFee: cleaningFee + petFee,
              skipped: status?.skipped ?? false,
            };
          })
          .sort((a, b) => b.checkOutDate.localeCompare(a.checkOutDate));
      }
    }
  }

  // --- Auto-create monthly fee invoices for the current month ---
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  if (cleanerIds.length > 0) {
    // Get cleaners with monthly fees
    const { data: cleanersWithFees } = await admin
      .from("cleaner")
      .select("id, host_id, name, monthly_fee_cents")
      .in("id", cleanerIds)
      .gt("monthly_fee_cents", 0);

    for (const cl of cleanersWithFees || []) {
      // Check if monthly fee invoice already exists for this month
      const { data: existing } = await admin
        .from("cleaner_invoice")
        .select("id, line_items")
        .eq("cleaner_id", cl.id)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      const alreadyHas = (existing || []).some((inv) => {
        const items = inv.line_items as InvoiceLineItem[];
        return items.some((item) => item.type === "monthly_fee");
      });

      if (alreadyHas) continue;

      const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
      const lineItems: InvoiceLineItem[] = [
        {
          description: `Monthly fee — ${monthName}`,
          type: "monthly_fee",
          amount: cl.monthly_fee_cents,
        },
      ];

      await admin.from("cleaner_invoice").insert({
        cleaner_id: cl.id,
        host_id: cl.host_id,
        status: "open",
        period_start: periodStart,
        period_end: periodEnd,
        line_items: lineItems,
        adjustments: [],
        attachments: [],
        subtotal: cl.monthly_fee_cents,
        total: cl.monthly_fee_cents,
        notes: `Monthly fee for ${monthName}`,
      });
    }
  }

  // --- Tab 2: Invoice history ---
  const { data: invoices } = await admin
    .from("cleaner_invoice")
    .select("*, cleaner:cleaner_id(name)")
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  // Build property-name → nickname map for this host (used for is_bianca lookup)
  const { data: hostProperties } = await admin
    .from("property")
    .select("name, nickname")
    .eq("host_id", host.id);
  const propertyNicknameMap = new Map(
    (hostProperties || []).map((p) => [p.name, p.nickname])
  );

  // Sort: open invoices first, then by created_at desc
  const sortedInvoices = (invoices || []).sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const invoiceRows: AdminInvoiceRow[] = sortedInvoices.map((inv) => {
    const items = inv.line_items as InvoiceLineItem[];
    const cleanerName =
      (inv.cleaner as { name: string } | null)?.name || "Unknown";
    const isBianca = items.some((item) => {
      const propName = item.property_name;
      if (!propName) return false;
      const nickname = propertyNicknameMap.get(propName);
      return nickname?.toLowerCase().includes("bianca") ?? false;
    });
    const isMonthly = items.some((item) => item.type === "monthly_fee");
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status as InvoiceStatus,
      period_start: inv.period_start,
      period_end: inv.period_end,
      due_date: inv.due_date ?? null,
      total: inv.total,
      created_at: inv.created_at,
      cleaner_name: cleanerName,
      is_bianca: isBianca,
      is_monthly: isMonthly,
    };
  });

  return (
    <AdminInvoiceTabs
      unpaidCleanings={unpaidCleanings}
      invoices={invoiceRows}
    />
  );
}
