import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceLineItem } from "@/types/database";

// PATCH — update invoice status (approve / mark paid)
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { invoice_id: string; status?: "approved" | "paid"; due_date?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id, status, due_date } = body;
  if (!invoice_id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (status !== undefined && !["approved", "paid"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify invoice belongs to this host
  const { data: invoice } = await admin
    .from("cleaner_invoice")
    .select("id, status")
    .eq("id", invoice_id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === "approved") updates.approved_at = new Date().toISOString();
    if (status === "paid") updates.paid_at = new Date().toISOString();
  }
  if ("due_date" in body) updates.due_date = due_date ?? null;

  const { error } = await admin
    .from("cleaner_invoice")
    .update(updates)
    .eq("id", invoice_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — delete invoice
export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { invoice_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id } = body;
  if (!invoice_id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify invoice belongs to this host
  const { data: invoice } = await admin
    .from("cleaner_invoice")
    .select("id")
    .eq("id", invoice_id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("cleaner_invoice")
    .delete()
    .eq("id", invoice_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PUT — admin edit invoice content (line items, notes, adjustments, attachments, period)
export async function PUT(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    invoice_id: string;
    period_start: string;
    period_end: string;
    due_date?: string | null;
    line_items: import("@/types/database").InvoiceLineItem[];
    adjustments?: import("@/types/database").InvoiceAdjustment[];
    attachments?: import("@/types/database").InvoiceAttachment[];
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id, period_start, period_end, due_date, line_items, adjustments, attachments, notes } = body;

  if (!invoice_id || !period_start || !period_end || !line_items?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify invoice belongs to this host
  const { data: invoice } = await admin
    .from("cleaner_invoice")
    .select("id")
    .eq("id", invoice_id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const subtotal = line_items.reduce((sum, item) => sum + item.amount, 0);
  const adjustmentTotal = (adjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
  const total = subtotal + adjustmentTotal;

  const { error: putError } = await admin
    .from("cleaner_invoice")
    .update({
      period_start,
      period_end,
      due_date: due_date ?? null,
      line_items,
      adjustments: adjustments || [],
      attachments: attachments || [],
      subtotal,
      total,
      notes: notes || null,
    })
    .eq("id", invoice_id);

  if (putError) {
    return NextResponse.json({ error: putError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// POST — manually generate invoices for specified unpaid cleanings
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    cleanings: {
      registrationId: string;
      cleanerId: string;
      propertyName: string;
      checkOutDate: string;
      cleaningFee: number;
      petFee: number;
      hasPets: boolean;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.cleanings?.length) {
    return NextResponse.json({ error: "No cleanings provided" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify all cleaners belong to this host
  const cleanerIds = [...new Set(body.cleanings.map((c) => c.cleanerId))];
  const { data: validCleaners } = await admin
    .from("cleaner")
    .select("id")
    .eq("host_id", host.id)
    .in("id", cleanerIds);

  const validCleanerIds = new Set((validCleaners || []).map((c) => c.id));
  const filteredCleanings = body.cleanings.filter((c) =>
    validCleanerIds.has(c.cleanerId)
  );

  if (filteredCleanings.length === 0) {
    return NextResponse.json({ error: "No valid cleanings" }, { status: 400 });
  }

  // Check which registration IDs are already billed
  const { data: existingInvoices } = await admin
    .from("cleaner_invoice")
    .select("line_items")
    .eq("host_id", host.id)
    .neq("status", "draft");

  const billedRegIds = new Set<string>();
  for (const inv of existingInvoices || []) {
    const items = inv.line_items as InvoiceLineItem[];
    for (const item of items) {
      if (item.registration_id) billedRegIds.add(item.registration_id);
    }
  }

  const unbilledCleanings = filteredCleanings.filter(
    (c) => !billedRegIds.has(c.registrationId)
  );

  if (unbilledCleanings.length === 0) {
    return NextResponse.json({ error: "All cleanings already billed" }, { status: 400 });
  }

  // Group by cleaner
  const byCleanerId = new Map<string, typeof unbilledCleanings>();
  for (const c of unbilledCleanings) {
    const list = byCleanerId.get(c.cleanerId) || [];
    list.push(c);
    byCleanerId.set(c.cleanerId, list);
  }

  let invoicesCreated = 0;

  for (const [cleanerId, cleanings] of byCleanerId) {
    const lineItems: InvoiceLineItem[] = [];
    let periodStart = "";
    let periodEnd = "";

    for (const c of cleanings) {
      if (c.cleaningFee > 0) {
        lineItems.push({
          description: `Cleaning — ${c.propertyName} (checkout ${c.checkOutDate})`,
          type: "cleaning",
          property_name: c.propertyName,
          registration_id: c.registrationId,
          amount: c.cleaningFee,
        });
      }

      if (c.hasPets && c.petFee > 0) {
        lineItems.push({
          description: `Pet fee — ${c.propertyName} (checkout ${c.checkOutDate})`,
          type: "pet_fee",
          property_name: c.propertyName,
          registration_id: c.registrationId,
          amount: c.petFee,
        });
      }

      if (!periodStart || c.checkOutDate < periodStart) {
        periodStart = c.checkOutDate;
      }
      if (!periodEnd || c.checkOutDate > periodEnd) {
        periodEnd = c.checkOutDate;
      }
    }

    if (lineItems.length === 0) continue;

    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);

    const { error } = await admin.from("cleaner_invoice").insert({
      cleaner_id: cleanerId,
      host_id: host.id,
      status: "submitted",
      period_start: periodStart,
      period_end: periodEnd,
      line_items: lineItems,
      adjustments: [],
      attachments: [],
      subtotal,
      total: subtotal,
      notes: "Manually generated invoice",
      submitted_at: new Date().toISOString(),
    });

    if (!error) invoicesCreated++;
  }

  return NextResponse.json({
    success: true,
    invoices_created: invoicesCreated,
  });
}
