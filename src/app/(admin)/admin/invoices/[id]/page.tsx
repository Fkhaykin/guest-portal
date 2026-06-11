import { redirect, notFound } from "next/navigation";
import {
  createClient as createServerClient,
  getAuthenticatedUser,
} from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminInvoiceDetail } from "@/components/admin/invoice-detail";
import type { InvoiceLineItem, InvoiceAttachment, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const user = await getAuthenticatedUser(supabase);
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
    .select("*, cleaner:cleaner_id(name, phone, company, email)")
    .eq("id", id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) notFound();

  // Generate signed URLs for attachments
  const attachments = (invoice.attachments as InvoiceAttachment[] | null) ?? [];
  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (att) => {
      const { data } = await admin.storage
        .from("invoice-attachments")
        .createSignedUrl(att.path, 3600);
      return { ...att, url: data?.signedUrl ?? null };
    })
  );

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
        due_date: invoice.due_date ?? null,
        created_at: invoice.created_at,
        cleaner_name: (invoice.cleaner as { name: string; phone: string | null; company: string | null; email: string | null } | null)?.name || "Unknown",
        cleaner_phone: (invoice.cleaner as { name: string; phone: string | null; company: string | null; email: string | null } | null)?.phone || null,
        cleaner_company: (invoice.cleaner as { name: string; phone: string | null; company: string | null; email: string | null } | null)?.company || null,
        cleaner_email: (invoice.cleaner as { name: string; phone: string | null; company: string | null; email: string | null } | null)?.email || null,
        attachments: attachmentsWithUrls,
      }}
    />
  );
}
