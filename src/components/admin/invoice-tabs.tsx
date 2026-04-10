"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SprayCan,
  Receipt,
  Home,
  CalendarDays,
  Users,
  PawPrint,
  User,
  CheckCircle2,
} from "lucide-react";
import type {
  AdminInvoiceRow,
  AdminUnpaidCleaning,
} from "@/app/(admin)/admin/invoices/page";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  approved:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminInvoiceTabs({
  unpaidCleanings,
  invoices,
}: {
  unpaidCleanings: AdminUnpaidCleaning[];
  invoices: AdminInvoiceRow[];
}) {
  const [tab, setTab] = useState<"unpaid" | "history">("unpaid");

  const totalUnpaid = unpaidCleanings.reduce((s, c) => s + c.totalFee, 0);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold">Cleaner Invoices</h1>

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
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 ml-1"
            >
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
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 ml-1"
            >
              {invoices.length}
            </Badge>
          )}
        </button>
      </div>

      {tab === "unpaid" ? (
        <UnpaidTab cleanings={unpaidCleanings} totalUnpaid={totalUnpaid} />
      ) : (
        <HistoryTab invoices={invoices} />
      )}
    </div>
  );
}

// --- Unpaid Cleanings Tab ---

function UnpaidTab({
  cleanings,
  totalUnpaid,
}: {
  cleanings: AdminUnpaidCleaning[];
  totalUnpaid: number;
}) {
  if (cleanings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-500/30" />
        <p className="text-muted-foreground">
          All cleanings have been invoiced.
        </p>
        <p className="text-xs text-muted-foreground">
          New cleanings will appear here after a cleaner completes a task.
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
                {cleanings.length} cleaning
                {cleanings.length !== 1 ? "s" : ""} pending invoice
              </p>
              <p className="text-2xl font-bold">{formatCents(totalUnpaid)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Auto-invoice</p>
              <p className="text-sm font-medium">Every Monday</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cleaning list */}
      <div className="space-y-2">
        {cleanings.map((c) => (
          <Link key={c.registrationId} href={`/admin/reservations/${c.registrationId}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
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
                    <p className="text-sm font-medium truncate">
                      {c.propertyName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {c.cleanerName}
                      </span>
                      {c.guestName && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">{c.guestName}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(c.checkInDate)} &ndash;{" "}
                        {formatDate(c.checkOutDate)}
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
                    <p className="text-sm font-semibold">
                      {formatCents(c.totalFee)}
                    </p>
                    {c.petFee > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        incl. {formatCents(c.petFee)} pet fee
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- Invoice History Tab ---

function HistoryTab({ invoices }: { invoices: AdminInvoiceRow[] }) {
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
    <div className="space-y-3">
      {invoices.map((inv) => (
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
                  {inv.cleaner_name} &middot;{" "}
                  {formatDateFull(inv.period_start)} &ndash;{" "}
                  {formatDateFull(inv.period_end)}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatCents(inv.total)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
