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
    .select("id, name, nickname, cleaning_fee_cents, owner_email")
    .in("id", propertyIds.length > 0 ? propertyIds : ["_none_"])
    .order("name");

  // Find completed cleanings not yet invoiced
  const { data: cleanedStatuses } = await supabase
    .from("cleaning_status")
    .select("registration_id, cleaned_at, registration!inner(property_id)")
    .eq("is_cleaned", true)
    .eq("is_skipped", false)
    .in("registration.property_id", propertyIds.length > 0 ? propertyIds : ["_none_"]);

  const cleanedRegIds = (cleanedStatuses || []).map((s) => s.registration_id);

  // Get existing invoices to find already-billed registration IDs
  const { data: existingInvoices } = await supabase
    .from("cleaner_invoice")
    .select("line_items")
    .eq("cleaner_id", cleaner.id)
    .neq("status", "draft");

  // Track what has been billed per registration, by kind: the cleaning itself
  // (with its pet fee), the firewood delivery fee, and guest tips. A stay whose
  // cleaning was already invoiced can still owe its firewood fee or tips.
  const billedKinds = new Map<string, Set<"core" | "firewood" | "tip">>();
  for (const inv of existingInvoices || []) {
    const items = inv.line_items as InvoiceLineItem[];
    for (const item of items) {
      if (!item.registration_id) continue;
      let kinds = billedKinds.get(item.registration_id);
      if (!kinds) {
        kinds = new Set();
        billedKinds.set(item.registration_id, kinds);
      }
      if (item.type === "tip") kinds.add("tip");
      else if (item.type === "extra" && /firewood/i.test(item.description)) kinds.add("firewood");
      else kinds.add("core");
    }
  }

  let unbilledCleanings: Array<{
    registration_id: string;
    property_id: string;
    property_name: string;
    property_nickname: string | null;
    check_out_date: string;
    needs_cleaning: boolean;
    has_pets: boolean;
    firewood_count: number;
    tip_cents: number;
  }> = [];

  if (cleanedRegIds.length > 0) {
    const { data: regs } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date, pets, upsells")
      .in("id", cleanedRegIds);

    const propMap = new Map(
      (properties || []).map((p) => [p.id, p])
    );

    unbilledCleanings = (regs || [])
      .filter((r) => propMap.has(r.property_id))
      .map((r) => {
        const prop = propMap.get(r.property_id)!;
        const kinds = billedKinds.get(r.id);
        const pets = r.pets as Array<{ name?: string }> | null;
        const hasPets = (pets || []).some((p) => p.name?.trim());
        const upsells =
          (r.upsells as Array<{ type: string; status: string; price_cents?: number }> | null) || [];
        const paid = upsells.filter((u) => u.status === "paid");
        const firewoodCount = kinds?.has("firewood")
          ? 0
          : paid.filter((u) => u.type === "firewood").length;
        const tipCents = kinds?.has("tip")
          ? 0
          : paid
              .filter((u) => u.type.startsWith("tip_"))
              .reduce((sum, u) => sum + (u.price_cents || 0), 0);
        return {
          registration_id: r.id,
          property_id: r.property_id,
          property_name: prop.name,
          property_nickname: prop.nickname,
          check_out_date: r.check_out_date,
          needs_cleaning: !kinds?.has("core"),
          has_pets: hasPets,
          firewood_count: firewoodCount,
          tip_cents: tipCents,
        };
      })
      .filter((c) => c.needs_cleaning || c.firewood_count > 0 || c.tip_cents > 0)
      .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date));
  }

  return (
    <InvoiceForm
      properties={(properties || []).map((p) => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        cleaningFeeCents: p.cleaning_fee_cents ?? 0,
        petFeeCents: cleaner.pet_fee_cents ?? 0,
        ownerEmail: p.owner_email ?? null,
      }))}
      unbilledCleanings={unbilledCleanings}
    />
  );
}
