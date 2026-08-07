"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

/**
 * Loads GA4 only on the public marketing host, and only when a measurement ID
 * is configured. The client-side hostname check (instead of headers() in the
 * layout) keeps every page statically renderable and keeps guest/admin/kiosk
 * PWA traffic out of the marketing property.
 */
export function AnalyticsGate() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!gaId) return;
    const host = window.location.hostname;
    if (host === "www.summitlakeside.com" || host === "summitlakeside.com") {
      setEnabled(true);
    }
  }, [gaId]);

  if (!enabled || !gaId) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
