"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ExternalLink, AlertTriangle, Sparkles, Star, Waves, Radar } from "lucide-react";
import { toast } from "sonner";
import type { CompRow } from "./types";
import { fmtUsd } from "./types";

interface Candidate {
  airbnbId: string;
  name: string;
  beds: number | null;
  rating: number | null;
  reviewCount: number;
  distanceKm: number;
  priceTotal: string | null;
}

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
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  async function buildSet() {
    setBuilding(true);
    try {
      const res = await fetch("/api/admin/pricing-lab/comps/discover-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, target: 100 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bulk discovery failed");
      toast.success(`Added ${json.added} comps (now ${json.have}). They'll be scraped over the next runs.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk discovery failed");
    } finally {
      setBuilding(false);
    }
  }

  async function addComp(airbnbValue: string, labelValue: string) {
    const res = await fetch("/api/admin/pricing-lab/comps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, airbnb: airbnbValue, label: labelValue }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to add comp");
  }

  async function add() {
    if (!airbnb.trim()) return;
    setAdding(true);
    try {
      await addComp(airbnb, label);
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

  async function discover() {
    setDiscovering(true);
    setCandidates(null);
    try {
      const res = await fetch("/api/admin/pricing-lab/comps/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Discovery failed");
      setCandidates(json.candidates);
      if (!json.candidates.length) toast.info("No new candidates found nearby.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function addCandidate(c: Candidate) {
    setAddingId(c.airbnbId);
    try {
      await addComp(c.airbnbId, c.name.slice(0, 60));
      setCandidates((prev) => prev?.filter((x) => x.airbnbId !== c.airbnbId) ?? null);
      toast.success("Comp added");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comp");
    } finally {
      setAddingId(null);
    }
  }

  async function addTop(n: number) {
    if (!candidates) return;
    const top = candidates.slice(0, n);
    setAddingId("__bulk");
    let added = 0;
    for (const c of top) {
      try {
        await addComp(c.airbnbId, c.name.slice(0, 60));
        added++;
      } catch {
        // duplicates or transient failures — keep going
      }
    }
    setCandidates((prev) => prev?.filter((x) => !top.some((t) => t.airbnbId === x.airbnbId)) ?? null);
    setAddingId(null);
    toast.success(`Added ${added} comps — they'll be scraped on the next run.`);
    onChanged();
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
          <Button variant="outline" onClick={discover} disabled={discovering}>
            {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Find comps
          </Button>
          <Button variant="outline" onClick={buildSet} disabled={building}>
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            Auto-build 100
          </Button>
        </div>

        {candidates && candidates.length > 0 && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Suggested comps — bedroom-matched listings near this house, closest first
              </p>
              <Button size="sm" variant="secondary" onClick={() => addTop(8)} disabled={addingId !== null}>
                {addingId === "__bulk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add top 8
              </Button>
            </div>
            <div className="divide-y divide-border rounded-md border border-border bg-card">
              {candidates.map((c) => (
                <div key={c.airbnbId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <a
                        href={`https://www.airbnb.com/rooms/${c.airbnbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.beds != null && <span>{c.beds} BR</span>}
                      <span>{(c.distanceKm * 0.621).toFixed(1)} mi away</span>
                      {c.rating != null ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current" /> {c.rating} ({c.reviewCount})
                        </span>
                      ) : (
                        <span>New listing</span>
                      )}
                      {c.priceTotal && <span>{c.priceTotal} search total</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addCandidate(c)}
                    disabled={addingId !== null}
                  >
                    {addingId === c.airbnbId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    {c.is_lakefront && (
                      <Badge variant="secondary" className="gap-1">
                        <Waves className="h-3 w-3" /> Lakefront
                      </Badge>
                    )}
                    {c.bedrooms != null && <span className="text-xs text-muted-foreground">{c.bedrooms}BR</span>}
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
