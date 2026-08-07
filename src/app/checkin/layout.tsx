import type { Metadata } from "next";

// Booking-lookup utility (served as the guest. subdomain root) — not for search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
