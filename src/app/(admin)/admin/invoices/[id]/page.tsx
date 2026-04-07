import { redirect, notFound } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminInvoiceDetail } from "@/components/admin/invoice-detail";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

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
  const { data: invoice } = await admin
    .from("cleaner_invoice")
    .select("*, cleaner:cleaner_id(name)")
    .eq("id", id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) notFound();

  return (
    <AdminInvoiceDetail
      invoice={{
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status as InvoiceStatus,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        line_items: invoice.line_items as InvoiceLineItem[],
        subtotal: invoice.subtotal,
        total: invoice.total,
        notes: invoice.notes,
        submitted_at: invoice.submitted_at,
        approved_at: invoice.approved_at,
        paid_at: invoice.paid_at,
        created_at: invoice.created_at,
        cleaner_name: (invoice.cleaner as { name: string } | null)?.name || "Unknown",
      }}
    />
  );
}
