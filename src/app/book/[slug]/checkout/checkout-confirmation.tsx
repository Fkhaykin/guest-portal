"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ConfirmationData = {
  confirmed: boolean;
  registration_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  amount_cents: number;
  guest_name: string;
};

export function CheckoutConfirmation({
  sessionId,
  propertyName,
  slug,
}: {
  sessionId: string;
  propertyName: string;
  slug: string;
}) {
  const [data, setData] = useState<ConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/checkout/confirm?session_id=${sessionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setData(d))
      .catch(() => setError("Unable to confirm payment. Please contact us."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <div className="h-16" />

      <div className="max-w-lg mx-auto px-4 py-16">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Confirming your booking...</p>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-red-500">{error}</p>
              <Link href={`/book/${slug}`}>
                <Button variant="outline">Back to Property</Button>
              </Link>
            </CardContent>
          </Card>
        ) : data?.confirmed ? (
          <Card>
            <CardContent className="p-6 text-center space-y-5">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
              <div>
                <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
                <p className="text-muted-foreground mt-1">
                  Thank you, {data.guest_name}. Your reservation at {propertyName} is confirmed.
                </p>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>
                  {new Date(data.check_in + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  &mdash;{" "}
                  {new Date(data.check_out + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p>
                  {data.guests} guest{data.guests !== 1 ? "s" : ""} &middot; $
                  {(data.amount_cents / 100).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  paid
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                A confirmation email has been sent. Check in is at 4:00 PM.
              </p>
              <Link href="/">
                <Button className="mt-2">Done</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-muted-foreground">Payment could not be verified.</p>
              <Link href={`/book/${slug}`}>
                <Button variant="outline">Back to Property</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
