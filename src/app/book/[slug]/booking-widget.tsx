"use client";

import { ExternalLink, Calendar, Users, Moon } from "lucide-react";

/**
 * Shows booking details and links to the Lodgify checkout page.
 * We can't cleanly iframe Lodgify's checkout (it includes their full site chrome),
 * so we provide a clear CTA that opens the booking flow in a new tab.
 */
export function BookingWidget({
  lodgifyPropertyId,
  propertyName,
  checkIn,
  checkOut,
  guests,
}: {
  lodgifyPropertyId: number;
  propertyName: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}) {
  // Build the Lodgify checkout URL
  const params = new URLSearchParams();
  if (checkIn) params.set("arrival", checkIn);
  if (checkOut) params.set("departure", checkOut);
  if (guests) params.set("guests", guests);
  params.set("currency", "USD");

  const checkoutUrl = `https://checkout.lodgify.com/en/summitlakeside/${lodgifyPropertyId}/reservation?${params}`;

  // Slugify the property name for the property page link
  const lodgifySlug = propertyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const propertyPageUrl = `https://www.summitlakeside.com/en/${lodgifySlug}`;

  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut + "T00:00:00").getTime() -
            new Date(checkIn + "T00:00:00").getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">Book Your Stay</h2>

      {/* Trip summary */}
      {checkIn && checkOut && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Check-in
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(checkIn)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Check-out
              </p>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(checkOut)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {nights && (
              <span className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" />
                {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
            {guests && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {guests} guest{parseInt(guests) !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Book now CTA */}
      <a
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 w-full px-6 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors"
      >
        Continue to Booking
        <ExternalLink className="h-5 w-5" />
      </a>

      <p className="text-xs text-muted-foreground text-center">
        You&apos;ll be taken to our secure booking page to select your dates,
        see nightly rates, and complete your reservation.
      </p>

      {/* Secondary link */}
      <div className="text-center">
        <a
          href={propertyPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          View full property details on summitlakeside.com
        </a>
      </div>
    </div>
  );
}
