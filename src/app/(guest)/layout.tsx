import type { Metadata } from "next";

// The guest portal (/p/[slug]/* and /q/[code]) is in-stay utility content —
// thin and duplicated across every property slug. Keep it out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GuestRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
