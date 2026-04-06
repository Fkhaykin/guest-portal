import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { InvoiceList } from "@/components/cleaner/invoice-list";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  line_items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export default async function InvoicesPage() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  const { data: invoices } = await supabase
    .from("cleaner_invoice")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .order("created_at", { ascending: false });

  return <InvoiceList invoices={(invoices || []) as InvoiceRow[]} />;
}
