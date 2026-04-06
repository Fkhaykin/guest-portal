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
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Send,
  Save,
  Zap,
  Paperclip,
  FileText,
  X,
} from "lucide-react";
import type { InvoiceLineItem, InvoiceAdjustment, InvoiceAttachment } from "@/types/database";

type Property = {
  id: string;
  name: string;
  cleaningFeeCents: number;
  petFeeCents: number;
};

type UnbilledCleaning = {
  registration_id: string;
  property_id: string;
  property_name: string;
  check_out_date: string;
  has_pets: boolean;
};

function emptyLine(type: InvoiceLineItem["type"] = "cleaning"): InvoiceLineItem {
  return { description: "", type, amount: 0 };
}

function emptyAdjustment(): InvoiceAdjustment {
  return { description: "", amount: 0, reason: "" };
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function InvoiceForm({
  properties,
  unbilledCleanings,
  initialData,
}: {
  properties: Property[];
  unbilledCleanings?: UnbilledCleaning[];
  initialData?: {
    id: string;
    period_start: string;
    period_end: string;
    line_items: InvoiceLineItem[];
    adjustments?: InvoiceAdjustment[];
    attachments?: InvoiceAttachment[];
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [periodStart, setPeriodStart] = useState(initialData?.period_start || "");
  const [periodEnd, setPeriodEnd] = useState(initialData?.period_end || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    initialData?.line_items.length ? initialData.line_items : [emptyLine()]
  );
  const [adjustments, setAdjustments] = useState<InvoiceAdjustment[]>(
    initialData?.adjustments?.length ? initialData.adjustments : []
  );
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>(
    initialData?.attachments || []
  );
  const [uploading, setUploading] = useState(false);

  const lineTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const total = lineTotal + adjustmentTotal;

  function updateLine(idx: number, updates: Partial<InvoiceLineItem>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...updates } : l))
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAdjustment(idx: number, updates: Partial<InvoiceAdjustment>) {
    setAdjustments((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...updates } : a))
    );
  }

  function removeAdjustment(idx: number) {
    setAdjustments((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCleaningLines() {
    const propMap = new Map(properties.map((p) => [p.id, p]));
    const newLines = properties.map((p) => ({
      description: `Cleaning — ${p.name}`,
      type: "cleaning" as const,
      property_name: p.name,
      amount: p.cleaningFeeCents,
    }));
    setLines((prev) => [...prev, ...newLines]);
  }

  function autoPopulateUnbilled() {
    if (!unbilledCleanings?.length) return;

    const propMap = new Map(properties.map((p) => [p.id, p]));
    const newLines: InvoiceLineItem[] = [];

    for (const cleaning of unbilledCleanings) {
      const prop = propMap.get(cleaning.property_id);
      if (!prop) continue;

      // Add cleaning line
      newLines.push({
        description: `Cleaning — ${cleaning.property_name} (${cleaning.check_out_date})`,
        type: "cleaning",
        property_name: cleaning.property_name,
        registration_id: cleaning.registration_id,
        amount: prop.cleaningFeeCents,
      });

      // Add pet fee if pets were present
      if (cleaning.has_pets && prop.petFeeCents > 0) {
        newLines.push({
          description: `Pet Fee — ${cleaning.property_name} (${cleaning.check_out_date})`,
          type: "pet_fee",
          property_name: cleaning.property_name,
          registration_id: cleaning.registration_id,
          amount: prop.petFeeCents,
        });
      }
    }

    if (newLines.length > 0) {
      // Replace empty default line if present
      const hasOnlyEmpty = lines.length === 1 && !lines[0].description && lines[0].amount === 0;
      setLines(hasOnlyEmpty ? newLines : [...lines, ...newLines]);

      // Auto-set period from unbilled dates
      if (!periodStart && !periodEnd) {
        const dates = unbilledCleanings.map((c) => c.check_out_date).sort();
        setPeriodStart(dates[0]);
        setPeriodEnd(dates[dates.length - 1]);
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
      // Reset the input
      e.target.value = "";
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(submit: boolean) {
    if (!periodStart || !periodEnd) return;
    const validLines = lines.filter((l) => l.description && l.amount > 0);
    if (validLines.length === 0) return;

    const validAdjustments = adjustments.filter(
      (a) => a.description && a.amount !== 0
    );

    setSaving(true);
    try {
      const res = await fetch("/api/cleaner/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialData?.id,
          period_start: periodStart,
          period_end: periodEnd,
          line_items: validLines,
          adjustments: validAdjustments,
          attachments,
          notes: notes || undefined,
          submit,
        }),
      });

      if (res.ok) {
        router.push("/cleaner/invoices");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold">
        {initialData ? "Edit Invoice" : "New Invoice"}
      </h1>

      {/* Auto-populate banner */}
      {!initialData && unbilledCleanings && unbilledCleanings.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {unbilledCleanings.length} unbilled cleaning{unbilledCleanings.length > 1 ? "s" : ""} found
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Auto-add all completed cleanings and pet fees with configured rates.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={autoPopulateUnbilled}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Add All Unbilled Items
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm font-medium">Invoice Period</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="period_start" className="text-xs">Start Date</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period_end" className="text-xs">End Date</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Line Items</p>
            <div className="flex gap-2">
              {properties.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCleaningLines}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  All Properties
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Select
                      value={line.type}
                      onValueChange={(val) =>
                        updateLine(idx, { type: val as InvoiceLineItem["type"] })
                      }
                    >
                      <SelectTrigger className="w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="pet_fee">Pet Fee</SelectItem>
                        <SelectItem value="extra">Extra</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) =>
                        updateLine(idx, { description: e.target.value })
                      }
                      className="text-sm"
                    />
                  </div>
                  {line.type === "cleaning" && properties.length > 0 && (
                    <Select
                      value={line.property_name || ""}
                      onValueChange={(val) => {
                        const prop = properties.find((p) => p.name === val);
                        updateLine(idx, {
                          property_name: val || undefined,
                          description: `Cleaning — ${val}`,
                          amount: prop?.cleaningFeeCents || line.amount,
                        });
                      }}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.amount ? (line.amount / 100).toFixed(2) : ""}
                    onChange={(e) => {
                      const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                      updateLine(idx, { amount: cents });
                    }}
                    className="text-sm text-right"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(idx)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines([...lines, emptyLine("cleaning")])}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Cleaning
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines([...lines, emptyLine("pet_fee")])}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Pet Fee
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines([...lines, emptyLine("extra")])}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Extra
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="text-sm font-medium">{formatCents(lineTotal)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Adjustments</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdjustments([...adjustments, emptyAdjustment()])}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Adjustment
            </Button>
          </div>

          {adjustments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No adjustments. Add one for additional charges or deductions.
            </p>
          ) : (
            <div className="space-y-3">
              {adjustments.map((adj, idx) => (
                <div key={idx} className="space-y-2 border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder="Description (e.g. Supply restock)"
                      value={adj.description}
                      onChange={(e) =>
                        updateAdjustment(idx, { description: e.target.value })
                      }
                      className="text-sm flex-1"
                    />
                    <div className="w-28 shrink-0">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={adj.amount ? (adj.amount / 100).toFixed(2) : ""}
                        onChange={(e) => {
                          const cents = Math.round(
                            parseFloat(e.target.value || "0") * 100
                          );
                          updateAdjustment(idx, { amount: cents });
                        }}
                        className="text-sm text-right"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAdjustment(idx)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Reason (e.g. Purchased extra cleaning supplies)"
                    value={adj.reason}
                    onChange={(e) =>
                      updateAdjustment(idx, { reason: e.target.value })
                    }
                    className="text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {adjustmentTotal !== 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Adjustment Total</p>
                <p className={`text-sm font-medium ${adjustmentTotal < 0 ? "text-red-600" : ""}`}>
                  {adjustmentTotal >= 0 ? "+" : ""}{formatCents(adjustmentTotal)}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Attachments</p>
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
                {uploading ? "Uploading..." : "Upload File"}
              </span>
            </label>
          </div>

          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Attach receipts, expense invoices, or other supporting documents.
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
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Total + Actions */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Total</p>
            <p className="text-xl font-bold">{formatCents(total)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving || !periodStart || !periodEnd}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-1" />
          Save Draft
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={saving || !periodStart || !periodEnd || total === 0}
          className="flex-1"
        >
          <Send className="h-4 w-4 mr-1" />
          Submit Invoice
        </Button>
      </div>
    </div>
  );
}
