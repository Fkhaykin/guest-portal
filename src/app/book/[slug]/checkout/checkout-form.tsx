"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, Tag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

type PromoResult = {
  valid: boolean;
  error?: string;
  promo_code_id?: string;
  discount_type?: string;
  discount_cents?: number;
  description?: string;
};

// Available upsells
const UPSELLS = [
  { type: "early_checkin", label: "Early Check-In (1:00 PM)", price_cents: 10000 },
  { type: "late_checkout", label: "Late Check-Out (2:00 PM)", price_cents: 10000 },
  { type: "new_sheets", label: "Brand New Sheets & Pillowcases", price_cents: 25000 },
  { type: "firewood", label: "Firewood Delivery", price_cents: 3500 },
  { type: "baby_high_chair", label: "Baby High Chair Rental", price_cents: 2500 },
];

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

  // Promo
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Checkout
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = Math.round(
    (new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) /
      (1000 * 60 * 60 * 24)
  );

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

  const upsellItems = UPSELLS.filter((u) => selectedUpsells.has(u.type));
  const upsellTotalCents = upsellItems.reduce((sum, u) => sum + u.price_cents, 0);
  const discountCents = promoResult?.valid ? promoResult.discount_cents || 0 : 0;
  const grandTotalCents = pricing
    ? pricing.total_cents + upsellTotalCents - discountCents
    : 0;
  const belowMinStay = pricing !== null && pricing.room_rate_cents === 0;

  async function applyPromo() {
    if (!promoCode.trim() || !pricing) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await fetch("/api/checkout/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode.trim(),
          property_id: property.id,
          nights,
          room_rate_cents: pricing.room_rate_cents,
          cleaning_fee_cents: pricing.cleaning_fee_cents,
        }),
      });
      const data = await res.json();
      setPromoResult(data);
    } catch {
      setPromoResult({ valid: false, error: "Failed to validate promo code" });
    } finally {
      setPromoLoading(false);
    }
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
          promo_code: promoResult?.valid ? promoCode.trim() : undefined,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-14">
          <Link
            href={`/book/${property.slug}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}&pets=${pets}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex-1 flex justify-center">
            <Image
              src="/logo.png"
              alt="Summit Lakeside Rentals"
              width={120}
              height={60}
              className="h-8 w-auto invert dark:invert-0"
            />
          </div>
          <div className="w-14" />
        </div>
      </header>

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
                {promoResult && (
                  <p
                    className={`text-sm ${
                      promoResult.valid ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {promoResult.valid
                      ? `${promoResult.description} (-${fmt(promoResult.discount_cents || 0)})`
                      : promoResult.error}
                  </p>
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
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm space-y-1">
                      <p className="font-semibold text-amber-800">Stay is too short</p>
                      <p className="text-amber-700">
                        This property requires a longer minimum stay for your selected dates.
                        Please choose a longer date range to book.
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
                            Pet Fee ({pets} &times; {fmt(pricing.pet_fee_cents)})
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
    </div>
  );
}
