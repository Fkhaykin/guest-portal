import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PayPlanPicker } from "./pay-plan-picker";

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

export default async function PayPlanPickerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: registration } = await admin
    .from("registration")
    .select(
      "id, check_in_date, check_out_date, total_amount_cents, discount_cents, discount_label, payment_plan, status, deposit_paid_at, balance_paid_at, stripe_deposit_invoice_id, property:property_id(name, nickname), guest:guest_id(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!registration) notFound();

  const property = Array.isArray(registration.property) ? registration.property[0] : registration.property;
  const guest = Array.isArray(registration.guest) ? registration.guest[0] : registration.guest;
  const propertyLabel = property?.nickname || property?.name || "your stay";

  // Already paid / not eligible — show a friendly status.
  if (registration.deposit_paid_at || registration.balance_paid_at) {
    return (
      <Shell propertyLabel={propertyLabel}>
        <p className="text-sm text-muted-foreground">
          Looks like this booking has already been paid. Reply to your invoice email if you need anything.
        </p>
      </Shell>
    );
  }

  if (registration.payment_plan !== "automatic") {
    // If they were sent here but the plan was already locked in, redirect to the existing invoice.
    if (registration.stripe_deposit_invoice_id) {
      redirect("/");
    }
    return (
      <Shell propertyLabel={propertyLabel}>
        <p className="text-sm text-muted-foreground">
          This booking already has a payment plan set. Check your email for your invoice link.
        </p>
      </Shell>
    );
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const checkInTs = new Date(registration.check_in_date + "T00:00:00Z").getTime();
  const daysUntilCheckin = Math.round((checkInTs - today.getTime()) / 86_400_000);
  const splitAllowed = daysUntilCheckin >= SPLIT_MIN_LEAD_DAYS;

  const totalCents = registration.total_amount_cents;
  const discountCents = registration.discount_cents ?? 0;
  const subtotalCents = totalCents + discountCents;

  return (
    <Shell propertyLabel={propertyLabel}>
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <p>
            <span className="text-muted-foreground">Guest:</span> <strong>{guest?.full_name}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Dates:</span>{" "}
            <strong>
              {fmtDate(registration.check_in_date)} → {fmtDate(registration.check_out_date)}
            </strong>
          </p>
        </div>

        <div className="rounded-md border divide-y">
          {discountCents > 0 ? (
            <>
              <Row label="Subtotal" value={fmt(subtotalCents)} />
              <Row
                label={registration.discount_label || "Discount"}
                value={`− ${fmt(discountCents)}`}
                muted
              />
              <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{fmt(totalCents)}</span>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{fmt(totalCents)}</span>
            </div>
          )}
        </div>

        <PayPlanPicker
          registrationId={registration.id}
          totalCents={totalCents}
          splitAllowed={splitAllowed}
          daysUntilCheckin={daysUntilCheckin}
        />
      </div>
    </Shell>
  );
}

function Shell({ propertyLabel, children }: { propertyLabel: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Choose how to pay</h1>
      <p className="text-sm text-muted-foreground mb-6">
        For your stay at <strong>{propertyLabel}</strong>.
      </p>
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`px-4 py-2 flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
