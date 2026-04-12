"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Embeds the Lodgify property page scrolled to the calendar/booking section.
 * Uses the anchor hash to jump past the hero/description to the availability calendar.
 */
export function BookingCalendar({
  lodgifyPropertyId,
  lodgifySlug,
  checkIn,
  checkOut,
  guests,
}: {
  lodgifyPropertyId: number;
  lodgifySlug: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}) {
  const [loading, setLoading] = useState(true);

  // Build the Lodgify property page URL with date params + anchor to calendar section
  const params = new URLSearchParams();
  if (checkIn) params.set("arrival", checkIn.replace(/-/g, ""));
  if (checkOut) params.set("departure", checkOut.replace(/-/g, ""));
  if (guests) {
    params.set("adults", guests);
    params.set("children", "0");
    params.set("pets", "0");
    params.set("infants", "0");
  }

  // The calendar section anchor from the Lodgify page
  const calendarUrl = `https://summitlakeside.com/en/${lodgifyPropertyId}/${lodgifySlug}?${params}#availability`;

  return (
    <div className="relative rounded-xl overflow-hidden border bg-background">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading availability calendar...</p>
          </div>
        </div>
      )}
      <iframe
        src={calendarUrl}
        className="w-full border-0"
        style={{ height: "700px" }}
        onLoad={() => setLoading(false)}
        allow="payment"
        title="Availability calendar"
      />
    </div>
  );
}
