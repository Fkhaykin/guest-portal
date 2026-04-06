"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Home, PawPrint, Wrench, FileText, SlidersHorizontal } from "lucide-react";
import type { InvoiceLineItem, InvoiceAdjustment, InvoiceAttachment, InvoiceStatus } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const TYPE_ICONS: Record<string, typeof Home> = {
  cleaning: Home,
  pet_fee: PawPrint,
  extra: Wrench,
};

const TYPE_LABELS: Record<string, string> = {
  cleaning: "Cleaning",
  pet_fee: "Pet Fee",
  extra: "Extra",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InvoiceDetail({
  invoice,
  canEdit,
}: {
  invoice: {
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    period_start: string;
    period_end: string;
    line_items: InvoiceLineItem[];
    adjustments: InvoiceAdjustment[];
    attachments: InvoiceAttachment[];
    subtotal: number;
    total: number;
    notes: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    paid_at: string | null;
    created_at: string;
  };
  canEdit: boolean;
}) {
  // Group line items by type
  const grouped = {
    cleaning: invoice.line_items.filter((l) => l.type === "cleaning"),
    pet_fee: invoice.line_items.filter((l) => l.type === "pet_fee"),
    extra: invoice.line_items.filter((l) => l.type === "extra"),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cleaner/invoices" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{invoice.invoice_number}</h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(invoice.period_start)} &ndash; {formatDate(invoice.period_end)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_STYLES[invoice.status]}>
            {invoice.status}
          </Badge>
          {canEdit && (
            <Link
              href={`/cleaner/invoices/${invoice.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Line items */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {(["cleaning", "pet_fee", "extra"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const Icon = TYPE_ICONS[type];
            const typeTotal = items.reduce((s, l) => s + l.amount, 0);

            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {TYPE_LABELS[type]} ({items.length})
                  </p>
                  <span className="ml-auto text-sm font-medium text-muted-foreground">
                    {formatCents(typeTotal)}
                  </span>
                </div>
                <div className="space-y-1.5 pl-6">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="font-medium">{formatCents(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            );
          })}

          {/* Adjustments */}
          {invoice.adjustments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Adjustments ({invoice.adjustments.length})
                </p>
              </div>
              <div className="space-y-2 pl-6">
                {invoice.adjustments.map((adj, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{adj.description}</span>
                      <span className={`font-medium ${adj.amount < 0 ? "text-red-600" : ""}`}>
                        {adj.amount >= 0 ? "+" : ""}{formatCents(adj.amount)}
                      </span>
                    </div>
                    {adj.reason && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Reason: {adj.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Separator className="mt-3" />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-base font-semibold">Total</p>
            <p className="text-xl font-bold">{formatCents(invoice.total)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      {invoice.attachments.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium mb-2">Attachments</p>
            <div className="space-y-1.5">
              {invoice.attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">
                    {att.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-1">Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {invoice.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-medium mb-2">Timeline</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {formatTimestamp(invoice.created_at)}</p>
            {invoice.submitted_at && (
              <p>Submitted: {formatTimestamp(invoice.submitted_at)}</p>
            )}
            {invoice.approved_at && (
              <p>Approved: {formatTimestamp(invoice.approved_at)}</p>
            )}
            {invoice.paid_at && (
              <p>Paid: {formatTimestamp(invoice.paid_at)}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
