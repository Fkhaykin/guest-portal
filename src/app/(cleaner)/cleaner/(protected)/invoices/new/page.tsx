import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { InvoiceForm } from "@/components/cleaner/invoice-form";
import type { InvoiceLineItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  // Get assigned properties with fee configuration
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  const { data: properties } = await supabase
    .from("property")
    .select("id, name, cleaning_fee_cents, pet_fee_cents")
    .in("id", propertyIds.length > 0 ? propertyIds : ["_none_"])
    .order("name");

  // Find completed cleanings not yet invoiced
  // Get all cleaning_status records that are cleaned, for cleaner's properties
  const { data: cleanedStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, cleaned_at")
    .eq("is_cleaned", true)
    .eq("cleaner_id", cleaner.id);

  const cleanedRegIds = (cleanedStatuses || []).map((s) => s.registration_id);

  // Get existing invoices to find already-billed registration IDs
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

  // Get registration details for unbilled cleanings
  const unbilledRegIds = cleanedRegIds.filter((id) => !billedRegIds.has(id));
  let unbilledCleanings: Array<{
    registration_id: string;
    property_id: string;
    property_name: string;
    check_out_date: string;
    has_pets: boolean;
  }> = [];

  if (unbilledRegIds.length > 0) {
    const { data: regs } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date, pets")
      .in("id", unbilledRegIds);

    const propMap = new Map(
      (properties || []).map((p) => [p.id, p])
    );

    unbilledCleanings = (regs || [])
      .filter((r) => propMap.has(r.property_id))
      .map((r) => {
        const prop = propMap.get(r.property_id)!;
        const pets = r.pets as Array<{ name?: string }> | null;
        const hasPets = (pets || []).some((p) => p.name?.trim());
        return {
          registration_id: r.id,
          property_id: r.property_id,
          property_name: prop.name,
          check_out_date: r.check_out_date,
          has_pets: hasPets,
        };
      })
      .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date));
  }

  return (
    <InvoiceForm
      properties={(properties || []).map((p) => ({
        id: p.id,
        name: p.name,
        cleaningFeeCents: p.cleaning_fee_cents ?? 0,
        petFeeCents: p.pet_fee_cents ?? 0,
      }))}
      unbilledCleanings={unbilledCleanings}
    />
  );
}
