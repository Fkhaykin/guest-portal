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
import { Send, Save } from "lucide-react";

type Property = {
  id: string;
  name: string;
};

type RecentBooking = {
  id: string;
  propertyName: string;
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

export function OneOffInvoiceModal({
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
  const [amount, setAmount] = useState<number>(0);
  const [serviceDate, setServiceDate] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [bookingId, setBookingId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedBooking = recentBookings.find((b) => b.id === bookingId);

  function reset() {
    setDescription("");
    setAmount(0);
    setServiceDate("");
    setPropertyId("");
    setBookingId("");
    setNotes("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleBookingChange(val: string | null) {
    setBookingId(val ?? "");
    if (val) {
      const booking = recentBookings.find((b) => b.id === val);
      if (booking) {
        const matchingProp = properties.find((p) => p.name === booking.propertyName);
        if (matchingProp) setPropertyId(matchingProp.id);
      }
    }
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
    if (!serviceDate) {
      setError("Service date is required");
      return;
    }

    let resolvedBookingId = bookingId || undefined;
    if (!resolvedBookingId && propertyId && serviceDate) {
      const propName = selectedProperty?.name;
      if (propName) {
        const svcMs = new Date(serviceDate + "T00:00:00").getTime();
        const match = recentBookings.find((b) => {
          if (b.propertyName !== propName) return false;
          const ciMs = new Date(b.checkInDate + "T00:00:00").getTime();
          const coMs = new Date(b.checkOutDate + "T00:00:00").getTime();
          return svcMs >= ciMs && svcMs <= coMs;
        });
        if (match) resolvedBookingId = match.id;
      }
    }

    const lineItem = {
      description: description.trim(),
      type: "extra" as const,
      property_name: selectedProperty?.name || selectedBooking?.propertyName,
      registration_id: resolvedBookingId,
      amount,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/cleaner/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: serviceDate,
          period_end: serviceDate,
          line_items: [lineItem],
          notes: notes.trim() || undefined,
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
          <DialogTitle className="text-base">One-Off Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="oneoff-description" className="text-xs">What was the task?</Label>
            <Input
              id="oneoff-description"
              placeholder="e.g. Deep clean oven, replaced light bulbs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="oneoff-amount" className="text-xs">Amount ($)</Label>
              <Input
                id="oneoff-amount"
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

            <div className="space-y-1.5">
              <Label htmlFor="oneoff-date" className="text-xs">Service Date</Label>
              <Input
                id="oneoff-date"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
              />
            </div>
          </div>

          {/* Property */}
          <div className="space-y-1.5">
            <Label htmlFor="oneoff-property" className="text-xs">Property (optional)</Label>
            <Select value={propertyId} onValueChange={(val) => setPropertyId(val ?? "")}>
              <SelectTrigger id="oneoff-property">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Booking selector */}
          {recentBookings.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="oneoff-booking" className="text-xs">Associated Booking (optional)</Label>
              <Select value={bookingId} onValueChange={handleBookingChange}>
                <SelectTrigger id="oneoff-booking">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {recentBookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.propertyName} — {b.guestName || "No guest"} ({formatDate(b.checkInDate)} – {formatDate(b.checkOutDate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="oneoff-notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="oneoff-notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Amount summary */}
          {amount > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm font-semibold">Invoice Amount</p>
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
              disabled={saving || !description || !amount || !serviceDate}
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
