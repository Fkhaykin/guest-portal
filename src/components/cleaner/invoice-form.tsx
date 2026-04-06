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
import { Plus, Trash2, Send, Save } from "lucide-react";
import type { InvoiceLineItem } from "@/types/database";

type Property = { id: string; name: string };

function emptyLine(type: InvoiceLineItem["type"] = "cleaning"): InvoiceLineItem {
  return { description: "", type, amount: 0 };
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function InvoiceForm({
  properties,
  initialData,
}: {
  properties: Property[];
  initialData?: {
    id: string;
    period_start: string;
    period_end: string;
    line_items: InvoiceLineItem[];
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

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  function updateLine(idx: number, updates: Partial<InvoiceLineItem>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...updates } : l))
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCleaningLines() {
    const newLines = properties.map((p) => ({
      description: `Cleaning — ${p.name}`,
      type: "cleaning" as const,
      property_name: p.name,
      amount: 0,
    }));
    setLines((prev) => [...prev, ...newLines]);
  }

  async function handleSave(submit: boolean) {
    if (!periodStart || !periodEnd) return;
    const validLines = lines.filter((l) => l.description && l.amount > 0);
    if (validLines.length === 0) return;

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
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">
        {initialData ? "Edit Invoice" : "New Invoice"}
      </h1>

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
                      onValueChange={(val) =>
                        updateLine(idx, {
                          property_name: val || undefined,
                          description: `Cleaning — ${val}`,
                        })
                      }
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
            <p className="text-sm font-semibold">Total</p>
            <p className="text-lg font-bold">{formatCents(total)}</p>
          </div>
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

      {/* Actions */}
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
