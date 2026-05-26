import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Home, CalendarDays, Users, PawPrint, FileText } from "lucide-react";
import { PayActions } from "./pay-actions";
import { EditContactForm } from "./edit-contact-form";

const SPLIT_MIN_LEAD_DAYS = 60;

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, num_guests, lodgify_num_pets, total_amount_cents, cleaning_fee_cents, tax_amount_cents, pet_fee_total_cents, discount_cents, discount_label, nightly_rates_snapshot, payment_plan, status, deposit_paid_at, balance_paid_at, stripe_deposit_invoice_id, property:property_id(name, nickname, cover_image_url, slug), guest:guest_id(id, full_name, email, phone, mailing_address)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!registration) notFound();

  const property = Array.isArray(registration.property) ? registration.property[0] : registration.property;
  const guest = Array.isArray(registration.guest) ? registration.guest[0] : registration.guest;
  const propertyLabel = property?.nickname || property?.name || "your stay";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const checkInTs = new Date(registration.check_in_date + "T00:00:00Z").getTime();
  const daysUntilCheckin = Math.round((checkInTs - today.getTime()) / 86_400_000);
  const splitAllowed = daysUntilCheckin >= SPLIT_MIN_LEAD_DAYS;
  const nights = Math.round(
    (new Date(registration.check_out_date + "T00:00:00Z").getTime() - checkInTs) / 86_400_000
  );

  const totalCents = registration.total_amount_cents ?? 0;
  const discountCents = registration.discount_cents ?? 0;
  const cleaningCents = registration.cleaning_fee_cents ?? 0;
  const taxCents = registration.tax_amount_cents ?? 0;
  const petCents = registration.pet_fee_total_cents ?? 0;
  const nightlyRates = (registration.nightly_rates_snapshot as Array<{ date: string; cents: number }> | null) ?? [];
  const nightsSubtotalCents = nightlyRates.reduce((sum, n) => sum + (n?.cents ?? 0), 0);

  const alreadyPaid = !!registration.deposit_paid_at || !!registration.balance_paid_at;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero */}
      <div className="relative w-full aspect-16/7 max-h-72 bg-muted overflow-hidden">
        {property?.cover_image_url ? (
          <Image
            src={property.cover_image_url}
            alt={propertyLabel}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Home className="h-12 w-12 opacity-40" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-6">
          <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">
            {propertyLabel}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Complete your payment to confirm your stay
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Booking details */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              Booking details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-in</p>
                <p className="font-medium">{fmtDate(registration.check_in_date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-out</p>
                <p className="font-medium">{fmtDate(registration.check_out_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>
                  {registration.num_guests} guest{registration.num_guests === 1 ? "" : "s"}
                </span>
              </div>
              {(registration.lodgify_num_pets ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {registration.lodgify_num_pets} pet{registration.lodgify_num_pets === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              <div className="text-muted-foreground">{nights} night{nights === 1 ? "" : "s"}</div>
            </div>
          </CardContent>
        </Card>

        {/* Editable guest details */}
        {guest && (
          <EditContactForm
            registrationId={registration.id}
            guestId={guest.id}
            initial={{
              full_name: guest.full_name ?? "",
              email: guest.email ?? "",
              phone: guest.phone ?? "",
              mailing_address: guest.mailing_address ?? "",
            }}
          />
        )}

        {/* Itemized total */}
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Price breakdown</span>
            </div>
            <Row
              label={
                nightlyRates.length
                  ? `${fmt(Math.round(nightsSubtotalCents / Math.max(nights, 1)))} × ${nights} night${nights === 1 ? "" : "s"}`
                  : `Nights subtotal`
              }
              value={fmt(nightsSubtotalCents)}
            />
            {cleaningCents > 0 && <Row label="Cleaning fee" value={fmt(cleaningCents)} />}
            {petCents > 0 && <Row label="Pet fee" value={fmt(petCents)} />}
            {taxCents > 0 && <Row label="Taxes" value={fmt(taxCents)} />}
            {discountCents > 0 && (
              <Row
                label={registration.discount_label || "Discount"}
                value={`− ${fmt(discountCents)}`}
                muted
              />
            )}
            <div className="border-t mt-2 pt-2 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{fmt(totalCents)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pay actions or paid state */}
        <Card>
          <CardContent className="pt-5">
            {alreadyPaid ? (
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Looks like this booking has already been paid.</p>
                  <p className="text-muted-foreground mt-1">
                    Reply to your invoice email if you need anything.
                  </p>
                </div>
              </div>
            ) : (
              <PayActions
                registrationId={registration.id}
                plan={registration.payment_plan as "full" | "split" | "automatic"}
                totalCents={totalCents}
                splitAllowed={splitAllowed}
                daysUntilCheckin={daysUntilCheckin}
                hasInvoice={!!registration.stripe_deposit_invoice_id}
              />
            )}
          </CardContent>
        </Card>

        {/* Policy link */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 pb-8">
          <Link
            href="/rental-policies"
            className="inline-flex items-center gap-1.5 hover:text-foreground underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener"
          >
            <FileText className="h-4 w-4" />
            Read our rental policies
          </Link>
          {property?.slug && (
            <Badge variant="outline" className="font-normal">
              {propertyLabel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm py-1 ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
