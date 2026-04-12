"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const LODGIFY_WEBSITE_ID = process.env.NEXT_PUBLIC_LODGIFY_WEBSITE_ID;

/**
 * Embeds the Lodgify booking widget for a specific property.
 *
 * The widget is loaded as an iframe pointing to the Lodgify-hosted booking page,
 * styled to blend seamlessly into the site. Dates and guest count from the
 * availability search are forwarded as URL hash parameters so the widget
 * opens pre-filled.
 *
 * Requires NEXT_PUBLIC_LODGIFY_WEBSITE_ID in env (your Lodgify website hash).
 */
export function BookingWidget({
  lodgifyPropertyId,
  checkIn,
  checkOut,
  guests,
}: {
  lodgifyPropertyId: number;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
}) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!LODGIFY_WEBSITE_ID) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center space-y-2">
        <p className="text-muted-foreground font-medium">
          Booking widget not configured
        </p>
        <p className="text-sm text-muted-foreground">
          Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_LODGIFY_WEBSITE_ID</code> in
          your environment variables to enable the booking widget.
        </p>
      </div>
    );
  }

  // Build the Lodgify widget iframe URL
  // Format: https://app.lodgify.com/#/booking/{websiteId}/{propertyId}
  // With optional date/guest params in the hash
  const hashParams = new URLSearchParams();
  if (checkIn) hashParams.set("arrive", checkIn);
  if (checkOut) hashParams.set("depart", checkOut);
  if (guests) hashParams.set("guests", guests);

  const hashString = hashParams.toString();
  const widgetUrl = `https://app.lodgify.com/#/booking/${LODGIFY_WEBSITE_ID}/${lodgifyPropertyId}${hashString ? `?${hashString}` : ""}`;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select Your Dates & Book</h2>

      <div className="relative rounded-xl overflow-hidden border bg-background min-h-[600px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading booking calendar...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={widgetUrl}
          className="w-full border-0"
          style={{ minHeight: "600px", height: "80vh", maxHeight: "900px" }}
          onLoad={() => setLoading(false)}
          allow="payment"
          title={`Book this property`}
        />
      </div>
    </div>
  );
}
