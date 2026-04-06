import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import type { InvoiceLineItem, InvoiceAdjustment, InvoiceAttachment } from "@/types/database";

// GET — list invoices for current cleaner
export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cleaner_invoice")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

// POST — create or update an invoice
export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    period_start: string;
    period_end: string;
    line_items: InvoiceLineItem[];
    adjustments?: InvoiceAdjustment[];
    attachments?: InvoiceAttachment[];
    notes?: string;
    submit?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, period_start, period_end, line_items, adjustments, attachments, notes, submit } = body;

  if (!period_start || !period_end || !line_items || line_items.length === 0) {
    return NextResponse.json({ error: "Period and line items are required" }, { status: 400 });
  }

  const subtotal = line_items.reduce((sum, item) => sum + item.amount, 0);
  const adjustmentTotal = (adjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
  const total = subtotal + adjustmentTotal;

  const supabase = createAdminClient();

  const payload: Record<string, unknown> = {
    cleaner_id: cleaner.id,
    host_id: cleaner.host_id,
    period_start,
    period_end,
    line_items,
    adjustments: adjustments || [],
    attachments: attachments || [],
    subtotal,
    total,
    notes: notes || null,
    status: submit ? "submitted" : "draft",
    submitted_at: submit ? new Date().toISOString() : null,
  };

  let result;

  if (id) {
    // Update existing draft
    const { data: existing } = await supabase
      .from("cleaner_invoice")
      .select("id, status")
      .eq("id", id)
      .eq("cleaner_id", cleaner.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("cleaner_invoice")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    const { data, error } = await supabase
      .from("cleaner_invoice")
      .insert(payload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  return NextResponse.json({ invoice: result });
}
