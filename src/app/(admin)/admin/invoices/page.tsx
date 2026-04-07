import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Receipt } from "lucide-react";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminInvoicesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Get host record
  const { data: host } = await supabase
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) redirect("/auth/login");

  // Get all invoices for this host, with cleaner name
  // Use admin client — cleaner tables have no host RLS policies
  const admin = createAdminClient();
  const { data: invoices } = await admin
    .from("cleaner_invoice")
    .select("*, cleaner:cleaner_id(name)")
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  const rows = (invoices || []) as Array<{
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    period_start: string;
    period_end: string;
    total: number;
    created_at: string;
    cleaner: { name: string } | null;
  }>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Cleaner Invoices</h1>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Receipt className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">No invoices submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((inv) => (
            <Link key={inv.id} href={`/admin/invoices/${inv.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <Badge className={STATUS_STYLES[inv.status]}>
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.cleaner?.name || "Unknown"} &middot;{" "}
                      {formatDate(inv.period_start)} &ndash; {formatDate(inv.period_end)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatCents(inv.total)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
