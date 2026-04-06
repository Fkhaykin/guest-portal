"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Home,
  PawPrint,
  Wrench,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

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

export function AdminInvoiceDetail({
  invoice,
}: {
  invoice: {
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    period_start: string;
    period_end: string;
    line_items: InvoiceLineItem[];
    subtotal: number;
    total: number;
    notes: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    paid_at: string | null;
    created_at: string;
    cleaner_name: string;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(invoice.status);

  async function updateStatus(newStatus: "approved" | "paid") {
    setSaving(true);
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "approved") updates.approved_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();

    const { error } = await supabase
      .from("cleaner_invoice")
      .update(updates)
      .eq("id", invoice.id);

    if (!error) {
      setStatus(newStatus);
      router.refresh();
    }
    setSaving(false);
  }

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
          <Link href="/admin/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{invoice.cleaner_name}</span>
              <span>&middot;</span>
              <span>
                {formatDate(invoice.period_start)} &ndash;{" "}
                {formatDate(invoice.period_end)}
              </span>
            </div>
          </div>
        </div>
        <Badge className={STATUS_STYLES[status]}>{status}</Badge>
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
                      <span className="font-medium">
                        {formatCents(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1">
            <p className="text-base font-semibold">Total</p>
            <p className="text-xl font-bold">{formatCents(invoice.total)}</p>
          </div>
        </CardContent>
      </Card>

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

      {/* Actions */}
      {status === "submitted" && (
        <div className="flex gap-3">
          <Button
            onClick={() => updateStatus("approved")}
            disabled={saving}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => updateStatus("paid")}
            disabled={saving}
            className="flex-1"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Mark as Paid
          </Button>
        </div>
      )}

      {status === "approved" && (
        <Button
          onClick={() => updateStatus("paid")}
          disabled={saving}
          className="w-full"
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Mark as Paid
        </Button>
      )}
    </div>
  );
}
