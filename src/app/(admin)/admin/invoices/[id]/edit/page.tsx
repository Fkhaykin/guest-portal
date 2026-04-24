import { redirect, notFound } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceForm } from "@/components/cleaner/invoice-form";
import type { InvoiceLineItem, InvoiceAdjustment, InvoiceAttachment } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminInvoiceEditPage({
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
    .select("*")
    .eq("id", id)
    .eq("host_id", host.id)
    .single();

  if (!invoice) notFound();

  // Get cleaner's pet fee rate
  const { data: invoiceCleaner } = await admin
    .from("cleaner")
    .select("pet_fee_cents")
    .eq("id", invoice.cleaner_id)
    .single();
  const cleanerPetFee = invoiceCleaner?.pet_fee_cents ?? 0;

  // Load properties for the form (needed for cleaning line property selectors)
  const { data: properties } = await admin
    .from("property")
    .select("id, name, cleaning_fee_cents")
    .eq("host_id", host.id)
    .order("name");

  const formProperties = (properties || []).map((p) => ({
    id: p.id,
    name: p.name,
    cleaningFeeCents: p.cleaning_fee_cents || 0,
    petFeeCents: cleanerPetFee,
  }));

  return (
    <InvoiceForm
      properties={formProperties}
      initialData={{
        id: invoice.id,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        due_date: invoice.due_date ?? null,
        line_items: invoice.line_items as InvoiceLineItem[],
        adjustments: (invoice.adjustments as InvoiceAdjustment[]) || [],
        attachments: (invoice.attachments as InvoiceAttachment[]) || [],
        notes: invoice.notes,
      }}
      saveEndpoint="/api/admin/invoices"
      saveMethod="PUT"
      uploadEndpoint="/api/admin/upload-invoice-attachment"
      redirectPath={`/admin/invoices/${id}`}
      mode="admin"
    />
  );
}
