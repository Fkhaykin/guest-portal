"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lightbulb } from "lucide-react";
import type { PricingLabData } from "./types";
import { fmtUsd } from "./types";

// "Help Me Choose a Base Price" — blends the comp-set median, the 180-day mean
// market p50, and trailing-12-month realized ADR into a suggested base, the way
// PriceLabs' base-price helper does. Apply fills the input without saving.
export function HelpMeChooseBase({ data, onPick }: { data: PricingLabData; onPick: (dollars: number) => void }) {
  const [open, setOpen] = useState(false);

  const inputs = useMemo(() => {
    const compMedians = data.comps
      .filter((c) => !c.is_self && c.stats.medianPriceCents != null)
      .map((c) => c.stats.medianPriceCents!)
      .sort((a, b) => a - b);
    const compMedian = compMedians.length ? compMedians[Math.floor(compMedians.length / 2)] : null;

    const p50s = data.market.map((m) => m.p50).filter((p): p is number => p != null);
    const marketMean = p50s.length ? Math.round(p50s.reduce((a, b) => a + b, 0) / p50s.length) : null;

    const realized = data.realizedAdr;

    // Suggested base = weighted blend of whatever signals exist. Market/comp
    // are "what the neighborhood charges"; realized ADR is "what we actually
    // got". Weight realized highest when present.
    const parts: { w: number; v: number }[] = [];
    if (realized != null) parts.push({ w: 0.5, v: realized });
    if (marketMean != null) parts.push({ w: 0.3, v: marketMean });
    if (compMedian != null) parts.push({ w: 0.2, v: compMedian });
    const wsum = parts.reduce((s, p) => s + p.w, 0);
    const suggested = wsum ? Math.round(parts.reduce((s, p) => s + p.w * p.v, 0) / wsum / 100) * 100 : null;

    return { compMedian, marketMean, realized, suggested };
  }, [data]);

  const currentBase = data.config.base_price_cents;

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Lightbulb className="h-4 w-4" /> Help Me Choose a Base Price
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Suggested base price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A blend of what the neighborhood charges and what this house has actually earned.
            </p>
            <div className="space-y-1.5 text-sm">
              <Signal label="Your realized ADR (last 12 mo)" value={inputs.realized} weight="highest" />
              <Signal label="Market median (180-day mean of comp p50)" value={inputs.marketMean} weight="medium" />
              <Signal label="Comp-set median price" value={inputs.compMedian} weight="lower" />
              <div className="my-1 border-t border-border" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current base</span>
                <span className="tabular-nums">{fmtUsd(currentBase)}</span>
              </div>
            </div>
            {inputs.suggested != null ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <div className="text-xs text-muted-foreground">Suggested base</div>
                <div className="text-2xl font-bold tabular-nums">{fmtUsd(inputs.suggested * 100)}</div>
                {currentBase && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {inputs.suggested * 100 > currentBase ? "+" : ""}
                    {Math.round(((inputs.suggested * 100 - currentBase) / currentBase) * 100)}% vs current
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data yet to suggest a base.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={inputs.suggested == null}
                onClick={() => {
                  if (inputs.suggested != null) onPick(inputs.suggested);
                  setOpen(false);
                }}
              >
                Use {inputs.suggested != null ? fmtUsd(inputs.suggested * 100) : "—"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Signal({ label, value, weight }: { label: string; value: number | null; weight: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        {label} <span className="text-xs opacity-60">· {weight}</span>
      </span>
      <span className="tabular-nums">{value != null ? fmtUsd(value) : "—"}</span>
    </div>
  );
}
