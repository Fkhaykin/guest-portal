"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Save, Paperclip, FileText, X } from "lucide-react";
import type { InvoiceAttachment } from "@/types/database";

type Property = {
  id: string;
  name: string;
  nickname: string | null;
};

type RecentBooking = {
  id: string;
  propertyName: string;
  propertyNickname: string | null;
  guestName: string | null;
  checkInDate: string;
  checkOutDate: string;
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

export function ReimbursementModal({
  open,
  onClose,
  properties,
  recentBookings,
}: {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  recentBookings: RecentBooking[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("supplies");
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [bookingId, setBookingId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedBooking = recentBookings.find((b) => b.id === bookingId);

  function reset() {
    setDescription("");
    setCategory("supplies");
    setAmount(0);
    setExpenseDate("");
    setPropertyId("");
    setBookingId("");
    setNotes("");
    setAttachments([]);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleBookingChange(val: string | null) {
    setBookingId(val ?? "");
    // Auto-fill property when a booking is selected
    if (val) {
      const booking = recentBookings.find((b) => b.id === val);
      if (booking) {
        const matchingProp = properties.find((p) => p.name === booking.propertyName);
        if (matchingProp) setPropertyId(matchingProp.id);
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/cleaner/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { attachment } = await res.json();
        setAttachments((prev) => [...prev, attachment]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(submit: boolean) {
    setError("");

    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    if (!expenseDate) {
      setError("Expense date is required");
      return;
    }

    // Auto-match a reservation if property + date are set but no booking was picked
    let resolvedBookingId = bookingId || undefined;
    if (!resolvedBookingId && propertyId && expenseDate) {
      const propName = selectedProperty?.name;
      if (propName) {
        const expMs = new Date(expenseDate + "T00:00:00").getTime();
        const match = recentBookings.find((b) => {
          if (b.propertyName !== propName) return false;
          const ciMs = new Date(b.checkInDate + "T00:00:00").getTime();
          const coMs = new Date(b.checkOutDate + "T00:00:00").getTime();
          return expMs >= ciMs && expMs <= coMs;
        });
        if (match) resolvedBookingId = match.id;
      }
    }

    const lineItem = {
      description: `Reimbursement — ${description.trim()}`,
      type: "reimbursement" as const,
      property_name: selectedProperty?.name || selectedBooking?.propertyName,
      property_nickname:
        selectedProperty?.nickname ?? selectedBooking?.propertyNickname ?? undefined,
      registration_id: resolvedBookingId,
      amount,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/cleaner/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: expenseDate,
          period_end: expenseDate,
          line_items: [lineItem],
          attachments,
          notes: notes.trim()
            ? `[${category}] ${notes.trim()}`
            : `[${category}]`,
          submit,
        }),
      });

      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Reimbursement Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="reimb-description" className="text-xs">Description</Label>
            <Input
              id="reimb-description"
              placeholder="e.g. Cleaning supplies from Home Depot"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-category" className="text-xs">Category</Label>
              <Select value={category} onValueChange={(val) => { if (val) setCategory(val); }}>
                <SelectTrigger id="reimb-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reimb-amount" className="text-xs">Amount ($)</Label>
              <Input
                id="reimb-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount ? (amount / 100).toFixed(2) : ""}
                onChange={(e) => {
                  const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                  setAmount(cents);
                }}
              />
            </div>
          </div>

          {/* Date + Property */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-date" className="text-xs">Expense Date</Label>
              <Input
                id="reimb-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reimb-property" className="text-xs">Property (optional)</Label>
              <Select value={propertyId} onValueChange={(val) => setPropertyId(val ?? "")}>
                <SelectTrigger id="reimb-property">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nickname || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Booking selector */}
          {recentBookings.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="reimb-booking" className="text-xs">Associated Booking (optional)</Label>
              <Select value={bookingId} onValueChange={handleBookingChange}>
                <SelectTrigger id="reimb-booking">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {recentBookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.propertyNickname || b.propertyName} — {b.guestName || "No guest"} ({formatDate(b.checkInDate)} – {formatDate(b.checkOutDate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Receipts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Receipts</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <span className="inline-flex items-center justify-center rounded-md text-[11px] font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2">
                  <Paperclip className="h-3 w-3 mr-1" />
                  {uploading ? "Uploading..." : "Upload"}
                </span>
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Attach photos of receipts or expense documentation.
              </p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-lg"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">
                      {att.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(idx)}
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="reimb-notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="reimb-notes"
              placeholder="Any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Amount summary */}
          {amount > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm font-semibold">Request Amount</p>
              <p className="text-lg font-bold">{formatCents(amount)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1"
              size="sm"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || !description || !amount || !expenseDate}
              className="flex-1"
              size="sm"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
