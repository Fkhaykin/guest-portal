import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  let body: { invoice_id: string; status: "approved" | "paid" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id, status } = body;
  if (!invoice_id || !["approved", "paid"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

  const updates: Record<string, unknown> = { status };
  if (status === "approved") updates.approved_at = new Date().toISOString();
  if (status === "paid") updates.paid_at = new Date().toISOString();

  const { error } = await admin
    .from("cleaner_invoice")
    .update(updates)
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

  const { invoice_id, period_start, period_end, line_items, adjustments, attachments, notes } = body;

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

  const { error } = await admin
    .from("cleaner_invoice")
    .update({
      period_start,
      period_end,
      line_items,
      adjustments: adjustments || [],
      attachments: attachments || [],
      subtotal,
      total,
      notes: notes || null,
    })
    .eq("id", invoice_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
