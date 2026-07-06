"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Waves, ExternalLink } from "lucide-react";
import { fmtUsd } from "./types";

interface CompCalRow {
  id: string;
  label: string;
  url: string | null;
  is_self: boolean;
  is_lakefront: boolean;
  bedrooms: number | null;
  occupancy30: number | null;
  days: { available: boolean | null; price: number | null }[];
}

// Competitor Calendar — each comp's next 21 nights of availability + price,
// mirroring PriceLabs' table under the map. Own listing pinned first.
export function CompetitorCalendar({ nickname }: { nickname: string }) {
  const [data, setData] = useState<{ dates: string[]; comps: CompCalRow[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setData(null);
      try {
        const res = await fetch(`/api/admin/pricing-lab/comp-calendar?nickname=${encodeURIComponent(nickname)}`);
        const json = await res.json();
        if (!cancelled && json.dates) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Competitor Calendar</CardTitle>
        <p className="text-sm text-muted-foreground">Next 21 nights across your comp set — booked (grey) vs open, with probed prices.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.comps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No comp data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium">Listing</th>
                  <th className="px-2 py-1.5 text-right font-medium">Occ</th>
                  {data.dates.map((d) => {
                    const dt = new Date(d + "T00:00:00Z");
                    const we = dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
                    return (
                      <th key={d} className={`px-1 py-1.5 text-center font-medium ${we ? "text-foreground" : "text-muted-foreground"}`}>
                        {dt.getUTCDate()}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.comps.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 max-w-50 truncate bg-card px-2 py-1.5">
                      <span className="flex items-center gap-1">
                        {c.is_self && <Badge variant="secondary" className="px-1 py-0 text-[10px]">Ours</Badge>}
                        {c.is_lakefront && <Waves className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        {c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
                            title={`Open ${c.label} on Airbnb`}
                          >
                            <span className="truncate">{c.label}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="truncate">{c.label}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{c.occupancy30 != null ? `${c.occupancy30}%` : "—"}</td>
                    {c.days.map((day, i) => (
                      <td
                        key={i}
                        className="px-1 py-1.5 text-center tabular-nums"
                        style={{ background: day.available === false ? "var(--demand-unavailable)" : undefined }}
                        title={day.available === false ? "Booked" : day.price != null ? fmtUsd(day.price) : "Open"}
                      >
                        {day.available === false ? "·" : day.price != null ? Math.round(day.price / 100) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
