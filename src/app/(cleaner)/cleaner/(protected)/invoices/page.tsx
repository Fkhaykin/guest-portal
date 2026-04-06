import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { InvoiceTabs } from "@/components/cleaner/invoice-tabs";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  line_items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type UnpaidCleaning = {
  registrationId: string;
  propertyName: string;
  propertyCoverImage: string | null;
  checkOutDate: string;
  cleanedAt: string | null;
  guestCount: number;
  hasPets: boolean;
  cleaningFee: number; // cents
  petFee: number; // cents
  totalFee: number; // cents
};

export default async function InvoicesPage() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  // --- Tab 1: Unpaid cleanings ---

  // Get assigned properties with fees
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, cover_image_url, cleaning_fee_cents, pet_fee_cents")
    .in("id", propertyIds.length > 0 ? propertyIds : ["_none_"]);

  const propMap = new Map(
    (properties || []).map((p) => [p.id, p])
  );

  // Get all cleaned registrations for this cleaner
  const { data: cleanedStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, cleaned_at")
    .eq("is_cleaned", true)
    .eq("cleaner_id", cleaner.id);

  const cleanedRegIds = (cleanedStatuses || []).map((s) => s.registration_id);
  const cleanedAtMap = new Map(
    (cleanedStatuses || []).map((s) => [s.registration_id, s.cleaned_at])
  );

  // Get registration IDs already on non-draft invoices
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

  const unbilledRegIds = cleanedRegIds.filter((id) => !billedRegIds.has(id));

  let unpaidCleanings: UnpaidCleaning[] = [];
  if (unbilledRegIds.length > 0) {
    const { data: regs } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date, num_guests, pets")
      .in("id", unbilledRegIds);

    unpaidCleanings = (regs || [])
      .filter((r) => propMap.has(r.property_id))
      .map((r) => {
        const prop = propMap.get(r.property_id)!;
        const pets = r.pets as Array<{ name?: string }> | null;
        const hasPets = (pets || []).some((p) => p.name?.trim());
        const cleaningFee = prop.cleaning_fee_cents ?? 0;
        const petFee = hasPets ? (prop.pet_fee_cents ?? 0) : 0;
        return {
          registrationId: r.id,
          propertyName: prop.name,
          propertyCoverImage: prop.cover_image_url,
          checkOutDate: r.check_out_date,
          cleanedAt: cleanedAtMap.get(r.id) || null,
          guestCount: r.num_guests,
          hasPets,
          cleaningFee,
          petFee,
          totalFee: cleaningFee + petFee,
        };
      })
      .sort((a, b) => b.checkOutDate.localeCompare(a.checkOutDate));
  }

  // --- Tab 2: Invoice history ---
  const { data: invoices } = await supabase
    .from("cleaner_invoice")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .order("created_at", { ascending: false });

  return (
    <InvoiceTabs
      unpaidCleanings={unpaidCleanings}
      invoices={(invoices || []) as InvoiceRow[]}
    />
  );
}
