"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Trash2, AlertTriangle, Waves, Bath, Flame, Gamepad2, Star, ArrowUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import type { CompRow } from "./types";
import { fmtUsd } from "./types";

type SortKey =
  | "label"
  | "bedrooms"
  | "bathrooms"
  | "rating"
  | "occupancy30"
  | "medianPrice"
  | "lakefront";

// Amenity icons shown per comp — lakefront plus the three amenities hosts filter
// comps by. Each is title-labeled so identity is never icon-alone.
function AmenityIcons({ c }: { c: CompRow }) {
  const items: { on: boolean | null; icon: React.ReactNode; label: string; color: string }[] = [
    { on: c.is_lakefront, icon: <Waves className="h-3.5 w-3.5" />, label: "Lakefront", color: "var(--series-ours)" },
    { on: c.has_hot_tub, icon: <Bath className="h-3.5 w-3.5" />, label: "Hot tub", color: "var(--series-pl-rec)" },
    { on: c.has_sauna, icon: <Flame className="h-3.5 w-3.5" />, label: "Sauna", color: "var(--series-pl-rec)" },
    { on: c.has_game_room, icon: <Gamepad2 className="h-3.5 w-3.5" />, label: "Game room", color: "var(--series-pl)" },
  ];
  const on = items.filter((i) => i.on);
  if (on.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {on.map((i) => (
        <span key={i.label} title={i.label} style={{ color: i.color }}>
          {i.icon}
        </span>
      ))}
    </span>
  );
}

// Sortable, filterable comp table — scales to the ~100 comps/house the program
// now tracks (PriceLabs' "Manage Competitors" equivalent).
export function CompsTable({ comps, onChanged }: { comps: CompRow[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("occupancy30");
  const [asc, setAsc] = useState(false);
  const [lakefrontOnly, setLakefrontOnly] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const market = useMemo(() => comps.filter((c) => !c.is_self), [comps]);
  const self = useMemo(() => comps.filter((c) => c.is_self), [comps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = market;
    if (q) rows = rows.filter((c) => (c.label || c.airbnb_id).toLowerCase().includes(q));
    if (lakefrontOnly) rows = rows.filter((c) => c.is_lakefront);
    const val = (c: CompRow): number | string => {
      switch (sortKey) {
        case "label": return (c.label || c.airbnb_id).toLowerCase();
        case "bedrooms": return c.bedrooms ?? -1;
        case "bathrooms": return c.bathrooms ?? -1;
        case "rating": return c.rating ?? -1;
        case "occupancy30": return c.stats.occupancy30 ?? -1;
        case "medianPrice": return c.stats.medianPriceCents ?? -1;
        case "lakefront": return c.is_lakefront ? 1 : 0;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return asc ? cmp : -cmp;
    });
  }, [market, query, lakefrontOnly, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === "label");
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/admin/pricing-lab/comps?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Comp removed");
      onChanged();
    } catch {
      toast.error("Failed to remove comp");
    } finally {
      setRemoving(null);
    }
  }

  const lakefrontCount = market.filter((c) => c.is_lakefront).length;
  const pricedCount = market.filter((c) => c.stats.medianPriceCents != null).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search comps" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-56 pl-8" />
        </div>
        <Button variant={lakefrontOnly ? "default" : "outline"} size="sm" onClick={() => setLakefrontOnly((v) => !v)}>
          <Waves className="h-3.5 w-3.5" /> Lakefront ({lakefrontCount})
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {market.length} comps · {pricedCount} priced{self.length ? ` · ${self.length} own listing` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <SortHead label="Listing" k="label" {...{ sortKey, asc, toggleSort }} />
                <SortHead label="BR" k="bedrooms" center {...{ sortKey, asc, toggleSort }} />
                <SortHead label="BA" k="bathrooms" center {...{ sortKey, asc, toggleSort }} />
                <TableHead className="text-center">Amenities</TableHead>
                <SortHead label="Rating" k="rating" center {...{ sortKey, asc, toggleSort }} />
                <SortHead label="Occ 30/60/90d" k="occupancy30" right {...{ sortKey, asc, toggleSort }} />
                <SortHead label="Median" k="medianPrice" right {...{ sortKey, asc, toggleSort }} />
                <TableHead className="text-right">Scraped</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {market.length === 0 ? "No comps yet — add some below or Auto-build 100." : "No comps match."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="max-w-[280px] truncate font-medium">{c.label || `Listing ${c.airbnb_id}`}</span>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {c.last_error && (
                        <span title={c.last_error} className="text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{c.bedrooms ?? "—"}</TableCell>
                  <TableCell className="text-center text-sm">{c.bathrooms ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <AmenityIcons c={c} />
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {c.rating != null ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-current text-amber-500" /> {c.rating}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                    {c.stats.occupancy30 != null || c.stats.occupancy60 != null || c.stats.occupancy90 != null ? (
                      <>
                        {c.stats.occupancy30 != null ? `${c.stats.occupancy30}%` : "—"}
                        <span className="text-muted-foreground"> · </span>
                        {c.stats.occupancy60 != null ? `${c.stats.occupancy60}%` : "—"}
                        <span className="text-muted-foreground"> · </span>
                        {c.stats.occupancy90 != null ? `${c.stats.occupancy90}%` : "—"}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtUsd(c.stats.medianPriceCents)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {c.last_scraped_at ? new Date(c.last_scraped_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={removing === c.id}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  asc,
  toggleSort,
  center,
  right,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  asc: boolean;
  toggleSort: (k: SortKey) => void;
  center?: boolean;
  right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <TableHead className={right ? "text-right" : center ? "text-center" : undefined}>
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 ${active ? "font-semibold text-foreground" : ""} ${right ? "flex-row-reverse" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="text-[10px]">{asc ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}
