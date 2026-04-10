"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Receipt,
  Home,
  CalendarDays,
  Users,
  PawPrint,
  SprayCan,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReimbursementModal } from "@/components/cleaner/reimbursement-form";
import type { InvoiceRow, UnpaidCleaning, RecentBooking } from "@/app/(cleaner)/cleaner/(protected)/invoices/page";
import type { InvoiceLineItem } from "@/types/database";

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
  });
}

function formatDateFull(dateStr: string) {
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

export function InvoiceTabs({
  unpaidCleanings,
  invoices,
  properties,
  recentBookings,
}: {
  unpaidCleanings: UnpaidCleaning[];
  invoices: InvoiceRow[];
  properties: { id: string; name: string }[];
  recentBookings: RecentBooking[];
}) {
  const [tab, setTab] = useState<"unpaid" | "history">("unpaid");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [showReimbursement, setShowReimbursement] = useState(false);

  const totalUnpaid = unpaidCleanings.reduce((s, c) => s + c.totalFee, 0);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReimbursement(true)}
        >
          <ReceiptText className="h-4 w-4 mr-1.5" />
          Reimbursement Request
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setTab("unpaid")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "unpaid"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <SprayCan className="h-4 w-4" />
          Unpaid Cleanings
          {unpaidCleanings.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">
              {unpaidCleanings.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Invoice History
          {invoices.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-1">
              {invoices.length}
            </Badge>
          )}
        </button>
      </div>

      {tab === "unpaid" ? (
        <UnpaidTab cleanings={unpaidCleanings} totalUnpaid={totalUnpaid} />
      ) : (
        <HistoryTab invoices={invoices} onSelect={setSelectedInvoice} />
      )}

      {/* Invoice detail modal */}
      <InvoiceModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* Reimbursement modal */}
      <ReimbursementModal
        open={showReimbursement}
        onClose={() => setShowReimbursement(false)}
        properties={properties}
        recentBookings={recentBookings}
      />
    </div>
  );
}

// --- Unpaid Cleanings Tab ---

function UnpaidTab({
  cleanings,
  totalUnpaid,
}: {
  cleanings: UnpaidCleaning[];
  totalUnpaid: number;
}) {
  if (cleanings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-500/30" />
        <p className="text-muted-foreground">All cleanings have been invoiced.</p>
        <p className="text-xs text-muted-foreground">
          New cleanings will appear here until the next weekly invoice is generated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {cleanings.length} cleaning{cleanings.length !== 1 ? "s" : ""} pending payout
              </p>
              <p className="text-2xl font-bold">{formatCents(totalUnpaid)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Next auto-invoice</p>
              <p className="text-sm font-medium">Every Monday</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cleaning list */}
      <div className="space-y-6">
        {cleanings.map((c) => (
          <Card key={c.registrationId}>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                  {c.propertyCoverImage ? (
                    <img
                      src={c.propertyCoverImage}
                      alt={c.propertyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Home className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.propertyName}</p>
                  {c.guestName && (
                    <p className="text-xs text-muted-foreground truncate">{c.guestName}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(c.checkInDate)} – {formatDate(c.checkOutDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {c.guestCount}
                    </span>
                    {c.hasPets && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <PawPrint className="h-3 w-3" />
                        Pets
                      </span>
                    )}
                  </div>
                  {c.cleanedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <SprayCan className="h-2.5 w-2.5 inline mr-0.5" />
                      Cleaned {formatTimestamp(c.cleanedAt)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatCents(c.totalFee)}</p>
                  {c.petFee > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      incl. {formatCents(c.petFee)} pet fee
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Invoice History Tab ---

function HistoryTab({
  invoices,
  onSelect,
}: {
  invoices: InvoiceRow[];
  onSelect: (inv: InvoiceRow) => void;
}) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Receipt className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">No invoices yet.</p>
        <p className="text-xs text-muted-foreground">
          Invoices are generated automatically every Monday.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow
              key={inv.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => onSelect(inv)}
            >
              <TableCell>
                <p className="text-sm font-medium">{inv.invoice_number}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTimestamp(inv.created_at)}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(inv.period_start)} &ndash; {formatDate(inv.period_end)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {inv.line_items.length} item{inv.line_items.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell>
                <Badge className={STATUS_STYLES[inv.status] || ""}>{inv.status}</Badge>
              </TableCell>
              <TableCell className="text-right text-sm font-semibold">
                {formatCents(inv.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// --- Invoice Detail Modal ---

function InvoiceModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
}) {
  if (!invoice) return null;

  const cleaningItems = invoice.line_items.filter((i) => i.type === "cleaning");
  const petFeeItems = invoice.line_items.filter((i) => i.type === "pet_fee");
  const extraItems = invoice.line_items.filter((i) => i.type === "extra");
  const reimbursementItems = invoice.line_items.filter((i) => i.type === "reimbursement");

  const cleaningTotal = cleaningItems.reduce((s, i) => s + i.amount, 0);
  const petFeeTotal = petFeeItems.reduce((s, i) => s + i.amount, 0);
  const extraTotal = extraItems.reduce((s, i) => s + i.amount, 0);
  const reimbursementTotal = reimbursementItems.reduce((s, i) => s + i.amount, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{invoice.invoice_number}</DialogTitle>
            <Badge className={STATUS_STYLES[invoice.status] || ""}>{invoice.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateFull(invoice.period_start)} &ndash; {formatDateFull(invoice.period_end)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cleaning items */}
          {cleaningItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <SprayCan className="h-3 w-3" />
                  Cleanings ({cleaningItems.length})
                </p>
                <p className="text-xs font-semibold">{formatCents(cleaningTotal)}</p>
              </div>
              {cleaningItems.map((item, i) => (
                <div key={i} className="flex flex-col gap-1 text-sm pl-4">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="truncate">{item.description}</p>
                      {item.property_name && (
                        <p className="text-xs text-muted-foreground">{item.property_name}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-medium">{formatCents(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pet fees */}
          {petFeeItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <PawPrint className="h-3 w-3" />
                    Pet Fees ({petFeeItems.length})
                  </p>
                  <p className="text-xs font-semibold">{formatCents(petFeeTotal)}</p>
                </div>
                {petFeeItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm pl-4">
                    <p className="truncate">{item.description}</p>
                    <span className="shrink-0 ml-2 font-medium">{formatCents(item.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Extra items */}
          {extraItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Other ({extraItems.length})
                  </p>
                  <p className="text-xs font-semibold">{formatCents(extraTotal)}</p>
                </div>
                {extraItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm pl-4">
                    <p className="truncate">{item.description}</p>
                    <span className="shrink-0 ml-2 font-medium">{formatCents(item.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Reimbursement items */}
          {reimbursementItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <ReceiptText className="h-3 w-3" />
                    Reimbursements ({reimbursementItems.length})
                  </p>
                  <p className="text-xs font-semibold">{formatCents(reimbursementTotal)}</p>
                </div>
                {reimbursementItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm pl-4">
                    <p className="truncate">{item.description}</p>
                    <span className="shrink-0 ml-2 font-medium">{formatCents(item.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Total */}
          <Separator />
          <div className="flex items-center justify-between font-bold">
            <span>Total</span>
            <span>{formatCents(invoice.total)}</span>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            </>
          )}

          {/* Timeline */}
          <Separator />
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Created {formatTimestamp(invoice.created_at)}
            </p>
            {invoice.submitted_at && (
              <p className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Submitted {formatTimestamp(invoice.submitted_at)}
              </p>
            )}
            {invoice.approved_at && (
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Approved {formatTimestamp(invoice.approved_at)}
              </p>
            )}
            {invoice.paid_at && (
              <p className="flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-green-600" />
                Paid {formatTimestamp(invoice.paid_at)}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
