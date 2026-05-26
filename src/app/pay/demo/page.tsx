import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, PawPrint, FileText, Info } from "lucide-react";
import { EditContactForm } from "../[id]/edit-contact-form";
import { PayActions } from "../[id]/pay-actions";

// Internal preview of the guest /pay/[id] experience. Not linked from the
// app and not used by any email — visit /pay/demo manually to walk through
// the page with sample data. Pay buttons and the contact form short-circuit
// (no DB writes, no Stripe charges).

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

const CHECK_IN = "2026-08-01";
const CHECK_OUT = "2026-08-07";
const NIGHTS = 6;
const NIGHTLY = 35_000;
const CLEANING = 18_000;
const TAX = 14_500;
const PET = 6_000;
const NIGHTS_SUBTOTAL = NIGHTLY * NIGHTS;
const TOTAL = NIGHTS_SUBTOTAL + CLEANING + TAX + PET;
const PROPERTY = "The Summit Lakehouse (Demo)";
const COVER =
  "https://a0.muscache.com/im/pictures/11d2c493-87e1-4534-acdc-e1ff0f1f5832.jpg?im_w=1920";

export default function PayDemoPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Demo banner */}
      <div className="bg-blue-600 text-white text-xs px-4 py-2 flex items-center justify-center gap-2">
        <Info className="h-3.5 w-3.5" />
        Demo mode — sample data. Editing your details and tapping pay buttons won&apos;t actually save or charge.
      </div>

      {/* Hero */}
      <div className="relative w-full aspect-16/7 max-h-72 bg-muted overflow-hidden">
        <Image src={COVER} alt={PROPERTY} fill className="object-cover" priority sizes="100vw" />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-6">
          <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">{PROPERTY}</h1>
          <p className="text-white/80 text-sm mt-1">Complete your payment to confirm your stay</p>
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
                <p className="font-medium">{fmtDate(CHECK_IN)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-out</p>
                <p className="font-medium">{fmtDate(CHECK_OUT)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>6 guests</span>
              </div>
              <div className="flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-muted-foreground" />
                <span>1 pet</span>
              </div>
              <div className="text-muted-foreground">{NIGHTS} nights</div>
            </div>
          </CardContent>
        </Card>

        {/* Editable contact (demo mode — no DB write) */}
        <EditContactForm
          registrationId="demo"
          guestId="demo-guest"
          demoMode
          initial={{
            full_name: "Alex Example",
            email: "alex@example.com",
            phone: "+1 555 123 4567",
            mailing_address: "123 Maple Street\nBrooklyn, NY 11201",
          }}
        />

        {/* Itemized total */}
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Price breakdown</span>
            </div>
            <Row label={`${fmt(NIGHTLY)} × ${NIGHTS} nights`} value={fmt(NIGHTS_SUBTOTAL)} />
            <Row label="Cleaning fee" value={fmt(CLEANING)} />
            <Row label="Pet fee" value={fmt(PET)} />
            <Row label="Taxes" value={fmt(TAX)} />
            <div className="border-t mt-2 pt-2 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{fmt(TOTAL)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pay actions (demo mode — no Stripe redirect) */}
        <Card>
          <CardContent className="pt-5">
            <PayActions
              registrationId="demo"
              plan="automatic"
              totalCents={TOTAL}
              splitAllowed
              daysUntilCheckin={70}
              hasInvoice={false}
              demoMode
            />
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
          <Badge variant="outline" className="font-normal">
            {PROPERTY}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
