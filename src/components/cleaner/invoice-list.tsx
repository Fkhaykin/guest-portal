"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { toneBadge, statusTone } from "@/lib/status-styles";
import { Plus, Receipt } from "lucide-react";
import type { InvoiceRow } from "@/app/(cleaner)/cleaner/(protected)/invoices/page";
import type { InvoiceLineItem } from "@/types/database";

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

function getDueDate(invoice: InvoiceRow): string {
  const isMonthly = invoice.line_items.some((i: InvoiceLineItem) => i.type === "monthly_fee");
  if (isMonthly) {
    const end = new Date(invoice.period_end + "T00:00:00");
    const due = new Date(end.getFullYear(), end.getMonth() + 1, 5);
    return due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const created = new Date(invoice.created_at);
  created.setDate(created.getDate() + 5);
  return created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        actions={
          <Link href="/cleaner/invoices/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4 mr-1" />
            New Invoice
          </Link>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          action={
            <Link
              href="/cleaner/invoices/new"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Create your first invoice
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/cleaner/invoices/${inv.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <Badge className={toneBadge(statusTone(inv.status))}>
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.period_start)} &ndash; {formatDate(inv.period_end)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {getDueDate(inv)}
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
