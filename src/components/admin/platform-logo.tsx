// Official booking-channel brand glyphs, used to show which platform a booking
// or enquiry came in on. The path data is each brand's real mark (sourced from
// Simple Icons) — never a redrawn approximation. Platforms whose owner pulled
// their mark from the public icon sets (e.g. Vrbo/HomeAway) intentionally have
// no entry here; callers fall back to a text label rather than fake a logo.

export type PlatformGlyph = { label: string; color: string; path: string };

const AIRBNB: PlatformGlyph = {
  label: "Airbnb",
  color: "#FF5A5F",
  path: "M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z",
};

const BOOKING: PlatformGlyph = {
  label: "Booking.com",
  color: "#003A9A",
  path: "M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z",
};

/**
 * Map a raw Lodgify source/channel string (e.g. "AirbnbIntegration",
 * "Booking.com", "HomeAway") to a known brand glyph, or null when we have no
 * official mark for it.
 */
export function platformGlyph(
  source: string | null | undefined
): PlatformGlyph | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s.includes("airbnb")) return AIRBNB;
  if (s.includes("booking")) return BOOKING;
  return null;
}

/** Render an official platform brand glyph at its real brand color. */
export function PlatformLogo({
  glyph,
  className,
}: {
  glyph: PlatformGlyph;
  className?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={glyph.label}
      viewBox="0 0 24 24"
      className={className}
      fill={glyph.color}
    >
      <title>{glyph.label}</title>
      <path d={glyph.path} />
    </svg>
  );
}
