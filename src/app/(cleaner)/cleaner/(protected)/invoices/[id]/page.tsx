import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { InvoiceDetail } from "@/components/cleaner/invoice-detail";
import type { InvoiceLineItem, InvoiceAdjustment, InvoiceAttachment, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("cleaner_invoice")
    .select("*")
    .eq("id", id)
    .eq("cleaner_id", cleaner.id)
    .single();

  if (!invoice) notFound();

  return (
    <InvoiceDetail
      invoice={{
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status as InvoiceStatus,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        line_items: invoice.line_items as InvoiceLineItem[],
        adjustments: (invoice.adjustments as InvoiceAdjustment[]) || [],
        attachments: (invoice.attachments as InvoiceAttachment[]) || [],
        subtotal: invoice.subtotal,
        total: invoice.total,
        notes: invoice.notes,
        submitted_at: invoice.submitted_at,
        approved_at: invoice.approved_at,
        paid_at: invoice.paid_at,
        created_at: invoice.created_at,
      }}
      canEdit={invoice.status === "draft"}
    />
  );
}
