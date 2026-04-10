"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import type { InvoiceRow } from "@/app/(cleaner)/cleaner/(protected)/invoices/page";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
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

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <Link href="/cleaner/invoices/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4 mr-1" />
          New Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Receipt className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">No invoices yet.</p>
          <Link
            href="/cleaner/invoices/new"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Create your first invoice
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/cleaner/invoices/${inv.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <Badge className={STATUS_STYLES[inv.status] || ""}>
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
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
