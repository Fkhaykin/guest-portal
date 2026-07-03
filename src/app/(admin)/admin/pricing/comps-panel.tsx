"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { CompRow } from "./types";
import { fmtUsd } from "./types";

export function CompsPanel({
  nickname,
  comps,
  onChanged,
}: {
  nickname: string;
  comps: CompRow[];
  onChanged: () => void;
}) {
  const [airbnb, setAirbnb] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!airbnb.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/pricing-lab/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, airbnb, label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add comp");
      setAirbnb("");
      setLabel("");
      toast.success("Comp added — it'll be scraped on the next run.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comp");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/pricing-lab/comps?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Comp removed");
      onChanged();
    } else {
      toast.error("Failed to remove comp");
    }
  }

  const market = comps.filter((c) => !c.is_self);
  const medianPrices = market
    .map((c) => c.stats.medianPriceCents)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);
  const marketMedian = medianPrices.length ? medianPrices[Math.floor(medianPrices.length / 2)] : null;
  const occs = market.map((c) => c.stats.occupancy30).filter((o): o is number => o != null);
  const marketOcc = occs.length ? Math.round(occs.reduce((a, b) => a + b, 0) / occs.length) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comp set — {nickname}</CardTitle>
        {(marketMedian != null || marketOcc != null) && (
          <p className="text-sm text-muted-foreground">
            Market median {fmtUsd(marketMedian)}/night · {marketOcc ?? "—"}% booked (next 30 days)
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Airbnb listing URL or id</label>
            <Input
              placeholder="https://airbnb.com/rooms/12345678"
              value={airbnb}
              onChange={(e) => setAirbnb(e.target.value)}
            />
          </div>
          <div className="w-40 space-y-1">
            <label className="text-xs text-muted-foreground">Label (optional)</label>
            <Input placeholder="4BR lakefront" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button onClick={add} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {comps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comps yet. Add ~8–10 nearby Airbnb listings that compete with this house.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {comps.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.label || `Listing ${c.airbnb_id}`}</span>
                    {c.is_self && <Badge variant="secondary">Ours</Badge>}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {c.last_error && (
                      <span title={c.last_error} className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> scrape error
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.stats.medianPriceCents != null ? `${fmtUsd(c.stats.medianPriceCents)}/night median` : "not priced yet"}
                    {c.stats.occupancy30 != null && ` · ${c.stats.occupancy30}% booked`}
                    {c.last_scraped_at && ` · scraped ${new Date(c.last_scraped_at).toLocaleDateString()}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
