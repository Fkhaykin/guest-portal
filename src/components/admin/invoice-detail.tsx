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
  Mail,
  PawPrint,
  Pencil,
  Phone,
  Trash2,
  Wrench,
  Building2,
  ReceiptText,
  User,
  FileText,
} from "lucide-react";
import type { InvoiceLineItem, InvoiceStatus } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const TYPE_ICONS: Record<string, typeof Home> = {
  cleaning: Home,
  pet_fee: PawPrint,
  extra: Wrench,
  reimbursement: ReceiptText,
  monthly_fee: DollarSign,
};

const TYPE_LABELS: Record<string, string> = {
  cleaning: "Cleaning",
  pet_fee: "Pet Fee",
  extra: "Extra",
  reimbursement: "Reimbursement",
  monthly_fee: "Monthly Fee",
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

function getDueDate(invoice: { line_items: InvoiceLineItem[]; period_end: string; created_at: string }): string {
  const isMonthly = invoice.line_items.some((i) => i.type === "monthly_fee");
  if (isMonthly) {
    const end = new Date(invoice.period_end + "T00:00:00");
    const due = new Date(end.getFullYear(), end.getMonth() + 1, 5);
    return due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const created = new Date(invoice.created_at);
  created.setDate(created.getDate() + 5);
  return created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MiniCalendar({
  periodStart,
  periodEnd,
  checkoutDates,
}: {
  periodStart: string;
  periodEnd: string;
  checkoutDates: string[];
}) {
  const start = new Date(periodStart + "T00:00:00");
  const end = new Date(periodEnd + "T00:00:00");
  const checkoutSet = new Set(checkoutDates);

  // Build list of months to show
  const months: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="flex flex-wrap gap-4">
      {months.map((month) => {
        const year = month.getFullYear();
        const mo = month.getMonth();
        const daysInMonth = new Date(year, mo + 1, 0).getDate();
        const firstDow = new Date(year, mo, 1).getDay();
        const monthLabel = month.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });

        return (
          <div key={monthLabel} className="min-w-45">
            <p className="text-xs font-medium text-center mb-1">{monthLabel}</p>
            <div className="grid grid-cols-7 gap-px text-center text-[10px]">
              {WEEKDAYS.map((d) => (
                <span key={d} className="text-muted-foreground font-medium py-0.5">
                  {d}
                </span>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, mo, day);
                const dateStr = `${year}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const inRange = date >= start && date <= end;
                const isCheckout = checkoutSet.has(dateStr);

                return (
                  <span
                    key={day}
                    className={`py-0.5 rounded-sm ${
                      isCheckout
                        ? "bg-primary text-primary-foreground font-semibold"
                        : inRange
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
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
    cleaner_phone: string | null;
    cleaner_company: string | null;
    cleaner_email: string | null;
    attachments: { name: string; path: string; uploaded_at: string; url: string | null }[];
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(invoice.status);

  async function updateStatus(newStatus: "approved" | "paid") {
    setSaving(true);

    const res = await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoice.id, status: newStatus }),
    });

    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
    setSaving(false);
  }

  async function deleteInvoice() {
    if (!confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    setDeleting(true);

    const res = await fetch("/api/admin/invoices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoice.id }),
    });

    if (res.ok) {
      router.push("/admin/invoices");
      router.refresh();
    }
    setDeleting(false);
  }

  // Group pet fees by registration_id so they can be shown under their reservation
  const petFeesByRegId = new Map<string, InvoiceLineItem[]>();
  for (const item of invoice.line_items.filter((l) => l.type === "pet_fee")) {
    const key = item.registration_id || "__none__";
    const arr = petFeesByRegId.get(key) || [];
    arr.push(item);
    petFeesByRegId.set(key, arr);
  }

  // Pet fees that couldn't be matched to a reservation
  const orphanPetFees = petFeesByRegId.get("__none__") || [];

  const grouped = {
    monthly_fee: invoice.line_items.filter((l) => l.type === "monthly_fee"),
    cleaning: invoice.line_items.filter((l) => l.type === "cleaning"),
    pet_fee: orphanPetFees,
    extra: invoice.line_items.filter((l) => l.type === "extra"),
    reimbursement: invoice.line_items.filter((l) => l.type === "reimbursement"),
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
              <span>&middot;</span>
              <span>Due: {getDueDate(invoice)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/invoices/${invoice.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteInvoice}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {deleting ? "Deleting…" : "Delete"}
          </Button>
          <Badge className={STATUS_STYLES[status]}>{status}</Badge>
        </div>
      </div>

      {/* Cleaner info + Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{invoice.cleaner_name}</p>
                {invoice.cleaner_company && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{invoice.cleaner_company}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {invoice.cleaner_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  <span>{invoice.cleaner_phone}</span>
                </div>
              )}
              {invoice.cleaner_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <span>{invoice.cleaner_email}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-2">
              {formatDate(invoice.period_start)} &ndash; {formatDate(invoice.period_end)}
            </p>
            <MiniCalendar
              periodStart={invoice.period_start}
              periodEnd={invoice.period_end}
              checkoutDates={invoice.line_items
                .filter((l) => l.type === "cleaning")
                .map((l) => l.description.match(/\(checkout (\d{4}-\d{2}-\d{2})\)/)?.[1])
                .filter((d): d is string => !!d)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {(["monthly_fee", "cleaning", "pet_fee", "extra", "reimbursement"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const Icon = TYPE_ICONS[type];
            // For cleaning, include associated pet fees in the section total
            const associatedPetFeeTotal = type === "cleaning"
              ? items.reduce((s, l) => {
                  const fees = l.registration_id ? petFeesByRegId.get(l.registration_id) : undefined;
                  return s + (fees ? fees.reduce((a, f) => a + f.amount, 0) : 0);
                }, 0)
              : 0;
            const typeTotal = items.reduce((s, l) => s + l.amount, 0) + associatedPetFeeTotal;

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
                  {items.map((item, i) => {
                    const relatedPetFees = type === "cleaning" && item.registration_id
                      ? petFeesByRegId.get(item.registration_id) || []
                      : [];
                    return (
                      <div key={i} className="space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate">
                            <span className="text-muted-foreground">
                              {item.description}
                            </span>
                          </div>
                          <span className="font-medium shrink-0">
                            {formatCents(item.amount)}
                          </span>
                        </div>
                        {relatedPetFees.map((pf, j) => (
                          <div key={`pf-${j}`} className="flex items-center justify-between gap-3 pl-2">
                            <span className="text-muted-foreground truncate flex items-center gap-1.5">
                              <PawPrint className="h-3 w-3 shrink-0" />
                              {pf.description}
                            </span>
                            <span className="font-medium">
                              {formatCents(pf.amount)}
                            </span>
                          </div>
                        ))}
                        {item.registration_id && (
                          <div className="text-xs text-muted-foreground">
                            <span>Booking ID: {item.registration_id}</span>
                            <br />
                            <Link
                              href={`/admin/reservations/${item.registration_id}`}
                              className="text-primary hover:underline"
                            >
                              View reservation
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

      {/* Attachments */}
      {invoice.attachments.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium mb-2">Evidence / Receipts</p>
            <div className="space-y-2">
              {invoice.attachments.map((att, i) => {
                const isPdf = att.name.toLowerCase().endsWith(".pdf");
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {att.name}
                      </span>
                    </div>
                    {att.url && (
                      isPdf ? (
                        <iframe
                          src={att.url}
                          className="w-full h-125 rounded-lg border"
                          title={att.name}
                        />
                      ) : (
                        <img
                          src={att.url}
                          alt={att.name}
                          className="w-full rounded-lg border object-contain max-h-125"
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
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
      {status === "open" && (
        <Button
          onClick={() => updateStatus("paid")}
          disabled={saving}
          className="w-full"
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Mark as Paid
        </Button>
      )}

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
