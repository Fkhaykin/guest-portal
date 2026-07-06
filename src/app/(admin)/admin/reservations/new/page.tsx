"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingDatePicker } from "@/components/admin/booking-date-picker";
import { Loader2 } from "lucide-react";

type Property = {
  id: string;
  name: string;
  nickname: string | null;
  lodgify_property_id: number | null;
  guest_cleaning_fee_cents: number;
  guest_pet_fee_cents: number;
};

type Breakdown = {
  nightlyRates: { date: string; price_cents: number }[];
  nights: number;
  roomRateCents: number;
  cleaningFeeCents: number;
  petFeeTotalCents: number;
  stateTaxCents: number;
  countyTaxCents: number;
  taxTotalCents: number;
  discountCents: number;
  totalCents: number;
};

const SPLIT_MIN_LEAD_DAYS = 60;

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function diffDays(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86_400_000);
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function NewReservationPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [numGuests, setNumGuests] = useState("2");
  const [numPets, setNumPets] = useState("0");
  const [discountDollars, setDiscountDollars] = useState("");
  const [discountLabel, setDiscountLabel] = useState("Loyalty Discount");
  const [manualTotalDollars, setManualTotalDollars] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<"full" | "split" | "automatic" | "paid">("full");
  const [notes, setNotes] = useState("");
  const [dateConflict, setDateConflict] = useState(false);
  const [ackDoubleBook, setAckDoubleBook] = useState(false);

  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    plan: "full" | "split" | "automatic";
    markedPaid: boolean;
    url: string | null;
    pickUrl: string | null;
    balanceDue: string | null;
    dueNowCents: number;
    totalCents: number;
  } | null>(null);

  // Cache the latest fetch params so a stale response doesn't overwrite a newer one.
  const fetchSeq = useRef(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("property")
        .select("id, name, nickname, lodgify_property_id, guest_cleaning_fee_cents, guest_pet_fee_cents")
        .order("name");
      if (data) setProperties(data as Property[]);
    })();
  }, []);

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId]
  );

  const daysOut = useMemo(() => (checkIn ? diffDays(todayIso(), checkIn) : 0), [checkIn]);
  const splitAllowed = daysOut >= SPLIT_MIN_LEAD_DAYS;

  // A check-in already in the past can't be auto-priced — the admin enters the total.
  const isPastCheckIn = useMemo(() => !!checkIn && checkIn < todayIso(), [checkIn]);
  const manualTotalCents = useMemo(() => {
    const n = parseFloat(manualTotalDollars);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [manualTotalDollars]);

  const discountCents = useMemo(() => {
    const n = parseFloat(discountDollars);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [discountDollars]);

  // Fetch breakdown whenever the inputs that affect price change.
  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut) {
      setBreakdown(null);
      setBreakdownError(null);
      return;
    }
    if (checkIn < todayIso()) {
      // Past-dated backfill — the engine can't price past nights; the admin enters
      // the total manually below, so skip the preview fetch entirely.
      setBreakdown(null);
      setBreakdownError(null);
      setBreakdownLoading(false);
      return;
    }
    const seq = ++fetchSeq.current;
    setBreakdownLoading(true);
    setBreakdownError(null);
    fetch("/api/admin/bookings/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(numGuests, 10) || 2,
        pets: parseInt(numPets, 10) || 0,
        discount_cents: discountCents,
      }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (seq !== fetchSeq.current) return;
        if (!r.ok) {
          setBreakdownError(json.error || "Failed to fetch pricing");
          setBreakdown(null);
        } else {
          setBreakdown(json);
        }
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return;
        setBreakdownError(err instanceof Error ? err.message : "Network error");
        setBreakdown(null);
      })
      .finally(() => {
        if (seq === fetchSeq.current) setBreakdownLoading(false);
      });
  }, [propertyId, checkIn, checkOut, numGuests, numPets, discountCents]);

  const dueNowCents = breakdown
    ? paymentPlan === "split"
      ? Math.round(breakdown.totalCents / 2)
      : breakdown.totalCents
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!propertyId) return setError("Choose a property");
    if (!guestName.trim() || !guestEmail.trim()) return setError("Guest name and email are required");
    if (!checkIn || !checkOut) return setError("Select check-in and check-out dates");
    if (isPastCheckIn) {
      if (manualTotalCents <= 0) return setError("Enter the total charged for this past-dated booking");
    } else if (!breakdown) {
      return setError("Pricing not loaded yet");
    }
    if (paymentPlan === "split" && !splitAllowed) {
      return setError(`Split payment requires check-in to be at least ${SPLIT_MIN_LEAD_DAYS} days out`);
    }
    if (dateConflict && !ackDoubleBook) {
      return setError("These dates overlap an existing booking — confirm the double booking to continue");
    }

    const markPaid = paymentPlan === "paid";

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          check_in_date: checkIn,
          check_out_date: checkOut,
          num_guests: parseInt(numGuests, 10) || 1,
          num_pets: parseInt(numPets, 10) || 0,
          discount_cents: discountCents,
          discount_label: discountCents > 0 ? discountLabel.trim() || null : null,
          payment_plan: markPaid ? "full" : paymentPlan,
          mark_paid: markPaid,
          manual_total_cents: isPastCheckIn ? manualTotalCents : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create booking");
        return;
      }
      setResult({
        plan: markPaid ? "full" : paymentPlan,
        markedPaid: !!data.marked_paid,
        url: data.hosted_invoice_url ?? null,
        pickUrl: data.pick_plan_url ?? null,
        balanceDue: data.balance_due_date ?? null,
        dueNowCents: data.amount_due_now_cents ?? 0,
        totalCents: data.total_cents ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const isAuto = result.plan === "automatic";
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Booking created</h1>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              {result.markedPaid ? (
                <p>The booking is confirmed and <strong>marked as paid</strong>. No invoice was sent.</p>
              ) : isAuto ? (
                <p>The guest has been emailed a link to choose their payment plan.</p>
              ) : (
                <p>An invoice for <strong>{fmt(result.dueNowCents)}</strong> has been emailed to the guest.</p>
              )}
              <p>Booking total: <strong>{fmt(result.totalCents)}</strong></p>
              {result.balanceDue && (
                <p>The 50% balance auto-charges on <strong>{result.balanceDue}</strong>.</p>
              )}
            </div>
            {(result.url || result.pickUrl) && (
              <div className="space-y-2">
                <Label>{isAuto ? "Payment-plan picker link (also sent by email)" : "Hosted invoice link (also sent by email)"}</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={result.pickUrl ?? result.url ?? ""} onClick={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText((result.pickUrl ?? result.url)!)}>Copy</Button>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={() => router.push("/admin/reservations")}>Done</Button>
              <Button variant="outline" onClick={() => {
                setResult(null);
                setGuestName(""); setGuestEmail(""); setGuestPhone("");
                setCheckIn(null); setCheckOut(null);
                setDiscountDollars(""); setNotes("");
                setAckDoubleBook(false);
              }}>
                Create another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">New booking</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Property &amp; dates</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a property">
                    {(value) => {
                      const v = typeof value === "string" ? value : "";
                      const match = properties.find((p) => p.id === v);
                      if (!match) return "Select a property";
                      return match.nickname || match.name;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nickname || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dates {checkIn && checkOut && (
                <span className="text-muted-foreground font-normal">
                  — {fmtDate(checkIn)} → {fmtDate(checkOut)} ({diffDays(checkIn, checkOut)} night{diffDays(checkIn, checkOut) === 1 ? "" : "s"})
                </span>
              )}</Label>
              <BookingDatePicker
                lodgifyPropertyId={property?.lodgify_property_id ?? null}
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(r) => { setCheckIn(r.checkIn); setCheckOut(r.checkOut); setAckDoubleBook(false); }}
                onConflictChange={setDateConflict}
                allowPast
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Guest</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest_name">Name</Label>
                <Input id="guest_name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_email">Email</Label>
                <Input id="guest_email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone (optional)</Label>
                <Input id="guest_phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_guests">Guests</Label>
                <Input id="num_guests" type="number" min={1} value={numGuests} onChange={(e) => setNumGuests(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_pets">Pets</Label>
                <Input id="num_pets" type="number" min={0} value={numPets} onChange={(e) => setNumPets(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount (USD, optional)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={discountDollars}
                  onChange={(e) => setDiscountDollars(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_label">Discount name</Label>
                <Input
                  id="discount_label"
                  placeholder="Loyalty Discount"
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  disabled={discountCents <= 0}
                />
              </div>
            </div>

            {!checkIn || !checkOut ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Select dates to see the price breakdown.</p>
            ) : isPastCheckIn ? (
              <div className="space-y-2">
                <Label htmlFor="manual_total">Total charged (USD)</Label>
                <Input
                  id="manual_total"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={manualTotalDollars}
                  onChange={(e) => setManualTotalDollars(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Check-in has already passed, so this stay can&apos;t be auto-priced. Enter the total the guest was charged — best used with the Mark as paid option.
                </p>
              </div>
            ) : breakdownLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading pricing…
              </div>
            ) : breakdownError ? (
              <p className="text-sm text-destructive py-4 text-center">{breakdownError}</p>
            ) : breakdown ? (
              <div className="rounded-md border">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nightly rates ({breakdown.nights} night{breakdown.nights === 1 ? "" : "s"})</p>
                </div>
                <div className="divide-y text-sm">
                  {breakdown.nightlyRates.map((r) => (
                    <div key={r.date} className="px-4 py-1.5 flex items-center justify-between">
                      <span className="text-muted-foreground">{fmtDate(r.date)}</span>
                      <span>{fmt(r.price_cents)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t divide-y text-sm">
                  <Row label={`Room subtotal (${breakdown.nights} night${breakdown.nights === 1 ? "" : "s"})`} value={fmt(breakdown.roomRateCents)} />
                  {breakdown.cleaningFeeCents > 0 && <Row label="Cleaning fee" value={fmt(breakdown.cleaningFeeCents)} />}
                  {breakdown.petFeeTotalCents > 0 && <Row label={`Pet fee × ${parseInt(numPets, 10) || 0}`} value={fmt(breakdown.petFeeTotalCents)} />}
                  {breakdown.stateTaxCents > 0 && <Row label="PA state hotel tax (6%)" value={fmt(breakdown.stateTaxCents)} />}
                  {breakdown.countyTaxCents > 0 && <Row label="Monroe County tax (3%)" value={fmt(breakdown.countyTaxCents)} />}
                </div>
                {breakdown.discountCents > 0 ? (
                  <>
                    <div className="px-4 py-2 border-t bg-muted/20 flex items-center justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{fmt(breakdown.totalCents + breakdown.discountCents)}</span>
                    </div>
                    <div className="px-4 py-2 border-t flex items-center justify-between text-sm text-muted-foreground">
                      <span>{discountLabel.trim() || "Discount"}</span>
                      <span>− {fmt(breakdown.discountCents)}</span>
                    </div>
                    <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold">{fmt(breakdown.totalCents)}</span>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">{fmt(breakdown.totalCents)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentPlan("full")}
                className={`text-left rounded-md border p-3 text-sm transition ${paymentPlan === "full" ? "border-primary ring-1 ring-primary" : "hover:bg-accent"}`}
              >
                <div className="font-medium">Pay in full</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Guest pays {breakdown ? fmt(breakdown.totalCents) : "the full total"} when invoice is sent.
                </div>
              </button>
              <button
                type="button"
                onClick={() => splitAllowed && setPaymentPlan("split")}
                disabled={!splitAllowed}
                className={`text-left rounded-md border p-3 text-sm transition ${paymentPlan === "split" ? "border-primary ring-1 ring-primary" : "hover:bg-accent"} ${!splitAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="font-medium">50% deposit + 50% balance</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {splitAllowed
                    ? `Guest pays ${breakdown ? fmt(Math.round((breakdown?.totalCents ?? 0) / 2)) : "50%"} now; balance auto-charged 30 days before check-in.`
                    : `Available only when check-in is ${SPLIT_MIN_LEAD_DAYS}+ days out${checkIn ? ` (currently ${daysOut} day${daysOut === 1 ? "" : "s"})` : ""}.`}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentPlan("automatic")}
                className={`text-left rounded-md border p-3 text-sm transition ${paymentPlan === "automatic" ? "border-primary ring-1 ring-primary" : "hover:bg-accent"}`}
              >
                <div className="font-medium">Automatic — rule based</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Guest picks at checkout.{" "}
                  {checkIn
                    ? splitAllowed
                      ? `Check-in is ${daysOut} day${daysOut === 1 ? "" : "s"} out, so full and split will both be offered.`
                      : `Check-in is under ${SPLIT_MIN_LEAD_DAYS} days out, so only full payment will be offered.`
                    : `Split is offered when check-in is ${SPLIT_MIN_LEAD_DAYS}+ days out; otherwise full only.`}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentPlan("paid")}
                className={`text-left rounded-md border p-3 text-sm transition ${paymentPlan === "paid" ? "border-primary ring-1 ring-primary" : "hover:bg-accent"}`}
              >
                <div className="font-medium">Mark as paid — no invoice</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Booking is confirmed and recorded as fully paid. Use when payment was already collected outside the portal.
                </div>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Internal notes (optional)</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {dateConflict && (
              <label className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ackDoubleBook}
                  onChange={(e) => setAckDoubleBook(e.target.checked)}
                />
                <span>
                  These dates overlap an existing booking. I understand and want to create this
                  double booking anyway.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting || !breakdown || (dateConflict && !ackDoubleBook)}>
                {submitting
                  ? "Creating…"
                  : paymentPlan === "paid"
                    ? `Create booking & mark paid${breakdown ? ` (${fmt(breakdown.totalCents)} total)` : ""}`
                    : paymentPlan === "automatic"
                      ? `Create booking & email plan picker${breakdown ? ` (${fmt(breakdown.totalCents)} total)` : ""}`
                      : `Create booking & send invoice${breakdown ? ` (${fmt(dueNowCents)} due now)` : ""}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`px-4 py-1.5 flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
