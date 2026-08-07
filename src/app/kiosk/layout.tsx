import type { Metadata } from "next";

// In-house kiosk displays; /kiosk/[token] already sets its own noindex +
// per-device manifest, which merges over this.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
