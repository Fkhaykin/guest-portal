"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ReimbursementForm({
  properties,
}: {
  properties: Property[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("supplies");
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const selectedProperty = properties.find((p) => p.id === propertyId);

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

    // Build an invoice with a single reimbursement line item
    const lineItem = {
      description: `Reimbursement — ${description.trim()}`,
      type: "reimbursement" as const,
      property_name: selectedProperty?.name,
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
        router.push("/cleaner/invoices");
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold">Reimbursement Request</h1>

      {error && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Expense details */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm font-medium">Expense Details</p>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Input
              id="description"
              placeholder="e.g. Cleaning supplies from Home Depot"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs">Category</Label>
              <Select value={category} onValueChange={(val) => { if (val) setCategory(val); }}>
                <SelectTrigger id="category">
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
              <Label htmlFor="amount" className="text-xs">Amount ($)</Label>
              <Input
                id="amount"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense_date" className="text-xs">Expense Date</Label>
              <Input
                id="expense_date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="property" className="text-xs">Property (optional)</Label>
              <Select value={propertyId} onValueChange={(val) => setPropertyId(val ?? "")}>
                <SelectTrigger id="property">
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
          </div>
        </CardContent>
      </Card>

      {/* Receipts */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Receipts</p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <span className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                <Paperclip className="h-3 w-3 mr-1" />
                {uploading ? "Uploading..." : "Upload Receipt"}
              </span>
            </label>
          </div>

          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Attach photos of receipts or expense documentation.
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">
                    {att.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(idx)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any additional context..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Total + Actions */}
      {amount > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Request Amount</p>
              <p className="text-xl font-bold">{formatCents(amount)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-1" />
          Save Draft
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving || !description || !amount || !expenseDate}
          className="flex-1"
        >
          <Send className="h-4 w-4 mr-1" />
          Submit Request
        </Button>
      </div>
    </div>
  );
}
