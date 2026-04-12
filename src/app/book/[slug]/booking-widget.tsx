"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

/**
 * Embeds the Lodgify checkout page for a specific property.
 * This shows just the calendar with nightly rates and booking form,
 * not the full property page.
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
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // Build the Lodgify checkout URL
  let checkoutUrl = `https://checkout.lodgify.com/en/summitlakeside/${lodgifyPropertyId}/reservation`;

  const params = new URLSearchParams();
  if (checkIn) params.set("arrival", checkIn);
  if (checkOut) params.set("departure", checkOut);
  if (guests) params.set("guests", guests);
  params.set("currency", "USD");
  const queryString = params.toString();
  if (queryString) checkoutUrl += `?${queryString}`;

  if (iframeError) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Select Your Dates & Book</h2>
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Complete your booking directly on our website.
          </p>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Book on Summit Lakeside
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Select Your Dates & Book</h2>
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Open in new tab
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="relative rounded-xl overflow-hidden border bg-background min-h-150">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading booking calendar...</p>
            </div>
          </div>
        )}
        <iframe
          src={checkoutUrl}
          className="w-full border-0"
          style={{ minHeight: "600px", height: "80vh", maxHeight: "900px" }}
          onLoad={() => setLoading(false)}
          onError={() => setIframeError(true)}
          allow="payment"
          title={`Book ${propertyName}`}
        />
      </div>
    </div>
  );
}
