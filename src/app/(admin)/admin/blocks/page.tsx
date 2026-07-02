"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingDatePicker } from "@/components/admin/booking-date-picker";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

type Property = { id: string; name: string; nickname: string | null; lodgify_property_id: number | null };

type Block = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  lodgify_booking_id: number | null;
  lodgify_sync_status: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function nights(start: string, end: string) {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export default function BlockedDatesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const property = useMemo(() => properties.find((p) => p.id === propertyId) ?? null, [properties, propertyId]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("property")
        .select("id, name, nickname, lodgify_property_id")
        .order("name");
      if (data) setProperties(data as Property[]);
    })();
  }, []);

  const loadBlocks = useCallback(async () => {
    if (!propertyId) { setBlocks([]); return; }
    const res = await fetch(`/api/admin/blocks?property_id=${propertyId}`);
    const data = await res.json();
    if (res.ok) setBlocks(data.blocks ?? []);
  }, [propertyId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks, refreshToken]);

  async function addBlock() {
    setError(null);
    setWarning(null);
    if (!propertyId) return setError("Choose a property");
    if (!checkIn || !checkOut) return setError("Select the dates to block");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, start_date: checkIn, end_date: checkOut, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create block"); return; }
      if (!data.ota_held) {
        setWarning("Block saved, but it could not be held on Lodgify — Airbnb/VRBO may still book these dates. Check the Lodgify connection.");
      }
      setCheckIn(null); setCheckOut(null); setReason("");
      setRefreshToken((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id: string) {
    setError(null);
    setWarning(null);
    const res = await fetch(`/api/admin/blocks?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to delete block"); return; }
    if (data.ota_released === false && data.lodgify_booking_id) {
      setWarning(`Block removed here, but the Lodgify hold (booking #${data.lodgify_booking_id}) could not be deleted automatically — remove it in Lodgify so the dates reopen on Airbnb/VRBO.`);
    }
    setRefreshToken((n) => n + 1);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Blocked dates</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Block dates for maintenance, owner stays, or off-market. Blocks show as unavailable across your
        booking calendar and are held on Lodgify so Airbnb/VRBO can&rsquo;t book them.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); addBlock(); }} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>New block</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v ?? ""); setCheckIn(null); setCheckOut(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a property">
                    {(value) => {
                      const v = typeof value === "string" ? value : "";
                      const match = properties.find((p) => p.id === v);
                      return match ? (match.nickname || match.name) : "Select a property";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nickname || p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dates {checkIn && checkOut && (
                <span className="text-muted-foreground font-normal">
                  — {fmtDate(checkIn)} → {fmtDate(checkOut)} ({nights(checkIn, checkOut)} night{nights(checkIn, checkOut) === 1 ? "" : "s"})
                </span>
              )}</Label>
              <BookingDatePicker
                key={`${propertyId}-${refreshToken}`}
                lodgifyPropertyId={property?.lodgify_property_id ?? null}
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(r) => { setCheckIn(r.checkIn); setCheckOut(r.checkOut); }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" placeholder="Maintenance, owner stay…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {warning && (
              <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {warning}
              </p>
            )}

            <Button type="submit" disabled={saving || !propertyId || !checkIn || !checkOut}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Blocking…</> : "Block these dates"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {propertyId && (
        <Card className="mt-5">
          <CardHeader><CardTitle>Existing blocks</CardTitle></CardHeader>
          <CardContent>
            {blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No blocks for this property.</p>
            ) : (
              <div className="divide-y">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5">
                    <div className="text-sm">
                      <span className="font-medium">{fmtDate(b.start_date)} → {fmtDate(b.end_date)}</span>
                      <span className="text-muted-foreground"> · {nights(b.start_date, b.end_date)} night{nights(b.start_date, b.end_date) === 1 ? "" : "s"}</span>
                      {b.reason && <span className="text-muted-foreground"> · {b.reason}</span>}
                      {b.lodgify_sync_status === "failed" && (
                        <span className="text-amber-600 dark:text-amber-400"> · not held on Lodgify</span>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
