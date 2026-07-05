"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Tag, Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { stayIncludesHoliday } from "@/lib/holidays";

type Property = {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  lodgify_property_id: number;
  cleaning_fee_cents: number;
  pet_fee_cents: number;
};

type NightlyRate = {
  date: string;
  price_cents: number;
  min_stay: number;
};

type PricingData = {
  nightly_rates: NightlyRate[];
  nights: number;
  min_stay_nights: number;
  room_rate_cents: number;
  cleaning_fee_cents: number;
  pet_fee_cents: number;
  pet_count: number;
  pet_fee_total_cents: number;
  state_tax_cents: number;
  county_tax_cents: number;
  tax_total_cents: number;
  total_cents: number;
};

type ResolvedPromos = {
  coupon_discount_cents: number;
  upsell_adjustments: Record<string, number>;
  total_discount_cents: number;
  breakdown: { label: string; discount_cents: number; upsell_type: string | null }[];
  perks: string[];
  applied_promo_ids: string[];
  primary_promo_id: string | null;
  code: { provided: boolean; valid: boolean; applied: boolean; error?: string };
};

// Available upsells
const UPSELLS = [
  { type: "new_sheets", label: "Brand New Sheets & Pillowcases", price_cents: 25000 },
  { type: "firewood", label: "Firewood Delivery", price_cents: 3500 },
  { type: "baby_high_chair", label: "Baby High Chair Rental", price_cents: 2500 },
];

// Timing upsells are tiered: pick 1 or 2 extra hours, in either direction.
// Billed per extra hour: $25/hr normally, $50/hr on holiday stays.
const TIMING_UPSELL_DEFS = [
  { type: "early_checkin", label: "Early Check-In", time_labels: ["3:00 PM", "2:00 PM"] },
  { type: "late_checkout", label: "Late Check-Out", time_labels: ["12:00 PM", "1:00 PM"] },
];

function buildTimingUpsells(hourlyCents: number) {
  return TIMING_UPSELL_DEFS.map((u) => ({
    type: u.type,
    label: u.label,
    tiers: [
      { hours: 1, time_label: u.time_labels[0], price_cents: hourlyCents },
      { hours: 2, time_label: u.time_labels[1], price_cents: hourlyCents * 2 },
    ],
  }));
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CheckoutForm({
  property,
  checkIn,
  checkOut,
  guests,
  pets,
}: {
  property: Property;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
}) {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  // Guest info
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Upsells
  const [selectedUpsells, setSelectedUpsells] = useState<Set<string>>(new Set());
  // Timing upsells: selected hours per type (null/absent = not selected)
  const [timingHours, setTimingHours] = useState<Record<string, number | null>>({});

  // Promo — a single resolve call folds in automatic promos + the typed code.
  const [promoCode, setPromoCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [resolved, setResolved] = useState<ResolvedPromos | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Checkout
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = Math.round(
    (new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Timing upsells cost $50/hr when the stay overlaps a holiday, else $25/hr.
  const isHolidayStay = stayIncludesHoliday(checkIn, checkOut);
  const timingUpsells = buildTimingUpsells(isHolidayStay ? 5000 : 2500);

  // Fetch pricing
  useEffect(() => {
    setPricingLoading(true);
    const params = new URLSearchParams({
      property_id: property.id,
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
      pets: String(pets),
    });
    fetch(`/api/checkout/pricing?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPricing(data))
      .catch(() => setPricing(null))
      .finally(() => setPricingLoading(false));
  }, [property.id, checkIn, checkOut, guests, pets]);

  function toggleUpsell(type: string) {
    setSelectedUpsells((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const timingItems = timingUpsells.flatMap((u) => {
    const hours = timingHours[u.type];
    if (!hours) return [];
    const tier = u.tiers.find((t) => t.hours === hours) ?? u.tiers[0];
    return [{
      type: u.type,
      label: `${u.label} (${tier.time_label})`,
      price_cents: tier.price_cents,
      meta: { hours: tier.hours },
    }];
  });
  const upsellItems = [
    ...UPSELLS.filter((u) => selectedUpsells.has(u.type)),
    ...timingItems,
  ];
  const upsellTotalCents = upsellItems.reduce((sum, u) => sum + u.price_cents, 0);
  const discountCents = resolved?.total_discount_cents ?? 0;
  const grandTotalCents = pricing
    ? pricing.total_cents + upsellTotalCents - discountCents
    : 0;
  const belowMinStay = pricing !== null && pricing.room_rate_cents === 0;

  // Re-resolve promos (automatic + typed code) whenever pricing, the add-on
  // selection, the submitted code, or the email changes — an add-on can cross a
  // min-spend threshold, and email determines first-time/returning eligibility.
  const upsellKey = JSON.stringify(upsellItems.map((u) => [u.type, u.price_cents]));
  useEffect(() => {
    if (!pricing || pricing.room_rate_cents === 0) {
      setResolved(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setPromoLoading(true);
      fetch("/api/checkout/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          property_id: property.id,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          pets,
          room_rate_cents: pricing.room_rate_cents,
          cleaning_fee_cents: pricing.cleaning_fee_cents,
          pet_fee_total_cents: pricing.pet_fee_total_cents,
          nightly_rates: pricing.nightly_rates.map((r) => ({ date: r.date, price_cents: r.price_cents })),
          upsells: upsellItems.map((u) => ({ type: u.type, price_cents: u.price_cents })),
          code: submittedCode || undefined,
          guest_email: guestEmail.includes("@") ? guestEmail : undefined,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setResolved(data))
        .catch(() => {})
        .finally(() => setPromoLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, upsellKey, submittedCode, guestEmail, property.id, checkIn, checkOut, guests, pets]);

  function applyPromo() {
    setSubmittedCode(promoCode.trim());
  }

  async function handleCheckout() {
    if (!guestName || !guestEmail) {
      setError("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: property.id,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          pets,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          upsells: upsellItems,
          promo_code: submittedCode || undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");
  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <div className="h-16" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Complete Your Booking</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Guest Info */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold text-lg">Guest Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add-ons */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold text-lg">Add-ons</h2>
                {isHolidayStay && (
                  <p className="text-xs text-amber-600">
                    Holiday rate: early check-in & late check-out are $50/hour.
                  </p>
                )}
                <div className="space-y-2">
                  {UPSELLS.map((upsell) => {
                    const selected = selectedUpsells.has(upsell.type);
                    return (
                      <button
                        key={upsell.type}
                        onClick={() => toggleUpsell(upsell.type)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                              selected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-sm font-medium">{upsell.label}</span>
                        </div>
                        <span className="text-sm font-semibold">{fmt(upsell.price_cents)}</span>
                      </button>
                    );
                  })}

                  {/* Timing upsells (tiered: early check-in / late check-out) */}
                  {timingUpsells.map((upsell) => {
                    const selectedHours = timingHours[upsell.type];
                    return (
                      <div
                        key={upsell.type}
                        className={`rounded-lg border transition-colors ${
                          selectedHours ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <button
                          onClick={() =>
                            setTimingHours((prev) => ({
                              ...prev,
                              [upsell.type]: prev[upsell.type] ? null : upsell.tiers[0].hours,
                            }))
                          }
                          className="w-full flex items-center justify-between p-3 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                                selectedHours
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {selectedHours && <Check className="h-3 w-3" />}
                            </div>
                            <span className="text-sm font-medium">{upsell.label}</span>
                          </div>
                          <span className="text-sm font-semibold">from {fmt(upsell.tiers[0].price_cents)}</span>
                        </button>
                        {selectedHours && (
                          <div className="flex gap-2 px-3 pb-3">
                            {upsell.tiers.map((tier) => {
                              const selected = selectedHours === tier.hours;
                              return (
                                <button
                                  key={tier.hours}
                                  onClick={() => setTimingHours((prev) => ({ ...prev, [upsell.type]: tier.hours }))}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                    selected
                                      ? "border-primary bg-primary/10"
                                      : "border-border hover:border-primary/50"
                                  }`}
                                >
                                  <span className="block font-medium">+{tier.hours} hr{tier.hours !== 1 ? "s" : ""} · {tier.time_label}</span>
                                  <span className="block font-semibold">{fmt(tier.price_cents)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Promo Code */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Promo Code
                </h2>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={applyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                  >
                    {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>

                {/* Typed-code feedback */}
                {resolved?.code.provided && (
                  <p className={`text-sm ${resolved.code.valid ? "text-green-600" : "text-red-500"}`}>
                    {resolved.code.error
                      ? resolved.code.error
                      : resolved.code.applied
                        ? "Code applied"
                        : "Code is valid, but a better offer is already applied"}
                  </p>
                )}

                {/* Applied offers (automatic + code), itemized */}
                {resolved && resolved.breakdown.length > 0 && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
                    {resolved.breakdown.map((line, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-green-700">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" /> {line.label}
                        </span>
                        <span className="font-medium">-{fmt(line.discount_cents)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Display-only perks */}
                {resolved && resolved.perks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {resolved.perks.map((perk, i) => (
                      <span key={i} className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        🎁 {perk}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h2 className="font-semibold text-lg">Order Summary</h2>

                  {/* Property info */}
                  <div className="flex gap-3">
                    {property.cover_image_url && (
                      <img
                        src={property.cover_image_url}
                        alt={property.name}
                        className="w-20 h-14 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">{property.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {checkInDate.toLocaleDateString("en-US", dateOpts)} &mdash;{" "}
                        {checkOutDate.toLocaleDateString("en-US", dateOpts)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {nights} night{nights !== 1 ? "s" : ""} &middot; {guests} guest
                        {guests !== 1 ? "s" : ""}
                        {pets > 0 ? ` · ${pets} pet${pets !== 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {pricingLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : belowMinStay ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm space-y-2">
                      <p className="font-semibold text-amber-800">
                        Extend by {pricing!.min_stay_nights - nights} night{pricing!.min_stay_nights - nights !== 1 ? "s" : ""} to book
                      </p>
                      <p className="text-amber-700">
                        Min stay: {pricing!.min_stay_nights} night{pricing!.min_stay_nights !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ) : pricing ? (
                    <div className="space-y-2 text-sm">
                      {/* Nightly rates */}
                      {pricing.nightly_rates.map((rate) => {
                        const d = new Date(rate.date + "T00:00:00");
                        const label = d.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        });
                        return (
                          <div key={rate.date} className="flex justify-between text-muted-foreground">
                            <span>{label}</span>
                            <span>{fmt(rate.price_cents)}</span>
                          </div>
                        );
                      })}

                      <Separator />

                      <div className="flex justify-between">
                        <span>Room Total</span>
                        <span className="font-medium">{fmt(pricing.room_rate_cents)}</span>
                      </div>

                      {pricing.cleaning_fee_cents > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Cleaning Fee</span>
                          <span>{fmt(pricing.cleaning_fee_cents)}</span>
                        </div>
                      )}

                      {pricing.pet_fee_total_cents > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            Pet Fee ({pets} pet{pets !== 1 ? "s" : ""})
                          </span>
                          <span>{fmt(pricing.pet_fee_total_cents)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-muted-foreground">
                        <span>PA State Tax (6%)</span>
                        <span>{fmt(pricing.state_tax_cents)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Monroe County Tax (3%)</span>
                        <span>{fmt(pricing.county_tax_cents)}</span>
                      </div>

                      {/* Upsells */}
                      {upsellItems.map((u) => (
                        <div key={u.type} className="flex justify-between text-muted-foreground">
                          <span>{u.label}</span>
                          <span>{fmt(u.price_cents)}</span>
                        </div>
                      ))}

                      {/* Discount */}
                      {discountCents > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Promo Discount</span>
                          <span>-{fmt(discountCents)}</span>
                        </div>
                      )}

                      <Separator />

                      <div className="flex justify-between text-base font-semibold">
                        <span>Total</span>
                        <span>{fmt(grandTotalCents)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500">Unable to load pricing.</p>
                  )}

                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={submitting || !pricing || belowMinStay || !guestName || !guestEmail}
                    onClick={handleCheckout}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      `Pay ${pricing ? fmt(grandTotalCents) : ""}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
