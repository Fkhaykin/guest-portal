import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem } from "@/types/database";

// POST /api/cleaner/invoices/auto-generate
// Generates weekly invoices for all cleaners with unbilled cleanings.
// Called by a cron job (every Monday) or manually by the host.
// Requires CRON_SECRET header for security.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  // Get all active cleaners
  const { data: cleaners } = await supabase
    .from("cleaner")
    .select("id, host_id")
    .eq("is_active", true);

  if (!cleaners || cleaners.length === 0) {
    return NextResponse.json({ message: "No active cleaners", invoices_created: 0 });
  }

  let invoicesCreated = 0;

  for (const cleaner of cleaners) {
    // Get all cleaned registrations for this cleaner
    const { data: cleanedStatuses } = await supabase
      .from("cleaning_status")
      .select("registration_id, cleaned_at")
      .eq("is_cleaned", true)
      .eq("cleaner_id", cleaner.id);

    if (!cleanedStatuses || cleanedStatuses.length === 0) continue;

    const cleanedRegIds = cleanedStatuses.map((s) => s.registration_id);

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
    if (unbilledRegIds.length === 0) continue;

    // Get registration + property details
    const { data: regs } = await supabase
      .from("registration")
      .select("id, property_id, check_out_date, pets")
      .in("id", unbilledRegIds);

    if (!regs || regs.length === 0) continue;

    // Get assigned properties with fees
    const { data: assignments } = await supabase
      .from("cleaner_property")
      .select("property_id")
      .eq("cleaner_id", cleaner.id);

    const propertyIds = (assignments || []).map((a) => a.property_id);

    const { data: properties } = await supabase
      .from("property")
      .select("id, name, cleaning_fee_cents, pet_fee_cents")
      .in("id", propertyIds);

    const propMap = new Map((properties || []).map((p) => [p.id, p]));

    // Build line items
    const lineItems: InvoiceLineItem[] = [];
    let periodStart = "";
    let periodEnd = "";

    for (const reg of regs) {
      const prop = propMap.get(reg.property_id);
      if (!prop) continue;

      const cleaningFee = prop.cleaning_fee_cents ?? 0;
      if (cleaningFee > 0) {
        lineItems.push({
          description: `Cleaning — ${prop.name} (checkout ${reg.check_out_date})`,
          type: "cleaning",
          property_name: prop.name,
          registration_id: reg.id,
          amount: cleaningFee,
        });
      }

      // Pet fee
      const pets = reg.pets as Array<{ name?: string }> | null;
      const hasPets = (pets || []).some((p) => p.name?.trim());
      const petFee = prop.pet_fee_cents ?? 0;
      if (hasPets && petFee > 0) {
        lineItems.push({
          description: `Pet fee — ${prop.name} (checkout ${reg.check_out_date})`,
          type: "pet_fee",
          property_name: prop.name,
          registration_id: reg.id,
          amount: petFee,
        });
      }

      // Track period
      if (!periodStart || reg.check_out_date < periodStart) {
        periodStart = reg.check_out_date;
      }
      if (!periodEnd || reg.check_out_date > periodEnd) {
        periodEnd = reg.check_out_date;
      }
    }

    if (lineItems.length === 0) continue;

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);

    // Create the invoice as "submitted" (auto-generated, ready for host review)
    const { error } = await supabase.from("cleaner_invoice").insert({
      cleaner_id: cleaner.id,
      host_id: cleaner.host_id,
      status: "submitted",
      period_start: periodStart,
      period_end: periodEnd,
      line_items: lineItems,
      adjustments: [],
      attachments: [],
      subtotal,
      total: subtotal,
      notes: "Auto-generated weekly invoice",
      submitted_at: new Date().toISOString(),
    });

    if (!error) invoicesCreated++;
  }

  return NextResponse.json({
    message: `Generated ${invoicesCreated} invoice(s)`,
    invoices_created: invoicesCreated,
  });
}
